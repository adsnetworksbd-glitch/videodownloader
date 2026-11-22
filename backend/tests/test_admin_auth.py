"""Tests for the optional email + password admin login."""

import pytest


@pytest.fixture
def email_login(monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "Rony@Gmail.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "strong-pass-123")
    from app.config import get_settings

    get_settings.cache_clear()
    yield
    monkeypatch.delenv("ADMIN_EMAIL", raising=False)
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    get_settings.cache_clear()


async def test_login_disabled_without_env(client):
    response = await client.post("/api/admin-auth/login", json={"email": "a@b.com", "password": "x"})
    assert response.status_code == 503
    assert "disabled" in response.json()["detail"]


async def test_login_rejects_wrong_credentials(client, email_login):
    wrong_email = await client.post(
        "/api/admin-auth/login", json={"email": "someone@else.com", "password": "strong-pass-123"}
    )
    assert wrong_email.status_code == 401
    wrong_password = await client.post(
        "/api/admin-auth/login", json={"email": "rony@gmail.com", "password": "nope"}
    )
    assert wrong_password.status_code == 401
    assert "Wrong email or password." in wrong_password.json()["detail"]


async def test_login_session_grants_admin_access(client, email_login):
    response = await client.post(
        "/api/admin-auth/login", json={"email": "rony@gmail.com", "password": "strong-pass-123"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["expires_in_hours"] == 12
    session = body["session"]
    assert "." in session and len(session) > 40

    assert (await client.get("/api/admin/stats")).status_code == 401
    ok = await client.get("/api/admin/stats", headers={"x-admin-token": session})
    assert ok.status_code == 200

    tampered = await client.get(
        "/api/admin/stats", headers={"x-admin-token": session[:-4] + "aaaa"}
    )
    assert tampered.status_code == 401


async def test_master_token_still_works(client, email_login):
    ok = await client.get("/api/admin/stats", headers={"x-admin-token": "test-token"})
    assert ok.status_code == 200
