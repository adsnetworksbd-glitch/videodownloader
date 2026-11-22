import os

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..config import get_settings
from ..crud import SETTING_WHITELIST, effective_int, get_overrides, list_jobs, set_setting
from ..database import get_db
from ..deps import require_admin
from ..models import DownloadJob, utcnow
from ..schemas import DownloadJobOut
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
