import base64
import hashlib
import hmac
import secrets
import time

from fastapi import Depends, Header, HTTPException, status

from .config import get_settings

SESSION_TTL_SECONDS = 12 * 3600


def _session_key() -> bytes:
    settings = get_settings()
    material = f"{settings.admin_token}:{settings.admin_email}:{settings.admin_password}"
    return hashlib.sha256(material.encode()).digest()


def create_admin_session() -> str:
    expires = str(int(time.time()) + SESSION_TTL_SECONDS)
    payload = base64.urlsafe_b64encode(expires.encode()).decode().rstrip("=")
    signature = hmac.new(_session_key(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def verify_admin_session(value: str) -> bool:
    try:
        payload, signature = value.rsplit(".", 1)
        expected = hmac.new(_session_key(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return False
        padded = payload + "=" * (-len(payload) % 4)
        expires = int(base64.urlsafe_b64decode(padded).decode())
        return expires > int(time.time())
    except Exception:
        return False


def require_admin(x_admin_token: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if x_admin_token:
        if secrets.compare_digest(x_admin_token, settings.admin_token):
            return
        if settings.admin_password and verify_admin_session(x_admin_token):
            return
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token")


def client_ip(request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    first = forwarded.split(",")[0].strip()
    if first:
        return first
    return request.client.host if request.client else ""
