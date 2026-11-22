from .conftest import AUTH
from .fake_adapters import register

register()


async def test_create_requires_admin_token(client):
    response = await client.post("/api/admin/providers", json={"name": "a", "base_url": "http://x", "adapter": "fake_ok"})
    assert response.status_code == 401


async def test_create_and_mask_api_key(client):
    response = await client.post(
        "/api/admin/providers",
        headers=AUTH,
        json={"name": "mirror-1", "base_url": "https://mirror.example", "adapter": "http_mirror", "api_key": "secret-123", "priority": 5},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "mirror-1"
    assert body["has_api_key"] is True
    assert "api_key" not in body
    assert "secret-123" not in response.text


async def test_duplicate_name_conflict(client):
    payload = {"name": "dup", "base_url": "http://x", "adapter": "http_mirror"}
    assert (await client.post("/api/admin/providers", headers=AUTH, json=payload)).status_code == 201
    assert (await client.post("/api/admin/providers", headers=AUTH, json=payload)).status_code == 409


async def test_unknown_adapter_rejected(client):
    response = await client.post(
        "/api/admin/providers", headers=AUTH, json={"name": "bad", "base_url": "http://x", "adapter": "nope"}
    )
    assert response.status_code == 422


async def test_patch_and_list_ordering(client):
    for i, priority in enumerate([50, 10, 30]):
        await client.post("/api/admin/providers", headers=AUTH, json={"name": f"p{i}", "base_url": "http://x", "adapter": "http_mirror", "priority": priority})
    listed = (await client.get("/api/admin/providers", headers=AUTH)).json()
    assert [item["name"] for item in listed] == ["p1", "p2", "p0"]

    target_id = listed[0]["id"]
    patched = (await client.patch(f"/api/admin/providers/{target_id}", headers=AUTH, json={"priority": 1, "is_active": False})).json()
    assert patched["priority"] == 1 and patched["is_active"] is False


async def test_delete(client):
    created = (await client.post("/api/admin/providers", headers=AUTH, json={"name": "gone", "base_url": "http://x", "adapter": "http_mirror"})).json()
    assert (await client.delete(f"/api/admin/providers/{created['id']}", headers=AUTH)).status_code == 204
    assert (await client.get(f"/api/admin/providers/{created['id']}", headers=AUTH)).status_code == 404
