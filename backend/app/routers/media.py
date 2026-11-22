import asyncio
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..crud import valid_license
from ..database import get_db
from ..providers import VideoResolutionError
from ..providers.ytdlp import extract_info_sync
from ..security import UnsafeUrlError, assert_public_url

router = APIRouter(prefix="/api", tags=["media"])


def _extract_playlist_sync(url: str, timeout: int) -> dict:
    import yt_dlp

    options = {
        "extract_flat": "in_playlist",
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "socket_timeout": timeout,
    }
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=False)
        return ydl.sanitize_info(info) if info else {}


@router.get("/playlist")
async def playlist(
    request: Request,
    url: str = Query(min_length=8, max_length=1024),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
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
            lambda: _extract_playlist_sync(url, get_settings().provider_default_timeout),
        )
    except VideoResolutionError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"playlist extraction failed: {type(exc).__name__}: {exc}"[:500],
        )

    raw_entries = info.get("entries")
    if not isinstance(raw_entries, list) or not raw_entries:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="not a playlist url")

    license = await valid_license(db, request.headers.get("x-user-key") or "")
    effective_limit = limit if license else min(limit, get_settings().free_playlist_items)

    items = []
    for entry in raw_entries[:effective_limit]:
        if not entry:
            continue
        items.append(
            {
                "title": entry.get("title"),
                "duration": entry.get("duration"),
                "thumbnail": entry.get("thumbnail"),
                "url": entry.get("webpage_url") or entry.get("url"),
            }
        )
    if not items:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="playlist contained no entries")

    total_count = info.get("playlist_count") or len(raw_entries)
    return {
        "title": info.get("title"),
        "count": len(items),
        "total_count": total_count,
        "pro_required": total_count > effective_limit and len(items) < total_count,
        "items": items,
    }


@router.get("/thumbnail")
async def thumbnail(url: str = Query(min_length=8, max_length=1024), download: bool = False):
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

    entries = info.get("entries")
    entry = entries[0] if isinstance(entries, list) and entries else info
    thumbnail_url = entry.get("thumbnail")
    if not thumbnail_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="no thumbnail found for this video")

    if not thumbnail_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="thumbnail url must start with http(s)://")
    try:
        await asyncio.to_thread(assert_public_url, thumbnail_url)
    except UnsafeUrlError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        try:
            resp = await client.get(thumbnail_url)
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"thumbnail fetch failed: {exc}"[:300])
    if resp.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"thumbnail fetch returned {resp.status_code}")

    media_type = (resp.headers.get("content-type") or "image/jpeg").split(";")[0].strip()
    parsed = urlparse(thumbnail_url)
    name = parsed.path.rstrip("/").split("/")[-1] or "thumbnail"
    if not name.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        name += ".jpg"
    headers = {"cache-control": "public, max-age=3600"}
    if download:
        headers["content-disposition"] = f'attachment; filename="{name}"'
    return Response(content=resp.content, media_type=media_type, headers=headers)
