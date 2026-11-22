from urllib.parse import urlparse

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud import get_overrides, list_jobs, list_providers
from ..database import get_db
from ..deps import require_admin
from ..models import DownloadJob
from .catalog import total_sites

public_router = APIRouter(prefix="/api/stats", tags=["stats"])
admin_router = APIRouter(prefix="/api/admin", tags=["admin-stats"], dependencies=[Depends(require_admin)])

_BAD_HOSTS = ("localhost", "127.", "10.", "192.168.", "169.254.", "[::1]")


def _host_of(url: str) -> str | None:
    try:
        host = urlparse(url).hostname
    except ValueError:
        return None
    if not host or host.lower().startswith(_BAD_HOSTS) or ".local" in host.lower():
        return None
    return host.lower()


@public_router.get("/public")
async def public_stats(db: AsyncSession = Depends(get_db)):
    completed_result = await db.execute(
        select(func.count(DownloadJob.id)).where(DownloadJob.status.in_(["completed", "ready"]))
    )
    total_downloads = int(completed_result.scalar() or 0)

    providers = await list_providers(db, include_inactive=False)
    up = sum(1 for p in providers if p.last_status == "up")

    trending: dict[str, int] = {}
    jobs = await list_jobs(db, limit=1000)
    for job in jobs:
        if job.status not in ("completed", "ready"):
            continue
        host = _host_of(job.resource)
        if host:
            trending[host] = trending.get(host, 0) + 1
    top = sorted(trending.items(), key=lambda kv: -kv[1])[:5]

    return {
        "total_sites": total_sites(),
        "total_downloads": total_downloads,
        "providers_active": len(providers),
        "providers_up": up,
        "trending": [{"domain": domain, "downloads": count} for domain, count in top],
    }


@public_router.get("/notice")
async def site_notice(db: AsyncSession = Depends(get_db)):
    overrides = await get_overrides(db)
    return {"message": (overrides.get("notice_message") or "").strip()}


@admin_router.get("/stats")
async def admin_stats(db: AsyncSession = Depends(get_db)):
    jobs = await list_jobs(db, limit=500)
    from collections import Counter

    status_counts = Counter(job.status for job in jobs)
    total_result = await db.execute(select(func.count(DownloadJob.id)))
    statuses = {
        status: int(status_counts.get(status, 0))
        for status in ("completed", "ready", "failed", "downloading", "queued", "streaming", "pending")
    }
    providers = await list_providers(db, include_inactive=True)

    return {
        "jobs_total": int(total_result.scalar() or 0),
        "statuses": statuses,
        "active_downloads": sum(statuses[s] for s in ("queued", "downloading", "streaming")),
        "providers_total": len(providers),
        "providers_up": sum(1 for p in providers if p.last_status == "up"),
        "providers_down": sum(1 for p in providers if p.last_status == "down"),
        "trending": _trending(jobs),
    }


def _trending(jobs):
    trending: dict[str, int] = {}
    for job in jobs:
        if job.status not in ("completed", "ready"):
            continue
        host = _host_of(job.resource)
        if host:
            trending[host] = trending.get(host, 0) + 1
    top = sorted(trending.items(), key=lambda kv: -kv[1])[:10]
    return [{"domain": domain, "downloads": count} for domain, count in top]
