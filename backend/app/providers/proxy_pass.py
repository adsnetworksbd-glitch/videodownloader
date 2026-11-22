import json
from collections.abc import AsyncIterator

import httpx

from ..models import Provider
from .base import ProviderAdapter, UpstreamResponse


class ProxyPassAdapter(ProviderAdapter):
    """Forwards the resource URL to an upstream API that resolves it.

    Sends POST {base_url} with {"resource": ...}; streams the binary body
    back unlike a JSON answer.
    """

    type_name = "proxy_pass"

    def __init__(self, provider: Provider):
        super().__init__(provider)
        self._response: httpx.Response | None = None

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.provider.api_key:
            headers["X-API-Key"] = self.provider.api_key
        if self.provider.extra_headers:
            try:
                headers.update(json.loads(self.provider.extra_headers))
            except (ValueError, TypeError):
                pass
        return headers

    async def open(self, resource: str, client: httpx.AsyncClient) -> UpstreamResponse:
        response = await client.post(
            self.provider.base_url,
            json={"resource": resource},
            headers=self._headers(),
            timeout=self.provider.timeout_seconds,
        )
        response.raise_for_status()
        if not response.headers.get("content-length"):
            raise ValueError(f"upstream {self.provider.name} returned no content-length")
        self._response = response
        return UpstreamResponse(
            content_type=response.headers.get("content-type"),
            content_length=int(response.headers["content-length"]),
        )

    async def stream(self, client: httpx.AsyncClient) -> AsyncIterator[bytes]:
        assert self._response is not None
        async for chunk in self._response.aiter_bytes():
            yield chunk
        await self._response.aclose()
