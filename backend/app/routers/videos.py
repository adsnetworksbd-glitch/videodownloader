import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..crud import is_banned
from ..database import get_db
from ..deps import client_ip
from ..providers import VideoResolutionError
from ..providers.ytdlp import extract_info_sync, pick_entry, sanitize_filename, summarize
from ..security import UnsafeUrlError, assert_public_url

router = APIRouter(prefix="/api/info", tags=["video-info"])


def _format_size(fmt: dict) -> int:
    return fmt.get("filesize") or fmt.get("filesize_approx") or 0


def _direct_format(entry: dict, quality: str) -> dict | None:
    """Pick a single self-contained (video+audio) format the browser can fetch
    straight from the CDN, so the server never proxies the media bytes.
    Returns None when only separate video/audio tracks exist (needs server merge)."""
    raw_formats = entry.get("formats") or []
    wanted = (quality or "").strip().lower()
    is_audio = wanted == "audio"

    if is_audio:
        audio_only = [
            f
            for f in raw_formats
            if f.get("vcodec") == "none" and f.get("acodec") not in (None, "none") and f.get("url")
        ]
        if audio_only:
            return max(audio_only, key=lambda f: (f.get("abr") or 0, _format_size(f)))
        if not raw_formats and entry.get("url") and entry.get("vcodec") == "none":
            return entry
        return None

    height_limit = None
    digits = wanted.removesuffix("p")
    if digits.isdigit():
        height_limit = int(digits)

    combined = [
        f
        for f in raw_formats
        if f.get("vcodec") not in (None, "none")
        and f.get("acodec") not in (None, "none")
        and f.get("url")
    ]
    if height_limit is not None:
        combined = [f for f in combined if f.get("height") and int(f["height"]) <= height_limit]
    if combined:
        return max(combined, key=lambda f: (f.get("height") or 0, _format_size(f)))
    if not raw_formats and entry.get("url") and entry.get("vcodec") not in (None, "none"):
        if height_limit is None or (entry.get("height") and int(entry["height"]) <= height_limit):
            return entry
    return None


@router.get("")
async def video_info(url: str = Query(min_length=8, max_length=1024)):
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="url must start with http(s)://")
    try:
        await asyncio.to_thread(assert_public_url, url)
    except UnsafeUrlError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

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


@router.get("/direct")
async def direct_link(
    request: Request,
    url: str = Query(min_length=8, max_length=1024),
    quality: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
):
    """Resolve a direct CDN link so the browser downloads from the source and
    the server spend zero media bandwidth. 404 = no self-contained format;
    the client should fall back to the server-side job flow."""
    ip = client_ip(request)
    if await is_banned(db, ip):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your access is restricted.")
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="url must start with http(s)://")
    try:
        await asyncio.to_thread(assert_public_url, url)
    except UnsafeUrlError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

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
        "filename": f"{sanitize_filename(info.get('title') or 'video')}.{ext}",
    }
