import os

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..config import get_settings
from ..crud import (
    SETTING_WHITELIST,
    ban_ip,
    delete_message,
    effective_int,
    get_overrides,
    list_banned,
    list_jobs,
    list_licenses,
    list_messages,
    list_providers,
    mark_message_read,
    set_setting,
    unban_ip,
)
from ..database import get_db
from ..deps import require_admin
from ..models import BannedIP, ContactMessage, DownloadJob, Provider, utcnow
from ..schemas import BanIn, BanOut, ContactMessageOut, DownloadJobOut
from ..services.video_service import schedule_video_download
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/admin", tags=["site-admin"], dependencies=[Depends(require_admin)])

_INT_BOUNDS = {"free_daily_limit": 1000000, "pro_daily_limit": 1000000, "free_playlist_items": 500, "rate_limit_requests": 10000, "rate_limit_window": 86400}


@router.get("/settings")
async def read_settings(db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    overrides = await get_overrides(db)
    out: dict[str, str] = {}
    for key, kind in SETTING_WHITELIST.items():
        if kind == "int":
            out[key] = str(await effective_int(db, key, getattr(settings, key)))
        else:
            out[key] = overrides.get(key, "")
    return out


@router.put("/settings")
async def write_settings(payload: dict[str, str], db: AsyncSession = Depends(get_db)):
    updates = {}
    for key, value in payload.items():
        if key not in SETTING_WHITELIST:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown setting: {key}")
        if SETTING_WHITELIST[key] == "int":
            try:
                number = int(str(value))
            except ValueError:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{key} must be an integer")
            if number < 0 or number > _INT_BOUNDS[key]:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{key} must be between 0 and {_INT_BOUNDS[key]}")
            updates[key] = str(number)
        else:
            text = str(value).strip()
            if len(text) > 500:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="notice_message max length is 500")
            updates[key] = text
    for key, value in updates.items():
        await set_setting(db, key, value)
    return {"saved": sorted(updates.keys()), **(await get_overrides(db))}


@router.get("/jobs", response_model=list[DownloadJobOut])
async def jobs(limit: int = Query(default=20, ge=1, le=200), db: AsyncSession = Depends(get_db)):
    return await list_jobs(db, limit=limit)


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(DownloadJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")
    if job.file_path:
        try:
            os.unlink(job.file_path)
        except OSError:
            pass
    await db.delete(job)
    await db.commit()


@router.post("/jobs/{job_id}/retry", response_model=DownloadJobOut)
async def retry_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(DownloadJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")
    if job.status not in ("failed", "ready", "completed"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"job is {job.status}; only failed or finished jobs can be retried")
    job.status = "queued"
    job.error = None
    job.provider_attempts = None
    job.filename = None
    job.content_length = None
    job.bytes_transferred = 0
    if job.file_path:
        try:
            os.unlink(job.file_path)
        except OSError:
            pass
        job.file_path = None
    job.started_at = utcnow()
    job.finished_at = None
    await db.commit()
    schedule_video_download(job.id)
    await db.refresh(job)
    return job


@router.get("/bans", response_model=list[BanOut])
async def bans(db: AsyncSession = Depends(get_db)):
    return await list_banned(db)


@router.post("/bans", response_model=BanOut, status_code=status.HTTP_201_CREATED)
async def add_ban(payload: BanIn, db: AsyncSession = Depends(get_db)):
    return await ban_ip(db, payload.ip.strip(), payload.reason)


@router.delete("/bans/{ip}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_ban(ip: str, db: AsyncSession = Depends(get_db)):
    if not await unban_ip(db, ip):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ban not found")


@router.get("/messages", response_model=list[ContactMessageOut])
async def messages(kind: str | None = Query(default=None, pattern="^(message|pro_order)$"), limit: int = Query(default=100, ge=1, le=200), db: AsyncSession = Depends(get_db)):
    return await list_messages(db, limit=limit, kind=kind)


@router.patch("/messages/{message_id}", response_model=ContactMessageOut)
async def read_message(message_id: int, payload: dict[str, bool], db: AsyncSession = Depends(get_db)):
    message = await mark_message_read(db, message_id, bool(payload.get("is_read", True)))
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="message not found")
    return message


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_message(message_id: int, db: AsyncSession = Depends(get_db)):
    if not await delete_message(db, message_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="message not found")


@router.get("/export")
async def export_data(db: AsyncSession = Depends(get_db)):
    providers = await list_providers(db)
    licenses = await list_licenses(db)
    bans = await list_banned(db)
    return {
        "exported_at": utcnow().isoformat(),
        "providers": [
            {
                "name": provider.name,
                "adapter": provider.adapter,
                "base_url": provider.base_url,
                "has_api_key": provider.api_key is not None,
                "priority": provider.priority,
                "is_active": provider.is_active,
                "timeout_seconds": provider.timeout_seconds,
                "last_status": provider.last_status,
            }
            for provider in providers
        ],
        "licenses": [
            {"key": license.key, "plan": license.plan, "note": license.note, "is_active": license.is_active, "expires_at": license.expires_at.isoformat() if license.expires_at else None}
            for license in licenses
        ],
        "bans": [{"ip": ban.ip, "reason": ban.reason} for ban in bans],
        "settings": await get_overrides(db),
    }
