"""Tests for the server-side full-download video flow."""
import asyncio
import os

from app.models import Provider
from app.services import video_service as vs
AUTH = {"X-Admin-Token": "test-token"}


def make_ytdlp_provider():
    return {"name": "vid", "adapter": "ytdlp", "base_url": "", "priority": 1, "timeout_seconds": 10}


async def _wait_for_status(client, job_id, statuses, timeout=5.0):
    for _ in range(int(timeout * 20)):
        await asyncio.sleep(0.05)
        job = (await client.get(f"/api/downloads/{job_id}")).json()
        if job["status"] in statuses:
            return job
    return job


async def test_video_job_downloads_to_ready_and_serves(client, tmp_path, monkeypatch):
    out_dir = tmp_path / "dl"

    def fake_download(job_id, resource, provider, jobs_dir, audio_only, progress_cb, quality=None):
        os.makedirs(jobs_dir, exist_ok=True)
        path = os.path.join(jobs_dir, f"{job_id}.mp4")
        with open(path, "wb") as fh:
            fh.write(b"FAKE-MP4-BYTES")
        progress_cb(7, 14)
        return {"filepath": path, "filename": os.path.basename(path), "title": 'Video: "Test" <HD>'}

    monkeypatch.setattr(vs, "ytdlp_download_sync", fake_download)

    created = await client.post("/api/admin/providers", headers=AUTH, json=make_ytdlp_provider())
    assert created.status_code == 201

    response = await client.post("/api/downloads", json={"resource": "https://www.youtube.com/watch?v=abc"})
    assert response.status_code == 201
    job = response.json()
    assert job["status"] in ("queued", "downloading", "ready")

    final = await _wait_for_status(client, job["id"], {"ready", "failed"})
    assert final["status"] == "ready", final
    assert final["filename"] == "Video Test HD.mp4"
    assert final["content_length"] == 14
    assert final["bytes_transferred"] == 14

    served = await client.get(f"/api/downloads/{job['id']}/file")
    assert served.status_code == 200
    assert served.content == b"FAKE-MP4-BYTES"
    assert "mp4" in served.headers.get("content-type", "")

    after = await client.get(f"/api/downloads/{job['id']}")
    assert after.json()["status"] == "completed"


async def test_video_job_failure_marks_failed(client, monkeypatch):
    def failing_download(job_id, resource, provider, jobs_dir, audio_only, progress_cb, quality=None):
        raise RuntimeError("upstream exploded")

    monkeypatch.setattr(vs, "ytdlp_download_sync", failing_download)

    await client.post("/api/admin/providers", headers=AUTH, json=make_ytdlp_provider())
    response = await client.post("/api/downloads", json={"resource": "https://youtu.be/xyz"})
    job = response.json()

    final = await _wait_for_status(client, job["id"], {"ready", "failed"})
    assert final["status"] == "failed"
    assert "upstream exploded" in final["error"]

    served = await client.get(f"/api/downloads/{job['id']}/file")
    assert served.status_code == 502

    attempts = __import__("json").loads(final["provider_attempts"])
    assert attempts == [{"provider": "vid", "ok": False, "error": "RuntimeError: upstream exploded"}]


async def test_audio_only_flag_persists(client, monkeypatch):
    audio_jobs = {}

    def fake_download(job_id, resource, provider, jobs_dir, audio_only, progress_cb, quality=None):
        audio_jobs[job_id] = audio_only
        os.makedirs(jobs_dir, exist_ok=True)
        path = os.path.join(jobs_dir, f"{job_id}.mp3")
        open(path, "wb").close()
        return {"filepath": path, "filename": os.path.basename(path), "title": "Song"}

    monkeypatch.setattr(vs, "ytdlp_download_sync", fake_download)
    await client.post("/api/admin/providers", headers=AUTH, json=make_ytdlp_provider())

    job = (await client.post("/api/downloads", json={"resource": "https://youtu.be/song", "audio_only": True})).json()
    final = await _wait_for_status(client, job["id"], {"ready", "failed"})
    assert final["status"] == "ready"
    assert audio_jobs[job["id"]] is True
    assert final["filename"] == "Song.mp3"


async def test_quality_is_persisted_and_passed_to_ytdlp(client, monkeypatch):
    seen = {}

    def fake_download(job_id, resource, provider, jobs_dir, audio_only, progress_cb, quality=None):
        seen[job_id] = (audio_only, quality)
        os.makedirs(jobs_dir, exist_ok=True)
        path = os.path.join(jobs_dir, f"{job_id}.mp4")
        open(path, "wb").close()
        return {"filepath": path, "filename": os.path.basename(path), "title": "Clip"}

    monkeypatch.setattr(vs, "ytdlp_download_sync", fake_download)
    await client.post("/api/admin/providers", headers=AUTH, json=make_ytdlp_provider())

    job = (await client.post("/api/downloads", json={"resource": "https://youtu.be/clip", "quality": "720p"})).json()
    final = await _wait_for_status(client, job["id"], {"ready", "failed"})
    assert final["status"] == "ready"
    assert final["quality"] == "720p"
    assert seen[job["id"]] == (False, "720p")


def test_format_for_quality():
    default = vs._format_for(None)
    assert vs._format_for("") == default
    assert vs._format_for("garbage") == default
    assert "height<=720" in vs._format_for("720p")
    assert "height<=1080" in vs._format_for("1080")


async def test_provider_cookies_are_masked(client):
    payload = make_ytdlp_provider()
    payload["cookies"] = "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tKEY\tvalue"
    created = await client.post("/api/admin/providers", headers=AUTH, json=payload)
    assert created.status_code == 201
    body = created.json()
    assert body["has_cookies"] is True
    assert "cookies" not in body

    listed = (await client.get("/api/admin/providers", headers=AUTH)).json()
    assert any(p["has_cookies"] for p in listed)
