import json
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import Provider


class ProviderBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    adapter: str = "http_mirror"
    base_url: str = Field(default="", max_length=512)
    api_key: str | None = None
    cookies: str | None = Field(default=None, max_length=200000)
    extra_headers: dict[str, str] | None = None
    priority: int = Field(default=100, ge=1, le=100000)
    is_active: bool = True
    timeout_seconds: int = Field(default=30, ge=1, le=600)


class ProviderCreate(ProviderBase):
    pass


class ProviderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    adapter: str | None = None
    base_url: str | None = Field(default=None, max_length=512)
    api_key: str | None = None
    cookies: str | None = Field(default=None, max_length=200000)
    extra_headers: dict[str, str] | None = None
    priority: int | None = Field(default=None, ge=1, le=100000)
    is_active: bool | None = None
    timeout_seconds: int | None = Field(default=None, ge=1, le=600)


class ProviderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    adapter: str
    base_url: str
    has_api_key: bool
    has_cookies: bool
    extra_headers: dict[str, str] | None
    priority: int
    is_active: bool
    timeout_seconds: int
    last_status: str | None
    last_checked_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, provider: Provider) -> "ProviderOut":
        headers = None
        if provider.extra_headers:
            try:
                headers = json.loads(provider.extra_headers)
            except (ValueError, TypeError):
                headers = None
        return cls(
            id=provider.id,
            name=provider.name,
            adapter=provider.adapter,
            base_url=provider.base_url,
            has_api_key=bool(provider.api_key),
            has_cookies=bool(provider.cookies),
            extra_headers=headers,
            priority=provider.priority,
            is_active=provider.is_active,
            timeout_seconds=provider.timeout_seconds,
            last_status=provider.last_status,
            last_checked_at=provider.last_checked_at,
            created_at=provider.created_at,
            updated_at=provider.updated_at,
        )


class DownloadCreate(BaseModel):
    resource: str = Field(min_length=1, max_length=1024)
    audio_only: bool = False
    quality: str | None = Field(default=None, max_length=10)
    cookies: str | None = Field(default=None, max_length=200000)


class DownloadJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    resource: str
    status: str
    quality: str | None = None
    provider_id: int | None
    provider_attempts: str | None
    content_type: str | None
    filename: str | None = None
    content_length: int | None
    bytes_transferred: int
    error: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime


class LicenseCreate(BaseModel):
    plan: str = Field(default="pro", max_length=20)
    days: int | None = Field(default=30, ge=1, le=3650)
    note: str | None = Field(default=None, max_length=255)


class LicenseUpdate(BaseModel):
    is_active: bool | None = None


class LicenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    plan: str
    note: str | None
    is_active: bool
    expires_at: datetime | None
    redeemed_at: datetime | None
    created_at: datetime


class ContactMessageIn(BaseModel):
    kind: str = Field(default="message", pattern="^(message|pro_order)$")
    name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    txid: str | None = Field(default=None, max_length=80)
    body: str = Field(min_length=1, max_length=2000)


class ContactMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    name: str
    phone: str | None
    txid: str | None
    body: str
    is_read: bool
    created_at: datetime


class ContactCreated(BaseModel):
    id: int
    received: bool = True


class BanIn(BaseModel):
    ip: str = Field(min_length=3, max_length=64)
    reason: str | None = Field(default=None, max_length=255)




class ProPackageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    price: int = Field(ge=1, le=1000000)
    duration_days: int = Field(ge=1, le=3650)
    description: str | None = Field(default=None, max_length=255)
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0, le=10000)


class ProPackageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    price: int | None = Field(default=None, ge=1, le=1000000)
    duration_days: int | None = Field(default=None, ge=1, le=3650)
    description: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0, le=10000)


class ProPackageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    price: int
    duration_days: int
    description: str | None
    is_active: bool
    sort_order: int
    created_at: datetime


class ProOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    package_id: int | None
    txid: str
    contact: str | None
    status: str
    license_key: str | None
    ip: str | None
    created_at: datetime


class ProOrderStatusUpdate(BaseModel):
    status: str = Field(pattern="^(completed|rejected|pending)$")


class BanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ip: str
    reason: str | None
    created_at: datetime
