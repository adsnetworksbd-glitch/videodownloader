"""Tests for contact/orders, IP bans, export, fast lane, and the daily chart."""
import itertools
import json

from app.config import Settings
from app.routers import downloads as downloads_router
from app.deps import client_ip
from app.services import telegram_bot as bot
from app.services import video_service as vs

AUTH = {"X-Admin-Token": "test-token"}


def _drain_queue():
    q = vs._priority_queue()
    items = []
    while not q.empty():
        items.append(q.get_nowait()[2])
    return items


async def test_contact_message_and_order(client):
    message = await client.post("/api/contact", json={"kind": "message", "name": "Roni", "body": "Hello team"})
    assert message.status_code == 201

    no_txid = await client.post("/api/contact", json={"kind": "pro_order", "name": "Roni", "body": "want pro"})
    assert no_txid.status_code == 422

    order = await client.post(
        "/api/contact",
        json={"kind": "pro_order", "name": "Roni", "phone": "017", "txid": "8HJ2K", "body": "Paid 199"},
    )
    assert order.status_code == 201


async def test_messages_admin_flow(client):
    await client.post("/api/contact", json={"name": "Bob", "body": "question"})
    await client.post("/api/contact", json={"kind": "pro_order", "name": "Alice", "txid": "TX1", "body": "paid"})

    assert (await client.get("/api/admin/messages")).status_code == 401

    listed = await client.get("/api/admin/messages", headers=AUTH)
    assert listed.status_code == 200
    assert len(listed.json()) == 2

    only_orders = await client.get("/api/admin/messages", params={"kind": "pro_order"}, headers=AUTH)
    assert [m["name"] for m in only_orders.json()] == ["Alice"]

    first = listed.json()[-1]["id"]
    read = await client.patch(f"/api/admin/messages/{first}", headers=AUTH, json={"is_read": True})
    assert read.status_code == 200
    assert read.json()["is_read"] is True

    deleted = await client.delete(f"/api/admin/messages/{first}", headers=AUTH)
    assert deleted.status_code == 204
    remaining = await client.get("/api/admin/messages", headers=AUTH)
    assert len(remaining.json()) == 1


async def test_ban_blocks_download_and_contact(client):
    downloads_router._daily_counts.clear()
    created = await client.post("/api/admin/bans", headers=AUTH, json={"ip": "9.9.9.9", "reason": "abuse"})
    HF = {"X-Forwarded-For": "9.9.9.9"}
    assert created.status_code == 201

    bans = await client.get("/api/admin/bans", headers=AUTH)
    assert bans.json()[0]["ip"] == "9.9.9.9"
    assert bans.json()[0]["reason"] == "abuse"
    assert (await client.get("/api/admin/bans")).status_code == 401

    blocked = await client.post("/api/downloads", json={"resource": "https://youtu.be/AAA"}, headers=HF)
    assert blocked.status_code == 403

    contact_blocked = await client.post("/api/contact", json={"name": "x", "body": "y"}, headers=HF)
    assert contact_blocked.status_code == 403

    removed = await client.delete("/api/admin/bans/9.9.9.9", headers=AUTH)
    assert removed.status_code == 204
    unblocked = await client.post("/api/downloads", json={"resource": "https://youtu.be/AAA"}, headers={"X-Forwarded-For": "8.8.8.8"})
    assert unblocked.status_code != 403


async def test_export_requires_admin_and_contains_data(client):
    assert (await client.put("/api/admin/settings", headers=AUTH, json={"free_daily_limit": "7"})).status_code == 200
    assert (await client.get("/api/admin/export")).status_code == 401

    export = await client.get("/api/admin/export", headers=AUTH)
    assert export.status_code == 200
    body = export.json()
    assert set(body) == {"exported_at", "providers", "licenses", "bans", "settings"}
    assert body["settings"]["free_daily_limit"] == "7"
    assert all("has_api_key" in provider for provider in body["providers"])


async def test_fast_lane_priority_order(monkeypatch):
    monkeypatch.setattr(vs, "_ensure_workers", lambda: None)
    monkeypatch.setattr(vs, "_order", itertools.count())
    while not vs._priority_queue().empty():
        vs._priority_queue().get_nowait()

    vs.schedule_video_download("job-a")
    vs.schedule_video_download("job-b")
    vs.schedule_video_download("job-c", priority=True)

    assert _drain_queue() == ["job-c", "job-a", "job-b"]


async def test_pro_download_is_scheduled_with_priority(client, monkeypatch):
    downloads_router._daily_counts.clear()
    captured = []

    def fake_schedule(job_id, priority=False):
        captured.append((job_id, priority))

    from app.routers import downloads as dr
    monkeypatch.setattr(dr, "schedule_video_download", fake_schedule)
    await client.post("/api/admin/providers", headers=AUTH, json={"name": "vid", "adapter": "ytdlp", "base_url": "", "priority": 1, "timeout_seconds": 10})
    license = await client.post("/api/admin/licenses", headers=AUTH, json={"plan": "pro", "days": 30, "note": ""})
    key = license.json()["key"]

    await client.post("/api/downloads", json={"resource": "https://youtu.be/AAA"})
    await client.post("/api/downloads", json={"resource": "https://youtu.be/BBB"}, headers={"X-User-Key": key})
    assert captured[0][1] is False
    assert captured[1][1] is True


async def test_admin_stats_daily_and_down_list(client):
    stats = await client.get("/api/admin/stats", headers=AUTH)
    assert stats.status_code == 200
    body = stats.json()
    assert len(body["daily"]) == 7
    assert body["daily"][-1]["date"] >= body["daily"][0]["date"]
    assert "providers_down_list" in body


async def test_telegram_helpers():
    assert bot.extract_url("look at https://youtu.be/xyz please") == "https://youtu.be/xyz"
    assert bot.extract_url("no link here") is None
    assert "/start" in bot.welcome_text()
