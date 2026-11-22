"""Tests for admin-managed Pro packages and instant key purchase flow."""
import pytest

AUTH = {"x-admin-token": "test-token"}


async def _admin_create_package(client, **overrides):
    payload = {"name": "Monthly Pro", "price": 199, "duration_days": 30}
    payload.update(overrides)
    return await client.post("/api/admin/packages", json=payload, headers=AUTH)


async def test_admin_packages_require_token(client):
    list_resp = await client.get("/api/admin/packages")
    assert list_resp.status_code == 401
    create_resp = await client.post("/api/admin/packages", json={"name": "X", "price": 10, "duration_days": 1})
    assert create_resp.status_code == 401


async def test_admin_package_crud(client):
    created = await _admin_create_package(client, description="Full playlists + no ads")
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Monthly Pro"
    assert body["is_active"] is True

    updated = await client.patch(
        f"/api/admin/packages/{body['id']}", json={"price": 249, "is_active": False}, headers=AUTH
    )
    assert updated.status_code == 200
    assert updated.json()["price"] == 249
    assert updated.json()["is_active"] is False

    deleted = await client.delete(f"/api/admin/packages/{body['id']}", headers=AUTH)
    assert deleted.status_code == 204
    missing = await client.delete(f"/api/admin/packages/{body['id']}", headers=AUTH)
    assert missing.status_code == 404


async def test_public_packages_only_active_and_sorted(client):
    await _admin_create_package(client, sort_order=2)
    await _admin_create_package(client, name="Yearly Pro", price=1499, duration_days=365, sort_order=1)
    await _admin_create_package(client, name="Hidden", price=5, duration_days=1, is_active=False)

    response = await client.get("/api/pro/packages")
    assert response.status_code == 200
    items = response.json()
    assert [item["name"] for item in items] == ["Yearly Pro", "Monthly Pro"]


async def test_purchase_returns_instant_active_key(client):
    package = (await _admin_create_package(client)).json()

    response = await client.post(
        "/api/pro/purchase",
        json={"package_id": package["id"], "txid": "8N7DQE38GP", "contact": "rony@example.com"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "completed"
    assert body["key"].startswith("VDPRO-")

    redeem = await client.post("/api/pro/redeem", json={"key": body["key"]})
    assert redeem.status_code == 200
    assert redeem.json()["valid"] is True
    assert redeem.json()["plan"] == "Monthly Pro"


async def test_purchase_rejects_duplicate_txid_case_insensitive(client):
    package = (await _admin_create_package(client)).json()
    first = await client.post("/api/pro/purchase", json={"package_id": package["id"], "txid": "8N7DQE38GP"})
    assert first.status_code == 201
    second = await client.post("/api/pro/purchase", json={"package_id": package["id"], "txid": "8n7dqe38gp"})
    assert second.status_code == 409


async def test_purchase_validations(client):
    package = (await _admin_create_package(client)).json()
    short_txid = await client.post("/api/pro/purchase", json={"package_id": package["id"], "txid": "abc"})
    assert short_txid.status_code == 422
    gone = await client.post("/api/pro/purchase", json={"package_id": 999999, "txid": "8N7DQE38GP"})
    assert gone.status_code == 404


async def test_manual_mode_holds_key_until_admin_approves(client):
    package = (await _admin_create_package(client)).json()
    setting = await client.put(
        "/api/admin/settings", json={"pro_instant_activation": "0"}, headers=AUTH
    )
    assert setting.status_code == 200

    purchase = await client.post("/api/pro/purchase", json={"package_id": package["id"], "txid": "8N7DQE38GP"})
    assert purchase.status_code == 201
    body = purchase.json()
    assert body["status"] == "pending"

    redeem = await client.post("/api/pro/redeem", json={"key": body["key"]})
    assert redeem.status_code == 403

    orders = await client.get("/api/admin/orders", headers=AUTH)
    assert orders.status_code == 200
    order = orders.json()[0]
    assert order["txid"] == "8N7DQE38GP"

    approved = await client.patch(f"/api/admin/orders/{order['id']}", json={"status": "completed"}, headers=AUTH)
    assert approved.status_code == 200
    redeem = await client.post("/api/pro/redeem", json={"key": body["key"]})
    assert redeem.status_code == 200

    reject = await client.patch(f"/api/admin/orders/{order['id']}", json={"status": "rejected"}, headers=AUTH)
    assert reject.status_code == 200
    redeem = await client.post("/api/pro/redeem", json={"key": body["key"]})
    assert redeem.status_code == 403


async def test_order_delete(client):
    package = (await _admin_create_package(client)).json()
    await client.post("/api/pro/purchase", json={"package_id": package["id"], "txid": "8N7DQE38GP"})
    orders = (await client.get("/api/admin/orders", headers=AUTH)).json()
    removed = await client.delete(f"/api/admin/orders/{orders[0]['id']}", headers=AUTH)
    assert removed.status_code == 204
    suspects = (await client.get("/api/admin/orders", headers=AUTH)).json()
    assert suspects == []
