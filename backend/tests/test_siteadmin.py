"""Tests for admin site settings, public notice, and job management."""
import asyncio
import os

from app.routers import downloads as downloads_router
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


async def test_admin_settings_require_token(client):
    assert (await client.get("/api/admin/settings")).status_code == 401
    assert (await client.put("/api/admin/settings", json={"free_daily_limit": "5"})).status_code == 401


async def test_admin_jobs_require_token(client):
    assert (await client.get("/api/admin/jobs")).status_code == 401
    assert (await client.delete("/api/admin/jobs/nope")).status_code == 401
    assert (await client.post("/api/admin/jobs/nope/retry")).status_code == 401


async def test_settings_roundtrip_and_validation(client):
    current = await client.get("/api/admin/settings", headers=AUTH)
    assert current.status_code == 200
    body = current.json()
    assert body["free_daily_limit"] == "100"
    assert body["rate_limit_window"] == "60"

    saved = await client.put("/api/admin/settings", headers=AUTH, json={"free_daily_limit": "5", "notice_message": "  Hello site  "})
    assert saved.status_code == 200
    assert saved.json()["saved"] == ["free_daily_limit", "notice_message"]

    reread = await client.get("/api/admin/settings", headers=AUTH)
    assert reread.json()["free_daily_limit"] == "5"
    assert reread.json()["notice_message"] == "Hello site"

    unknown = await client.put("/api/admin/settings", headers=AUTH, json={"not_a_key": "1"})
    assert unknown.status_code == 400

    bad_int = await client.put("/api/admin/settings", headers=AUTH, json={"free_daily_limit": "abc"})
    assert bad_int.status_code == 400

    too_big = await client.put("/api/admin/settings", headers=AUTH, json={"free_playlist_items": "99999"})
    assert too_big.status_code == 400


async def test_free_daily_limit_override_applies_and_pro_bypasses(client):
    downloads_router._daily_counts.clear()
    saved = await client.put("/api/admin/settings", headers=AUTH, json={"free_daily_limit": "1"})
    assert saved.status_code == 200

    first = await client.post("/api/downloads", json={"resource": "https://youtu.be/one"})
    assert first.status_code == 201
    second = await client.post("/api/downloads", json={"resource": "https://youtu.be/two"})
    assert second.status_code == 429
    assert "Daily free limit of 1" in second.json()["detail"]

    license = await client.post("/api/admin/licenses", headers=AUTH, json={"plan": "pro", "days": 30, "note": ""})
    assert license.status_code == 201
    pro = await client.post(
        "/api/downloads",
        json={"resource": "https://youtu.be/three"},
        headers={"X-User-Key": license.json()["key"]},
    )
    assert pro.status_code == 201


async def test_public_notice_endpoint(client):
    empty = await client.get("/api/stats/notice")
    assert empty.status_code == 200
    assert empty.json()["message"] == ""

    await client.put("/api/admin/settings", headers=AUTH, json={"notice_message": "Maintenance tonight"})
    notice = await client.get("/api/stats/notice")
    assert notice.json()["message"] == "Maintenance tonight"


async def test_job_delete_and_retry(client, tmp_path, monkeypatch):
    downloads_router._daily_counts.clear()
    monkeypatch.setattr(vs, "ytdlp_download_sync", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))

    await client.post("/api/admin/providers", headers=AUTH, json=make_ytdlp_provider())
    created = await client.post("/api/downloads", json={"resource": "https://www.youtube.com/watch?v=xyz"})
    assert created.status_code == 201
    job = created.json()

    failed = await _wait_for_status(client, job["id"], {"failed"})
    assert failed["status"] == "failed"

    listed = await client.get("/api/admin/jobs?limit=20", headers=AUTH)
    assert listed.status_code == 200
    assert any(row["id"] == job["id"] for row in listed.json())

    def good_download(job_id, resource, provider, jobs_dir, audio_only, progress_cb, quality=None, cookies=None):
        os.makedirs(jobs_dir, exist_ok=True)
        path = os.path.join(jobs_dir, f"{job_id}.mp4")
        with open(path, "wb") as fh:
            fh.write(b"RETRY-OK")
        progress_cb(8, 8)
        return {"filepath": path, "filename": os.path.basename(path), "title": "Retry"}

    monkeypatch.setattr(vs, "ytdlp_download_sync", good_download)
    retried = await client.post(f"/api/admin/jobs/{job['id']}/retry", headers=AUTH)
    assert retried.status_code == 200
    assert retried.json()["status"] in ("queued", "downloading", "ready")

    final = await _wait_for_status(client, job["id"], {"ready", "failed"})
    assert final["status"] == "ready", final

    deleted = await client.delete(f"/api/admin/jobs/{job['id']}", headers=AUTH)
    assert deleted.status_code == 204
    gone = await client.get(f"/api/downloads/{job['id']}")
    assert gone.status_code == 404
