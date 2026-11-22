import logging
import uuid

import httpx

from ..crud import create_job
from ..models import DownloadJob, utcnow

logger = logging.getLogger(__name__)


async def create_download_job(db, resource: str, audio_only: bool = False, quality: str | None = None) -> DownloadJob:
    job = DownloadJob(id=str(uuid.uuid4()), resource=resource, audio_only=audio_only, quality=quality, status="pending")
    return await create_job(db, job)


async def finalize_job(job_id: str, state: dict) -> None:
    """Runs in its own session after the response is fully sent."""
    from ..database import session_maker

    async with session_maker()() as session:
        job = await session.get(DownloadJob, job_id)
        if not job:
            logger.warning("finalize_job: job %s disappeared", job_id)
            return
        job.bytes_transferred = state.get("bytes", 0)
        job.error = state.get("error")
        job.status = "failed" if state.get("error") else "completed"
        job.finished_at = utcnow()
        await session.commit()


async def finish_stream(job_id: str, state: dict, client: httpx.AsyncClient) -> None:
    try:
        await client.aclose()
    finally:
        await finalize_job(job_id, state)
