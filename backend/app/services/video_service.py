import asyncio
import glob
import json
import os
import tempfile
from datetime import datetime, timezone

from ..config import get_settings
from ..crud import list_providers
from ..database import session_maker
from ..models import DownloadJob, Provider, utcnow

BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

_ytdlp_sema: asyncio.Semaphore | None = None
_inflight: set[str] = set()


def _semaphore() -> asyncio.Semaphore:
    global _ytdlp_sema
    if _ytdlp_sema is None:
        _ytdlp_sema = asyncio.Semaphore(get_settings().video_concurrent_downloads)
    return _ytdlp_sema


def _format_for(quality: str | None) -> str:
    default = get_settings().ytdlp_format
    if not quality:
        return default
    normalized = str(quality).strip().lower().removesuffix("p")
    if not normalized.isdigit():
        return default
    height = int(normalized)
    return (
        f"bestvideo[height<={height}][ext=mp4]+bestaudio[ext=m4a]/"
        f"bestvideo[height<={height}]+bestaudio/best[height<={height}]/best"
    )


def ytdlp_download_sync(job_id: str, resource: str, provider: Provider, jobs_dir: str, audio_only: bool, progress_cb, quality=None) -> dict:
    """Blocking yt-dlp download. Returns {"filepath", "filename"}. progress_cb(done, total) is thread-safe."""
    import yt_dlp

    def hook(data):
        if data.get("status") == "downloading":
            done = data.get("downloaded_bytes") or 0
            total = data.get("total_bytes") or data.get("total_bytes_estimate") or 0
            try:
                progress_cb(done, total)
            except Exception:
                pass

    options = {
        "format": "bestaudio/best" if audio_only else _format_for(quality),
        "outtmpl": {"default": os.path.join(jobs_dir, f"{job_id}.%(ext)s")},
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "socket_timeout": provider.timeout_seconds,
        "concurrent_fragment_downloads": 4,
        "progress_hooks": [hook],
        "extractor_args": {"youtube": {"player_client": ["android", "web"]}},
        "merge_output_format": "mp4",
    }
    if audio_only:
        options["postprocessors"] = [
            {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}
        ]
    if provider.cookies:
        cookie_file = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False)
        cookie_file.write(provider.cookies)
        cookie_file.close()
        options["cookiefile"] = cookie_file.name

    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(resource, download=True)
            filepath = info.get("filepath") or ydl.prepare_filename(info)
            title = info.get("title") or "video"
    finally:
        if provider.cookies and options.get("cookiefile"):
            try:
                os.unlink(options["cookiefile"])
            except OSError:
                pass

    if not filepath or not os.path.exists(filepath):
        candidates = sorted(glob.glob(os.path.join(jobs_dir, f"{job_id}.*")))
        if not candidates:
            raise RuntimeError("yt-dlp finished but produced no file")
        filepath = candidates[-1]
        title = "video"
    return {"filepath": filepath, "filename": os.path.basename(filepath), "title": title}


def _safe_progress(job_id: str, loop: asyncio.AbstractEventLoop):
    last = {"at": 0.0, "bytes": -1}

    def progress(done: int, total: int) -> None:
        import time

        now = time.monotonic()
        if done == last["bytes"] or (now - last["at"] < 0.5 and done != total):
            return
        last["bytes"] = done
        last["at"] = now
        asyncio.run_coroutine_threadsafe(_update_progress(job_id, done, total), loop)

    return progress


async def _update_progress(job_id: str, done: int, total: int) -> None:
    session_maker_ = session_maker()
    async with session_maker_() as session:
        job = await session.get(DownloadJob, job_id)
        if job is None or job.status != "downloading":
            return
        job.bytes_transferred = int(done)
        job.content_length = int(total) if total else job.content_length
        await session.commit()


async def _set_fields(job_id: str, **fields) -> None:
    session_maker_ = session_maker()
    async with session_maker_() as session:
        job = await session.get(DownloadJob, job_id)
        if job is None:
            return
        for key, value in fields.items():
            setattr(job, key, value)
        await session.commit()


