import asyncio
import logging
import os

import httpx

from ..config import get_settings
from ..crud import get_overrides, list_providers
from ..database import session_maker
from ..models import DownloadJob, utcnow
from . import video_service as vs

log = logging.getLogger(__name__)
API = "https://api.telegram.org"
MAX_TG_BYTES = 49 * 1024 * 1024


def extract_url(text: str) -> str | None:
    for word in (text or "").split():
        if word.startswith(("http://", "https://")):
            return word
    return None


def welcome_text() -> str:
    return (
        "Welcome to VideoDownloader Bot!"
        "\nSend me any video link (YouTube, TikTok, Facebook...) and I will download it for you."
        "\n\n/start - welcome message"
        "\n/help - how to use"
    )


async def _post(client: httpx.AsyncClient, token: str, method: str, **payload) -> dict:
    resp = await client.post(f"{API}/bot{token}/{method}", json=payload)
    data = resp.json()
    if not data.get("ok"):
        log.warning("telegram %s failed: %s", method, data)
    return data


async def _run_job(url: str) -> DownloadJob | None:
    maker = session_maker()
    async with maker() as session:
        providers = [p for p in await list_providers(session, include_inactive=False) if p.adapter == "ytdlp"]
        if not providers:
            return None
        job = DownloadJob(resource=url, status="queued", started_at=utcnow())
        session.add(job)
        await session.commit()
        await session.refresh(job)
        job_id = job.id
    await vs.run_video_download(job_id)
    async with maker() as session:
        return await session.get(DownloadJob, job_id)


async def _send_file(client: httpx.AsyncClient, token: str, chat_id, job: DownloadJob) -> None:
    size = job.content_length or (os.path.getsize(job.file_path) if job.file_path else 0)
    if not job.file_path or not os.path.exists(job.file_path) or int(size) > MAX_TG_BYTES:
        await _post(client, token, "sendMessage", chat_id=chat_id, text=("File is ready but too large for Telegram. Open the site from your server to grab it."))
        return
    with open(job.file_path, "rb") as fh:
        resp = await client.post(
            f"{API}/bot{token}/sendDocument",
            data={"chat_id": str(chat_id), "caption": job.filename or ""},
            files={"document": (job.filename or "video.mp4", fh)},
        )
        data = resp.json()
    if not data.get("ok"):
        await _post(client, token, "sendMessage", chat_id=chat_id, text=("Could not upload the file. It is saved on the server: " + (job.filename or "")))


async def handle_update(token: str, update: dict, client: httpx.AsyncClient) -> None:
    message = update.get("message") or {}
    chat_id = (message.get("chat") or {}).get("id")
    text = message.get("text") or ""
    if chat_id is None:
        return
    if text.startswith("/"):
        reply = welcome_text() if text in ("/start", "/help") else "Unknown command. Send a video link instead."
        await _post(client, token, "sendMessage", chat_id=chat_id, text=reply)
        return
    url = extract_url(text)
    if not url:
        await _post(client, token, "sendMessage", chat_id=chat_id, text="Please send a valid video link starting with http(s)://")
        return
    await _post(client, token, "sendMessage", chat_id=chat_id, text="Link received, working on it...")
    try:
        job = await _run_job(url)
    except Exception as exc:
        log.exception("telegram job failed")
        await _post(client, token, "sendMessage", chat_id=chat_id, text=f"Download failed: {type(exc).__name__}: {exc}"[:400])
        return
    if job is None or job.status == "failed":
        detail = job.error if job and job.error else "no video providers configured"
        await _post(client, token, "sendMessage", chat_id=chat_id, text=f"Download failed: {detail}"[:400])
        return
    await _send_file(client, token, chat_id, job)


async def poll_forever() -> None:
    token = get_settings().telegram_bot_token
    if not token:
        return
    offset = 0
    async with httpx.AsyncClient(timeout=45) as client:
        while True:
            try:
                resp = await client.get(f"{API}/bot{token}/getUpdates", params={"timeout": 30, "offset": offset, "allowed_updates": '["message"]'})
                resp.raise_for_status()
                data = resp.json()
            except Exception:
                await asyncio.sleep(5)
                continue
            for update in data.get("result", []):
                offset = max(offset, int(update.get("update_id", 0)) + 1)
                try:
                    await handle_update(token, update, client)
                except Exception:
                    log.exception("telegram update handling failed")


def start_bot_task() -> asyncio.Task | None:
    if not get_settings().telegram_bot_token:
        return None
    return asyncio.get_running_loop().create_task(poll_forever())


async def send_admin_alert(text: str) -> None:
    """Notify the admin Telegram chat (best effort, never raises)."""
    token = get_settings().telegram_bot_token
    if not token:
        return
    async with session_maker() as session:
        overrides = await get_overrides(session)
    chat_id = (overrides.get("telegram_alert_chat_id") or "").strip()
    if not chat_id:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await _post(client, token, "sendMessage", chat_id=chat_id, text=text[:3500])
    except Exception:
        log.warning("telegram admin alert failed", exc_info=True)
