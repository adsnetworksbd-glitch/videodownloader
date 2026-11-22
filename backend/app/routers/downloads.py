import asyncio
import json
import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse, StreamingResponse
from starlette.background import BackgroundTask
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..crud import list_jobs, valid_license
from ..database import get_db
from ..models import DownloadJob, utcnow
from ..provider_manager import AllProvidersFailedError, NoProviderError, UnknownAdapterError, manager
from ..schemas import DownloadCreate, DownloadJobOut
from ..security import UnsafeUrlError, assert_public_url
from ..services.download_service import create_download_job, finish_stream
from ..services.video_service import has_video_provider, schedule_video_download, set_job_cookies

router = APIRouter(prefix="/api/downloads", tags=["downloads"])

_daily_counts: dict[str, tuple[str, int]] = {}


def _check_daily_limit(request: Request, limit: int) -> tuple[str, str]:
    if limit <= 0:
        return ("ip", "")
    ip = request.client.host if request.client else "unknown"
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    entry = _daily_counts.get(ip)
    count = entry[1] if entry and entry[0] == today else 0
    if count >= limit:
        kind = "pro" if limit == get_settings().pro_daily_limit else "free"
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Your Pro limit of {limit} downloads per day is reached. Try again tomorrow."
                if kind == "pro"
                else f"Daily free limit of {limit} downloads reached. Go Pro for 1000/day or try again tomorrow."
            ),
        )
    _daily_counts[ip] = (today, count + 1)
    return (ip, today)


async def _get_job(db: AsyncSession, job_id: str) -> DownloadJob:
    job = await db.get(DownloadJob, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="download job not found")
    return job


@router.post("", response_model=DownloadJobOut, status_code=status.HTTP_201_CREATED)
async def create_download(data: DownloadCreate, request: Request, db: AsyncSession = Depends(get_db)):
    license = await valid_license(db, request.headers.get("x-user-key") or "")
    settings = get_settings()
    limit = settings.pro_daily_limit if license else settings.free_daily_limit
    _check_daily_limit(request, limit)
    if data.resource.startswith(("http://", "https://")):
        try:
            await asyncio.to_thread(assert_public_url, data.resource)
        except UnsafeUrlError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    job = await create_download_job(db, data.resource, audio_only=data.audio_only, quality=data.quality)

    chain = await manager.get_active_chain(db)
    if has_video_provider([p for p, _ in chain]) and data.resource.startswith(("http://", "https://")):
        job.status = "queued"
        job.started_at = utcnow()
        await db.commit()
        set_job_cookies(job.id, data.cookies or "")
        schedule_video_download(job.id)
    return job


@router.get("", response_model=list[DownloadJobOut])
async def history(limit: int = 50, db: AsyncSession = Depends(get_db)):
    return await list_jobs(db, limit=min(max(limit, 1), 200))


@router.get("/{job_id}", response_model=DownloadJobOut)
async def read_job(job_id: str, db: AsyncSession = Depends(get_db)):
    return await _get_job(db, job_id)


@router.get("/{job_id}/file")
async def stream_file(job_id: str, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    job = await _get_job(db, job_id)

    if job.file_path and os.path.exists(job.file_path):
        if job.filename is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="download_in_progress")
        if job.status != "completed":
            job.status = "completed"
            job.finished_at = job.finished_at or utcnow()
            await db.commit()
        return FileResponse(
            job.file_path,
            media_type=job.content_type or "application/octet-stream",
            filename=job.filename,
        )

    if job.status in ("queued", "downloading"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="download_in_progress")
    if job.status == "failed":
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=(job.error or "download failed")[:500])
    if job.status == "completed" and job.bytes_transferred > 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="job already completed; create a new download")

    job.status = "streaming"
    job.started_at = utcnow()
    await db.commit()

    client = httpx.AsyncClient(follow_redirects=True)
    try:
        provider, meta, video_stream, attempts = await manager.stream_with_fallback(db, job.resource, client)
    except (NoProviderError, AllProvidersFailedError, UnknownAdapterError):
        await client.aclose()
        job.status = "failed"
        job.finished_at = utcnow()
        await db.commit()
        raise
    except Exception:
        await client.aclose()
        raise

    job.status = "streaming"
    job.provider_id = provider.id
    job.content_type = meta.content_type
    job.content_length = meta.content_length
    job.provider_attempts = json.dumps(
        [{"provider": a.provider_name, "ok": a.ok, "error": a.error} for a in attempts]
    )
    await db.commit()

    state = {"bytes": 0, "error": None}

    async def generator():
        try:
            async for chunk in video_stream:
                state["bytes"] += len(chunk)
                yield chunk
        except Exception as exc:
            state["error"] = f"stream interrupted: {type(exc).__name__}: {exc}"[:2000]

    return StreamingResponse(
        generator(),
        headers=build_response_headers(job.resource, meta.content_type, meta.filename),
        background=BackgroundTask(finish_stream, job.id, state, client),
    )


def build_response_headers(resource: str, content_type: str | None, filename: str | None) -> dict:
    name = filename or resource.rstrip("/").split("/")[-1] or "download"
    return {
        "Content-Type": content_type if content_type else "application/octet-stream",
        "Content-Disposition": f'attachment; filename="{name}"',
        "Accept-Ranges": "none",
    }