def has_video_provider(providers: list[Provider]) -> bool:
    return any(p.adapter == "ytdlp" for p in providers)


def schedule_video_download(job_id: str) -> None:
    asyncio.get_running_loop().create_task(run_video_download(job_id))


async def run_video_download(job_id: str) -> None:
    if job_id in _inflight:
        return
    _inflight.add(job_id)
    try:
        async with _semaphore():
            await _download_with_fallback(job_id)
    finally:
        _inflight.discard(job_id)


async def _download_with_fallback(job_id: str) -> None:
    session_maker_ = session_maker()
    async with session_maker_() as session:
        job = await session.get(DownloadJob, job_id)
        if job is None:
            return
        audio_only = job.audio_only
        quality = job.quality
        providers = [p for p in await list_providers(session, include_inactive=False) if p.adapter == "ytdlp"]
        if not providers:
            job.status = "failed"
            job.error = "no video providers configured"
            job.finished_at = utcnow()
            await session.commit()
            return
        job.status = "downloading"
        job.started_at = job.started_at or utcnow()
        await session.commit()
        resource = job.resource

    loop = asyncio.get_running_loop()
    settings = get_settings()
    jobs_dir = os.path.abspath(settings.download_dir)
    os.makedirs(jobs_dir, exist_ok=True)

    attempts = []
    for provider in providers:
        try:
            result = await asyncio.to_thread(
                ytdlp_download_sync,
                job_id,
                resource,
                provider,
                jobs_dir,
                audio_only,
                _safe_progress(job_id, loop),
                quality,
            )
        except Exception as exc:
            message = f"{type(exc).__name__}: {exc}"[:500]
            attempts.append({"provider": provider.name, "ok": False, "error": message})
            await _set_fields(job_id, provider_id=provider.id, provider_attempts=json.dumps(attempts))
            await _provider_status(provider.id, "down")
            continue

        size = os.path.getsize(result["filepath"])
        ext = os.path.splitext(result["filename"])[1].lstrip(".").lower()
        content_type = "audio/mpeg" if ext == "mp3" else "audio/mp4" if ext == "m4a" else "video/mp4" if ext == "mp4" else None
        attempts.append({"provider": provider.name, "ok": True, "error": None})
        await _set_fields(
            job_id,
            status="ready",
            provider_id=provider.id,
            provider_attempts=json.dumps(attempts),
            file_path=result["filepath"],
            filename=_display_filename(result.get("title") or "video", result["filepath"]),
            content_type=content_type,
            content_length=size,
            bytes_transferred=size,
            error=None,
            finished_at=utcnow(),
        )
        await _provider_status(provider.id, "up")
        return

    await _set_fields(
        job_id,
        status="failed",
        error="; ".join(a["error"] or "unknown" for a in attempts)[:2000],
        finished_at=utcnow(),
    )


def _display_filename(title: str, filepath: str) -> str:
    from ..providers.ytdlp import sanitize_filename

    ext = os.path.splitext(filepath)[1]
    return f"{sanitize_filename(title)}{ext}"


async def _provider_status(provider_id: int, status: str) -> None:
    session_maker_ = session_maker()
    async with session_maker_() as session:
        provider = await session.get(Provider, provider_id)
        if provider is None:
            return
        provider.last_status = status
        provider.last_checked_at = datetime.now(timezone.utc)
        await session.commit()


async def cleanup_stuck_jobs() -> None:
    """On startup, jobs left mid-flight by a restart can never finish."""
    session_maker_ = session_maker()
    async with session_maker_() as session:
        from sqlalchemy import select

        result = await session.execute(
            select(DownloadJob).where(DownloadJob.status.in_(["streaming", "downloading", "queued"]))
        )
        for job in result.scalars().all():
            job.status = "failed"
            job.error = "interrupted by server restart"
            job.finished_at = utcnow()
        await session.commit()
