import json
from collections.abc import AsyncIterator
from urllib.parse import quote

import httpx

from ..models import Provider
from .base import ProviderAdapter, UpstreamResponse


class HttpMirrorAdapter(ProviderAdapter):
    """Acts as a plain HTTP mirror: GET {base_url}/{resource}.

    ``resource`` may be a full URL or a path (e.g. ``files/report.pdf``).
    If ``resource`` is already absolute and the mirror allows pass-through,
    it is appended after the base URL as-is.
    """

    type_name = "http_mirror"

    def __init__(self, provider: Provider):
        super().__init__(provider)
        self._response: httpx.Response | None = None

    def _target_url(self, resource: str) -> str:
        base = self.provider.base_url.rstrip("/")
        if resource.startswith(("http://", "https://")):
            return f"{base}/{resource}"
        return f"{base}/{quote(resource.lstrip('/'))}"

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self.provider.api_key:
            headers["Authorization"] = f"Bearer {self.provider.api_key}"
        if self.provider.extra_headers:
            try:
                headers.update(json.loads(self.provider.extra_headers))
            except (ValueError, TypeError):
                pass
        return headers

    async def open(self, resource: str, client: httpx.AsyncClient) -> UpstreamResponse:
        response = await client.get(
            self._target_url(resource),
            headers=self._headers(),
            timeout=self.provider.timeout_seconds,
        )
        response.raise_for_status()
        if not response.headers.get("content-length"):
            raise ValueError(f"upstream {self.provider.name} returned no content-length")
        self._response = response
        disposition = response.headers.get("content-disposition", "")
        filename = None
        if "filename=" in disposition:
            filename = disposition.split("filename=", 1)[1].strip(chr(34))
        return UpstreamResponse(
            content_type=response.headers.get("content-type"),
            content_length=int(response.headers["content-length"]),
            filename=filename,
        )

    async def stream(self, client: httpx.AsyncClient) -> AsyncIterator[bytes]:
        assert self._response is not None
        async for chunk in self._response.aiter_bytes():
            yield chunk
        await self._response.aclose()
