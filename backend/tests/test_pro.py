"""Tests for the Pro license tier and playlist free cap."""
from datetime import datetime, timedelta, timezone

from app.config import Settings
from app.models import LicenseKey
from app.routers import downloads as downloads_router
from app.routers import media as media_router

AUTH = {"X-Admin-Token": "test-token"}


async def _make_license(client, days=30):
    resp = await client.post("/api/admin/licenses", headers=AUTH, json={"plan": "pro", "days": days, "note": "test"})
    assert resp.status_code == 201
    return resp.json()


async def test_admin_licenses_require_token(client):
    assert (await client.get("/api/admin/licenses")).status_code == 401
    assert (await client.post("/api/admin/licenses", json={"days": 30})).status_code == 401


async def test_create_redeem_and_status(client):
    license = await _make_license(client)
    assert license["key"].startswith("VDPRO-")

    redeem = await client.post("/api/pro/redeem", json={"key": license["key"]})
    assert redeem.status_code == 200
    body = redeem.json()
    assert body["valid"] is True
    assert body["plan"] == "pro"
    assert isinstance(body["expires_at"], str)

    status = await client.get(f"/api/pro/status?key={license['key']}")
    assert status.status_code == 200
    assert status.json()["valid"] is True

    unknown = await client.get("/api/pro/status?key=VDPRO-UNKNOWN")
    assert unknown.status_code == 200
    assert unknown.json()["valid"] is False

    bad = await client.post("/api/pro/redeem", json={"key": "VDPRO-UNKNOWN"})
    assert bad.status_code == 403


async def test_deactivated_license_rejected(client):
    license = await _make_license(client)
    patched = await client.patch(f"/api/admin/licenses/{license['key']}", json={"is_active": False}, headers=AUTH)
    assert patched.status_code == 200
    assert patched.json()["is_active"] is False

    redeem = await client.post("/api/pro/redeem", json={"key": license["key"]})
    assert redeem.status_code == 403


async def test_expired_license_rejected(client):
    from app.crud import valid_license
    from app.database import session_maker

    license = await _make_license(client, days=30)
    maker = session_maker()
    async with maker() as session:
        key = await session.get(LicenseKey, license["key"])
        key.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        await session.commit()
        assert await valid_license(session, license["key"]) is None


async def test_pro_key_gets_higher_daily_limit(client, monkeypatch):
    downloads_router._daily_counts.clear()
    monkeypatch.setattr(downloads_router, "get_settings", lambda: Settings(free_daily_limit=1, pro_daily_limit=1000))
    license = await _make_license(client)

    free = await client.post("/api/downloads", json={"resource": "https://youtu.be/free1"})
    assert free.status_code == 201
    blocked = await client.post("/api/downloads", json={"resource": "https://youtu.be/free2"})
    assert blocked.status_code == 429
    assert "Daily free limit" in blocked.json()["detail"]

    headers = {"X-User-Key": license["key"]}
    for i in range(3):
        resp = await client.post("/api/downloads", json={"resource": f"https://youtu.be/p{i}"}, headers=headers)
        assert resp.status_code == 201


async def test_playlist_cap_for_free_users(client, monkeypatch):
    downloads_router._daily_counts.clear()
    entries = [
        {"title": f"Item {i}", "duration": 10, "thumbnail": f"https://i.ytimg.com/{i}.jpg", "webpage_url": f"https://youtu.be/{i}"}
        for i in range(25)
    ]
    monkeypatch.setattr(
        media_router,
        "_extract_playlist_sync",
        lambda url=None, timeout=None: {"title": "Big", "playlist_count": 25, "entries": entries},
    )
    resp = await client.get("/api/playlist?url=https://example.com/playlist")
    body = resp.json()
    assert body["count"] == 10
    assert body["pro_required"] is True

    license = await _make_license(client)
    resp = await client.get("/api/playlist?url=https://example.com/playlist", headers={"X-User-Key": license["key"]})
    body = resp.json()
    assert body["count"] == 25
    assert body["pro_required"] is False
