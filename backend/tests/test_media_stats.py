"""Tests for playlist, thumbnail-guard, public stats, admin stats and the free daily limit."""
import pytest

from app.config import Settings
from app.routers import downloads as downloads_router
from app.routers import media as media_router
from app.routers import stats as stats_router

AUTH = {"X-Admin-Token": "test-token"}


async def test_playlist_returns_entries(client, monkeypatch):
    def capture(url=None, timeout=None):
        return {
            "title": "My Playlist",
            "playlist_count": 3,
            "entries": [
                {"title": "One", "duration": 10, "thumbnail": "https://i.ytimg.com/a.jpg", "webpage_url": "https://youtu.be/one"},
                {"title": "Two", "duration": 20, "thumbnail": "https://i.ytimg.com/b.jpg", "webpage_url": "https://youtu.be/two"},
            ],
        }

    monkeypatch.setattr(media_router, "_extract_playlist_sync", capture)
    resp = await client.get("/api/playlist?url=https://www.youtube.com/playlist?list=abc")
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "My Playlist"
    assert body["count"] == 2
    assert body["items"][0]["url"] == "https://youtu.be/one"


async def test_playlist_rejects_single_video(client, monkeypatch):
    monkeypatch.setattr(
        media_router,
        "_extract_playlist_sync",
        lambda url=None, timeout=None: {"title": "Single", "entries": []},
    )
    resp = await client.get("/api/playlist?url=https://youtu.be/single")
    assert resp.status_code == 422


async def test_playlist_rejects_private_target(client):
    resp = await client.get("/api/playlist?url=http://127.0.0.1/playlist")
    assert resp.status_code == 400


async def test_thumbnail_returns_image(client, monkeypatch):
    monkeypatch.setattr(
        media_router,
        "extract_info_sync",
        lambda url, timeout, fmt=None: {"thumbnail": "https://i.ytimg.com/thumb.jpg"},
    )

    class FakeResp:
        status_code = 200
        content = b"JPEGBYTES"
        headers = {"content-type": "image/jpeg"}

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url):
            return FakeResp()

    monkeypatch.setattr(media_router.httpx, "AsyncClient", FakeClient)
    resp = await client.get("/api/thumbnail?url=https://youtu.be/somevideo")
    assert resp.status_code == 200
    assert resp.content == b"JPEGBYTES"
    assert resp.headers["content-type"].startswith("image/")

    resp = await client.get("/api/thumbnail?url=https://youtu.be/somevideo&download=true")
    assert resp.headers.get("content-disposition", "").startswith("attachment")


async def test_thumbnail_rejects_bad_media_url(client):
    resp = await client.get("/api/thumbnail?url=http://192.168.1.5/video")
    assert resp.status_code == 400


async def test_public_stats_counts_jobs_and_trending(client, monkeypatch):
    monkeypatch.setattr(stats_router, "total_sites", lambda: 1754)
    resp = await client.get("/api/stats/public")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_sites"] == 1754
    assert body["total_downloads"] == 0
    assert isinstance(body["trending"], list)


async def test_admin_stats_requires_token(client):
    resp = await client.get("/api/admin/stats")
    assert resp.status_code == 401


async def test_admin_stats_with_token(client):
    resp = await client.get("/api/admin/stats", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["jobs_total"] == 0
    assert body["providers_total"] == 0
    assert "statuses" in body


async def test_free_daily_limit_blocks_after_threshold(client, monkeypatch):
    monkeypatch.setattr(downloads_router, "get_settings", lambda: Settings(free_daily_limit=2))
    first = await client.post("/api/downloads", json={"resource": "https://youtu.be/a"})
    second = await client.post("/api/downloads", json={"resource": "https://youtu.be/b"})
    third = await client.post("/api/downloads", json={"resource": "https://youtu.be/c"})
    assert first.status_code == 201
    assert second.status_code == 201
    assert third.status_code == 429
    assert "Daily free limit" in third.json()["detail"]


async def test_free_daily_limit_disabled(client, monkeypatch):
    monkeypatch.setattr(downloads_router, "get_settings", lambda: Settings(free_daily_limit=0))
    for i in range(3):
        resp = await client.post("/api/downloads", json={"resource": f"https://youtu.be/{i}"})
        assert resp.status_code == 201


@pytest.mark.parametrize("host,expected", [("youtube.com", "youtube.com"), ("http://localhost/x", None)])
def test_host_of(host, expected):
    if expected is None and not host.startswith("http"):
        assert stats_router._host_of(host) is None
    else:
        assert stats_router._host_of(host if host.startswith("http") else f"https://{host}") == expected
