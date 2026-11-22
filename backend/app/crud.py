import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import DownloadJob, LicenseKey, Provider, utcnow
from .schemas import ProviderCreate, ProviderUpdate


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
