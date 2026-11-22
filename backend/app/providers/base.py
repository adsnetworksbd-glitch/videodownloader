from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator

import httpx

from ..models import Provider


@dataclass
class UpstreamResponse:
    content_type: str | None = None
    content_length: int | None = None
    filename: str | None = None


class ProviderAdapter(ABC):
    """Streams a resource from one upstream provider.

    Implementations must be lazy: nothing is requested until ``open`` is
    awaited, so the manager can fall back to the next provider cheaply.
    """

    type_name: str = "base"

    def __init__(self, provider: Provider):
        self.provider = provider

    @abstractmethod
    async def open(self, resource: str, client: httpx.AsyncClient) -> UpstreamResponse:
        """Contact the upstream and validate the resource exists/starts."""

    @abstractmethod
    def stream(self, client: httpx.AsyncClient) -> AsyncIterator[bytes]:
        """Yield body chunks from the already-opened upstream response."""

    async def health_check(self, client: httpx.AsyncClient) -> bool:
        try:
            response = await client.get(self.provider.base_url, timeout=self.provider.timeout_seconds)
            return response.status_code < 500
        except httpx.HTTPError:
            return False
