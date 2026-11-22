"""Optional email + password login for the admin panel.

Set ADMIN_EMAIL and ADMIN_PASSWORD on the server to enable it. When enabled,
the password route issues a 12-hour HMAC session token that works anywhere the
ADMIN_TOKEN works - the master token itself is never exposed.
"""

import secrets

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import get_settings
from ..deps import create_admin_session

router = APIRouter(prefix="/api/admin-auth", tags=["admin-auth"])


class AdminLogin(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=255)


@router.post("/login")
async def login(data: AdminLogin):
    settings = get_settings()
    if not settings.admin_email or not settings.admin_password:
        raise HTTPException(status_code=503, detail="Email login is disabled on this server. Use the admin token.")
    email_ok = secrets.compare_digest(data.email.strip().lower(), settings.admin_email.strip().lower())
    password_ok = secrets.compare_digest(data.password, settings.admin_password)
    if not (email_ok and password_ok):
        raise HTTPException(status_code=401, detail="Wrong email or password.")
    return {"session": create_admin_session(), "expires_in_hours": 12}
