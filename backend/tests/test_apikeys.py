"""Tests for the developer API key system (/api/v1)."""

AUTH = {"x-admin-token": "test-token"}

CHEAP_INFO = {
    "title": "API Video",
    "extractor_key": "Youtube",
    "ext": "mp4",
    "url": "https://media.example.com/progressive-720.mp4",
    "formats": [
        {
            "format_id": "22",
            "ext": "mp4",
            "url": "https://media.example.com/progressive-720.mp4",
            "height": 720,
            "vcodec": "avc1.64001f",
            "acodec": "mp4a.40.2",
            "filesize": 1000,
        }
    ],
}


def _patch_extract(monkeypatch, info: dict) -> None:
    def run_extract(url, timeout, fmt=None):
        return info

    monkeypatch.setattr("app.routers.videos.extract_info_sync", run_extract)


async def test_v1_requires_api_key(client):
    assert (await client.get("/api/v1/info?url=https://www.youtube.com/watch?v=abc")).status_code == 403
    assert (
        await client.get(
            "/api/v1/info?url=https://www.youtube.com/watch?v=abc", headers={"X-API-Key": "VDDEV-UNKNOWN"}
        )
    ).status_code == 403
    assert (await client.get("/api/admin/apikeys")).status_code == 401


async def test_v1_full_flow_with_admin_management(client, monkeypatch):
    created = await client.post("/api/admin/apikeys", json={"label": "dev partner"}, headers=AUTH)
    assert created.status_code == 201
    body = created.json()
    assert body["key"].startswith("VDDEV-")
    assert body["is_active"] is True

    _patch_extract(monkeypatch, CHEAP_INFO)

    info = await client.get(
        "/api/v1/info?url=https://www.youtube.com/watch?v=abc", headers={"X-API-Key": body["key"]}
    )
    assert info.status_code == 200
    assert info.json()["title"] == "API Video"
    assert "subtitles" in info.json()

    direct = await client.get(
        "/api/v1/direct?url=https://www.youtube.com/watch?v=abc", headers={"X-API-Key": body["key"]}
    )
    assert direct.status_code == 200
    assert direct.json()["url"].endswith("progressive-720.mp4")

    toggled = await client.patch(f"/api/admin/apikeys/{body['key']}", json={"is_active": False}, headers=AUTH)
    assert toggled.status_code == 200
    assert toggled.json()["is_active"] is False

    blocked = await client.get(
        "/api/v1/info?url=https://www.youtube.com/watch?v=abc", headers={"X-API-Key": body["key"]}
    )
    assert blocked.status_code == 403

    deleted = await client.delete(f"/api/admin/apikeys/{body['key']}", headers=AUTH)
    assert deleted.status_code == 204
    missing = await client.delete(f"/api/admin/apikeys/{body['key']}", headers=AUTH)
    assert missing.status_code == 404
