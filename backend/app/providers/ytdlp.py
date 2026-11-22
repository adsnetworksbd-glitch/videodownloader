import asyncio
import re
from collections.abc import AsyncIterator
from functools import partial

import httpx

from ..config import get_settings
from ..models import Provider
from .base import ProviderAdapter, UpstreamResponse


class VideoResolutionError(ValueError):
    """Raised when yt-dlp cannot resolve a downloadable media URL."""


VIDEO_MIME = {
    "mp4": "video/mp4",
    "webm": "video/webm",
    "mkv": "video/x-matroska",
    "m4a": "audio/mp4",
    "mp3": "audio/mpeg",
    "opus": "audio/ogg",
}

BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"


def sanitize_filename(name: str, fallback: str = "video") -> str:
    cleaned = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "", name or "").strip().strip(".")
    return (cleaned or fallback)[:150]


def extract_info_sync(url: str, timeout: int, fmt: str | None = None) -> dict:
    import yt_dlp

    options = {
        "format": fmt or get_settings().ytdlp_format,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "socket_timeout": timeout,
        "extractor_args": {"youtube": {"player_client": ["android", "web"]}},
    }
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=False)
        if info is None:
            raise VideoResolutionError(f"no media found for {url}")
        return ydl.sanitize_info(info)


def pick_entry(info: dict) -> dict:
    entries = info.get("entries")
    if isinstance(entries, list):
        for entry in entries:
            if entry and entry.get("url"):
                return entry
        raise VideoResolutionError("playlist contained no downloadable media")
    return info


def summarize(info: dict) -> dict:
    entry = pick_entry(info)
    return {
        "title": entry.get("title"),
        "uploader": entry.get("uploader") or entry.get("channel"),
        "duration": entry.get("duration"),
        "thumbnail": entry.get("thumbnail"),
        "platform": entry.get("extractor_key") or entry.get("extractor"),
        "webpage_url": entry.get("webpage_url"),
        "ext": entry.get("ext"),
        "filesize": entry.get("filesize") or entry.get("filesize_approx"),
        **available_formats(entry),
    }


def available_formats(entry: dict) -> dict:
    raw_formats = entry.get("formats") or []
    if not raw_formats and entry.get("height"):
        raw_formats = [entry]
    best: dict[int, dict] = {}
    audio_only = False
    for fmt in raw_formats:
        if fmt.get("vcodec") == "none":
            if fmt.get("acodec") not in (None, "none"):
                audio_only = True
            continue
        height = fmt.get("height")
        if not height:
            continue
        height = int(height)
        size = fmt.get("filesize") or fmt.get("filesize_approx") or 0
        current = best.get(height)
        if current is None or size > (current.get("filesize") or 0):
            best[height] = {
                "quality": f"{height}p",
                "ext": fmt.get("ext"),
                "filesize": fmt.get("filesize") or fmt.get("filesize_approx"),
                "fps": fmt.get("fps"),
                "has_audio": fmt.get("acodec") not in (None, "none"),
            }
    formats = [best[height] for height in sorted(best, reverse=True)]
    return {"formats": formats, "audio_only_available": audio_only or bool(formats) or bool(entry.get("acodec") not in (None, "none"))}


class YtDlpAdapter(ProviderAdapter):
    """Resolves a video/audio page URL into a direct media stream via yt-dlp.

    ``base_url`` is unused for this adapter. Extraction runs in a thread so the
    event loop stays free; the media URL is only fetched when ``stream`` runs.
    """

    type_name = "ytdlp"

    def __init__(self, provider: Provider):
        super().__init__(provider)
        self._media_url: str | None = None
        self._filename: str | None = None
        self._content_type: str | None = None

    async def open(self, resource: str, client: httpx.AsyncClient) -> UpstreamResponse:
        loop = asyncio.get_running_loop()
        timeout = self.provider.timeout_seconds
        try:
            info = await asyncio.wait_for(
                loop.run_in_executor(None, partial(extract_info_sync, resource, timeout)),
                timeout=timeout + 30,
            )
        except asyncio.TimeoutError as exc:
            raise VideoResolutionError(f"yt-dlp timed out after {timeout}s") from exc
        except VideoResolutionError:
            raise
        except Exception as exc:
            raise VideoResolutionError(f"yt-dlp failed: {type(exc).__name__}: {exc}"[:500]) from exc

        entry = pick_entry(info)
        media_url = entry.get("url")
        if not media_url or not str(media_url).startswith(("http://", "https://")):
            raise VideoResolutionError("extractor returned no direct media URL")

        ext = entry.get("ext") or "mp4"
        title = entry.get("title") or "video"
        self._media_url = str(media_url)
        self._content_type = VIDEO_MIME.get(ext, "video/mp4")
        self._filename = f"{sanitize_filename(title)}.{ext}"
        return UpstreamResponse(
            content_type=self._content_type,
            content_length=entry.get("filesize") or entry.get("filesize_approx"),
            filename=self._filename,
        )

    def _headers(self) -> dict[str, str]:
        headers = {"User-Agent": BROWSER_UA}
        if self.provider.extra_headers:
            try:
                import json

                headers.update(json.loads(self.provider.extra_headers))
            except (ValueError, TypeError):
                pass
        return headers

    async def stream(self, client: httpx.AsyncClient) -> AsyncIterator[bytes]:
        assert self._media_url is not None
        request = client.build_request(
            "GET",
            self._media_url,
            headers=self._headers(),
            timeout=httpx.Timeout(self.provider.timeout_seconds, read=None),
        )
        response = await client.send(request, stream=True)
        try:
            response.raise_for_status()
            async for chunk in response.aiter_bytes():
                yield chunk
        finally:
            await response.aclose()

    async def health_check(self, client: httpx.AsyncClient) -> bool:
        return True
