"""Developer API (v1). Authenticated with an API key created in the admin panel."""

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud import valid_api_key
from ..database import get_db
from ..models import utcnow
from ..providers.ytdlp import pick_entry, sanitize_filename, summarize
from .videos import _direct_format, _extract_entry, _subtitle_tracks

router = APIRouter(prefix="/api/v1", tags=["developer-api"])


async def require_api_key(x_api_key: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    if not x_api_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="API key required via the X-API-Key header")
    key = await valid_api_key(db, x_api_key)
    if key is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or inactive API key")
    key.last_used_at = utcnow()
    await db.commit()
    return key


@router.get("/info", dependencies=[Depends(require_api_key)])
async def api_info(url: str = Query(min_length=8, max_length=1024)):
    info = await _extract_entry(url)
    entry = pick_entry(info)
    return {**summarize(info), "subtitles": _subtitle_tracks(entry)}


@router.get("/direct", dependencies=[Depends(require_api_key)])
async def api_direct(
    request: Request,
    url: str = Query(min_length=8, max_length=1024),
    quality: str = Query(default=""),
):
    info = await _extract_entry(url)
    entry = pick_entry(info)
    fmt = _direct_format(entry, quality)
    if fmt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="no direct format available")
    ext = fmt.get("ext") or entry.get("ext") or "mp4"
    resolved_quality = "audio"
    if (quality or "").strip().lower() != "audio":
        resolved_quality = f"{fmt['height']}p" if fmt.get("height") else (quality or "best")
    return {
        "direct": True,
        "url": fmt["url"],
        "ext": ext,
        "quality": resolved_quality,
        "filesize": fmt.get("filesize") or fmt.get("filesize_approx"),
        "filename": f"{sanitize_filename(entry.get('title') or 'video')}.{ext}",
    }
