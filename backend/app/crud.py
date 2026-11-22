import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import DownloadJob, Provider
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
