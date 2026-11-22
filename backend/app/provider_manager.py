import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import AsyncIterator

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .crud import list_providers
from .models import Provider, utcnow
from .providers import ADAPTERS, ProviderAdapter, UpstreamResponse

logger = logging.getLogger(__name__)


class NoProviderError(RuntimeError):
    pass


class AllProvidersFailedError(RuntimeError):
    def __init__(self, attempts: list[dict]):
        self.attempts = attempts
        names = ", ".join(a["provider"] for a in attempts)
        super().__init__(f"all providers failed: {names}")


class UnknownAdapterError(RuntimeError):
    pass


@dataclass
class Attempt:
    provider_name: str
    ok: bool
    error: str | None = None


class ProviderManager:
    """Builds the ordered provider chain and streams with fallback.

    ``open`` is lazy on the adapters, so a provider that fails to hand us the
    first byte costs us nothing: we just walk to the next one in line.
    """

    def build_chain(self, providers: list[Provider]) -> list[tuple[Provider, ProviderAdapter]]:
        chain: list[tuple[Provider, ProviderAdapter]] = []
        for provider in sorted(providers, key=lambda p: (p.priority, p.id)):
            adapter_cls = ADAPTERS.get(provider.adapter)
            if adapter_cls is None:
                logger.warning("provider %s has unknown adapter %s; skipping", provider.name, provider.adapter)
                continue
            chain.append((provider, adapter_cls(provider)))
        return chain

    async def get_active_chain(self, db: AsyncSession) -> list[tuple[Provider, ProviderAdapter]]:
        providers = await list_providers(db, include_inactive=False)
        return self.build_chain(providers)

    async def record_attempt(self, db: AsyncSession, provider: Provider, ok: bool, error: str | None = None) -> None:
        provider.last_status = "up" if ok else "down"
        provider.last_checked_at = utcnow()
        await db.commit()

    async def open_first_wheel(
        self,
        chain: list[tuple[Provider, ProviderAdapter]],
        resource: str,
        client: httpx.AsyncClient,
        db: AsyncSession | None = None,
    ) -> tuple[Provider, ProviderAdapter, UpstreamResponse, list[Attempt]]:
        attempts: list[Attempt] = []
        for provider, adapter in chain:
            try:
                meta = await adapter.open(resource, client)
                attempts.append(Attempt(provider.name, True))
                return provider, adapter, meta, attempts
            except (httpx.HTTPError, ValueError) as exc:
                message = f"{type(exc).__name__}: {exc}"[:500]
                logger.warning("provider %s failed to open %s: %s", provider.name, resource, message)
                attempts.append(Attempt(provider.name, False, message))
                if db is not None:
                    await self.record_attempt(db, provider, ok=False)
        raise AllProvidersFailedError(
            [{"provider": a.provider_name, "ok": a.ok, "error": a.error} for a in attempts]
        )

    async def stream_with_fallback(
        self,
        db: AsyncSession,
        resource: str,
        client: httpx.AsyncClient,
    ) -> tuple[Provider, UpstreamResponse, AsyncIterator[bytes], list[Attempt]]:
        settings = get_settings()
        chain = await self.get_active_chain(db)
        if not chain:
            raise NoProviderError("no active providers configured")
        chain = chain[: settings.max_provider_attempts]

        provider, adapter, meta, attempts = await self.open_first_wheel(chain, resource, client, db)
        await self.record_attempt(db, provider, ok=True)

        async def tracked() -> AsyncIterator[bytes]:
            async for chunk in adapter.stream(client):
                yield chunk

        return provider, meta, tracked(), attempts

    async def health_check_chain(self, db: AsyncSession) -> list[dict]:
        results = []
        providers = await list_providers(db, include_inactive=False)
        async with httpx.AsyncClient(follow_redirects=True) as client:
            for provider in providers:
                adapter_cls = ADAPTERS.get(provider.adapter)
                ok = False
                error = None
                if adapter_cls is None:
                    error = f"unknown adapter {provider.adapter}"
                else:
                    ok = await adapter_cls(provider).health_check(client)
                provider.last_status = "up" if ok else "down"
                provider.last_checked_at = datetime.now(timezone.utc)
                await db.commit()
                results.append({"provider_id": provider.id, "name": provider.name, "status": "up" if ok else "down", "error": error})
        return results


manager = ProviderManager()
