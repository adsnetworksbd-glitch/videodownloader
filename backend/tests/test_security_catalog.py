"""Tests for SSRF guard, rate limiting and the site catalog endpoints."""
from fastapi.testclient import TestClient

from app.security import UnsafeUrlError, assert_public_url


def test_assert_public_url_blocks_private_literals():
    import pytest

    for url in [
        "http://localhost:8000/x",
        "http://127.0.0.1/",
        "http://10.0.0.5/file.mp4",
        "http://192.168.1.1/v",
        "http://169.254.169.254/latest/meta-data",
        "http://[::1]/v",
        "file:///etc/passwd",
        "http://myhost.internal/v",
    ]:
        with pytest.raises(UnsafeUrlError):
            assert_public_url(url)


def test_assert_public_url_allows_unresolvable_host():
    assert assert_public_url("https://this-domain-does-not-exist-9812347.example/video").startswith("https://")


async def test_catalog_stats(client):
    response = await client.get("/api/catalog/stats")
    assert response.status_code == 200
    body = response.json()
    assert body["total_sites"] >= 1000
    assert body["curated_sites"] >= 30
    assert "Social Media" in body["categories"]


async def test_catalog_sites_search_filter_pagination(client):
    response = await client.get("/api/catalog/sites")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 30
    assert len(body["items"]) <= body["page_size"]

    filtered = (await client.get("/api/catalog/sites?q=youtu")).json()
    assert any(s["domain"] == "youtube.com" for s in filtered["items"])

    categorized = (await client.get("/api/catalog/sites?category=News%20%26%20Media")).json()
    assert all(s["category"] == "News & Media" for s in categorized["items"])

    names = [s["name"] for s in body["items"]]
    assert names == sorted(names, key=str.lower)


async def test_download_rejects_private_target(client, monkeypatch):
    created = await client.post(
        "/api/admin/providers",
        headers={"X-Admin-Token": "test-token"},
        json={"name": "vid", "adapter": "ytdlp", "base_url": "", "priority": 1, "timeout_seconds": 10},
    )
    assert created.status_code == 201

    response = await client.post("/api/downloads", json={"resource": "http://127.0.0.1:9000/secret.mp4"})
    assert response.status_code == 400
    assert "private" in response.json()["detail"].lower() or "not allowed" in response.json()["detail"].lower()
