import asyncio

from fastapi import APIRouter, HTTPException, Query, status

from ..config import get_settings
from ..providers import VideoResolutionError
from ..providers.ytdlp import extract_info_sync, summarize

router = APIRouter(prefix="/api/info", tags=["video-info"])


@router.get("")
async def video_info(url: str = Query(min_length=8, max_length=1024)):
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="url must start with http(s)://")

    loop = asyncio.get_running_loop()
    try:
        info = await loop.run_in_executor(
            None,
            lambda: extract_info_sync(url, get_settings().provider_default_timeout),
        )
    except VideoResolutionError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"extraction failed: {type(exc).__name__}: {exc}"[:500],
        )
    return summarize(info)
