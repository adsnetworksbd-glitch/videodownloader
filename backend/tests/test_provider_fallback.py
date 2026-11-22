import pytest

from .fake_adapters import FakeFailAdapter, FakeOkAdapter, register

register()


def make_provider(name, adapter, priority):
    from app.models import Provider

    return Provider(name=name, adapter=adapter, base_url=f"https://{name}.example", priority=priority)


async def test_chain_ordered_by_priority():
    from app.provider_manager import manager

    chain = manager.build_chain([make_provider("low", "http_mirror", 90), make_provider("high", "http_mirror", 10)])
    assert [p.name for p, _ in chain] == ["high", "low"]


async def test_chain_skips_unknown_adapter():
    from app.provider_manager import manager

    chain = manager.build_chain([make_provider("broken", "does_not_exist", 1), make_provider("fine", "http_mirror", 2)])
    assert [p.name for p, _ in chain] == ["fine"]


async def test_first_wheel_falls_back():
    import httpx

    from app.provider_manager import AllProvidersFailedError, manager

    chain = manager.build_chain([
        make_provider("f1", "fake_fail", 1),
        make_provider("f2", "fake_fail", 2),
        make_provider("f3", "fake_fail", 3),
    ])
    async with httpx.AsyncClient() as client:
        with pytest.raises(AllProvidersFailedError) as exc_info:
            await manager.open_first_wheel(chain, "file.zip", client)
    assert [a["provider"] for a in exc_info.value.attempts] == ["f1", "f2", "f3"]


async def test_first_wheel_stops_at_first_success():
    import httpx

    from app.provider_manager import manager

    chain = manager.build_chain([
        make_provider("f1", "fake_fail", 1),
        make_provider("f2", "fake_ok", 2),
        make_provider("f3", "fake_fail", 3),
    ])
    async with httpx.AsyncClient() as client:
        provider, adapter, meta, attempts = await manager.open_first_wheel(chain, "file.zip", client)
    assert provider.name == "f2"
    assert meta.content_length == 12
    assert [a.ok for a in attempts] == [False, True]


async def test_download_streams_with_fallback(client):
    create = await client.post(
        "/api/admin/providers", headers={"X-Admin-Token": "test-token"},
        json={"name": "down", "base_url": "https://down.example", "adapter": "fake_fail", "priority": 1},
    )
    assert create.status_code == 201
    ok = await client.post(
        "/api/admin/providers", headers={"X-Admin-Token": "test-token"},
        json={"name": "up", "base_url": "https://up.example", "adapter": "fake_ok", "priority": 2},
    )
    assert ok.status_code == 201
    ok_provider_id = ok.json()["id"]

    job = (await client.post("/api/downloads", json={"resource": "files/report.txt"})).json()
    stream = await client.get(f"/api/downloads/{job['id']}/file")
    assert stream.status_code == 200
    assert stream.content == b"hello stream"

    detail = (await client.get(f"/api/downloads/{job['id']}")).json()
    assert detail["status"] == "completed"
    assert detail["bytes_transferred"] == 12
    assert detail["provider_id"] == ok_provider_id
    attempts = [a["provider"] for a in __import__("json").loads(detail["provider_attempts"])]
    assert attempts == ["down", "up"]


async def test_download_no_providers_is_503(client):
    job = (await client.post("/api/downloads", json={"resource": "x.zip"})).json()
    stream = await client.get(f"/api/downloads/{job['id']}/file")
    assert stream.status_code == 503
