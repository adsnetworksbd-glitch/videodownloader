import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import ApiKey, BannedIP, ContactMessage, DownloadJob, LicenseKey, ProOrder, ProPackage, Provider, SiteSetting, utcnow
from .schemas import ContactMessageIn, ProviderCreate, ProviderUpdate


async def list_providers(db: AsyncSession, include_inactive: bool = True) -> list[Provider]:
    statement = select(Provider).order_by(Provider.priority, Provider.id)
    if not include_inactive:
        statement = statement.where(Provider.is_active.is_(True))
    result = await db.execute(statement)
    return list(result.scalars().all())


async def get_provider(db: AsyncSession, provider_id: int) -> Provider | None:
    return await db.get(Provider, provider_id)


async def get_provider_by_name(db: AsyncSession, name: str) -> Provider | None:
    result = await db.execute(select(Provider).where(Provider.name == name))
    return result.scalars().first()


async def create_provider(db: AsyncSession, data: ProviderCreate) -> Provider:
    provider = Provider(
        name=data.name,
        adapter=data.adapter,
        base_url=data.base_url,
        api_key=data.api_key,
        cookies=data.cookies,
        extra_headers=json.dumps(data.extra_headers) if data.extra_headers else None,
        priority=data.priority,
        is_active=data.is_active,
        timeout_seconds=data.timeout_seconds,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return provider


async def update_provider(db: AsyncSession, provider: Provider, data: ProviderUpdate) -> Provider:
    changes = data.model_dump(exclude_unset=True)
    if "extra_headers" in changes:
        changes["extra_headers"] = json.dumps(changes["extra_headers"]) if changes["extra_headers"] else None
    for field, value in changes.items():
        setattr(provider, field, value)
    await db.commit()
    await db.refresh(provider)
    return provider


async def delete_provider(db: AsyncSession, provider: Provider) -> None:
    await db.delete(provider)
    await db.commit()


async def create_job(db: AsyncSession, job: DownloadJob) -> DownloadJob:
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


async def list_jobs(db: AsyncSession, limit: int = 50) -> list[DownloadJob]:
    result = await db.execute(select(DownloadJob).order_by(DownloadJob.created_at.desc()).limit(limit))
    return list(result.scalars().all())


async def valid_license(db: AsyncSession, key: str) -> LicenseKey | None:
    if not key:
        return None
    license = await db.get(LicenseKey, key.strip())
    if license is None or not license.is_active:
        return None
    if license.expires_at is not None:
        expires = license.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < utcnow():
            return None
    return license


async def list_licenses(db: AsyncSession, limit: int = 200) -> list[LicenseKey]:
    result = await db.execute(select(LicenseKey).order_by(LicenseKey.created_at.desc()).limit(limit))
    return list(result.scalars().all())


async def create_license(db: AsyncSession, plan: str, days: int | None, note: str | None) -> LicenseKey:
    import secrets

    key = f"VDPRO-{secrets.token_hex(5).upper()}"
    license = LicenseKey(
        key=key,
        plan=plan or "pro",
        note=note,
        is_active=True,
        expires_at=(datetime.now(timezone.utc) + timedelta(days=days)) if days else None,
    )
    db.add(license)
    await db.commit()
    await db.refresh(license)
    return license


async def deactivate_license(db: AsyncSession, license_key: LicenseKey) -> None:
    license_key.is_active = False
    await db.commit()


SETTING_WHITELIST: dict[str, str] = {
    "free_daily_limit": "int",
    "pro_daily_limit": "int",
    "free_playlist_items": "int",
    "rate_limit_requests": "int",
    "rate_limit_window": "int",
    "notice_message": "text",
    "pro_instant_activation": "int",
    "telegram_alert_chat_id": "text",
}


async def get_overrides(db: AsyncSession) -> dict[str, str]:
    result = await db.execute(select(SiteSetting))
    return {setting.key: setting.value for setting in result.scalars().all()}


async def set_setting(db: AsyncSession, key: str, value: str) -> None:
    setting = await db.get(SiteSetting, key)
    if setting is None:
        setting = SiteSetting(key=key, value=value)
        db.add(setting)
    else:
        setting.value = value
    await db.commit()


async def effective_int(db: AsyncSession, key: str, default: int) -> int:
    setting = await db.get(SiteSetting, key)
    if setting is None:
        return default
    try:
        return max(0, int(setting.value))
    except ValueError:
        return default


async def is_banned(db: AsyncSession, ip: str) -> bool:
    if not ip:
        return False
    return await db.get(BannedIP, ip) is not None


async def list_banned(db: AsyncSession) -> list[BannedIP]:
    result = await db.execute(select(BannedIP).order_by(BannedIP.created_at.desc()))
    return list(result.scalars().all())


async def ban_ip(db: AsyncSession, ip: str, reason: str | None) -> BannedIP:
    entry = await db.get(BannedIP, ip)
    if entry is None:
        entry = BannedIP(ip=ip, reason=reason)
        db.add(entry)
    else:
        entry.reason = reason
    await db.commit()
    await db.refresh(entry)
    return entry


async def unban_ip(db: AsyncSession, ip: str) -> bool:
    entry = await db.get(BannedIP, ip)
    if entry is None:
        return False
    await db.delete(entry)
    await db.commit()
    return True


async def create_message(db: AsyncSession, data: ContactMessageIn) -> ContactMessage:
    message = ContactMessage(kind=data.kind, name=data.name, phone=data.phone, txid=data.txid, body=data.body)
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


async def list_messages(db: AsyncSession, limit: int = 100, kind: str | None = None) -> list[ContactMessage]:
    statement = select(ContactMessage).order_by(ContactMessage.id.desc()).limit(limit)
    if kind:
        statement = statement.where(ContactMessage.kind == kind)
    result = await db.execute(statement)
    return list(result.scalars().all())


async def mark_message_read(db: AsyncSession, message_id: int, is_read: bool) -> ContactMessage | None:
    message = await db.get(ContactMessage, message_id)
    if message is None:
        return None
    message.is_read = is_read
    await db.commit()
    await db.refresh(message)
    return message


async def delete_message(db: AsyncSession, message_id: int) -> bool:
    message = await db.get(ContactMessage, message_id)
    if message is None:
        return False
    await db.delete(message)
    await db.commit()
    return True


async def list_packages(db: AsyncSession, active_only: bool = False) -> list[ProPackage]:
    statement = select(ProPackage).order_by(ProPackage.sort_order, ProPackage.id)
    if active_only:
        statement = statement.where(ProPackage.is_active)
    result = await db.execute(statement)
    return list(result.scalars().all())


async def delete_package(db: AsyncSession, package: ProPackage) -> None:
    await db.delete(package)
    await db.commit()


async def txid_taken(db: AsyncSession, txid: str) -> bool:
    result = await db.execute(select(ProOrder).where(func.lower(ProOrder.txid) == txid.lower()))
    return result.scalars().first() is not None


async def list_orders(db: AsyncSession, limit: int = 200) -> list[ProOrder]:
    result = await db.execute(select(ProOrder).order_by(ProOrder.id.desc()).limit(limit))
    return list(result.scalars().all())


async def set_order_status(db: AsyncSession, order_id: int, status: str) -> ProOrder | None:
    order = await db.get(ProOrder, order_id)
    if order is None:
        return None
    order.status = status
    if order.license_key:
        license = await db.get(LicenseKey, order.license_key)
        if license is not None:
            license.is_active = status == "completed"
    await db.commit()
    await db.refresh(order)
    return order


async def valid_api_key(db: AsyncSession, key: str) -> ApiKey | None:
    row = await db.get(ApiKey, key)
    if row is None or not row.is_active:
        return None
    return row


async def create_api_key(db: AsyncSession, label: str | None) -> ApiKey:
    import secrets

    row = ApiKey(key=f"VDDEV-{secrets.token_hex(8).upper()}", label=label, is_active=True)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def list_api_keys(db: AsyncSession, limit: int = 200) -> list[ApiKey]:
    result = await db.execute(select(ApiKey).order_by(ApiKey.created_at.desc()).limit(limit))
    return list(result.scalars().all())


async def delete_order(db: AsyncSession, order_id: int) -> bool:
    order = await db.get(ProOrder, order_id)
    if order is None:
        return False
    await db.delete(order)
    await db.commit()
    return True
