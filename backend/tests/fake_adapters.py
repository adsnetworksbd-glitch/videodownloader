import httpx

from app.providers.base import ProviderAdapter, UpstreamResponse


class FakeOkAdapter(ProviderAdapter):
    type_name = "fake_ok"

    async def open(self, resource: str, client: httpx.AsyncClient) -> UpstreamResponse:
        return UpstreamResponse(content_type="text/plain", content_length=12, filename=None)

    async def stream(self, client: httpx.AsyncClient):
        yield b"hello "
        yield b"stream"


class FakeFailAdapter(ProviderAdapter):
    type_name = "fake_fail"

    async def open(self, resource: str, client: httpx.AsyncClient) -> UpstreamResponse:
        raise httpx.ConnectError(f"mirror {self.provider.name} is down")

    async def stream(self, client: httpx.AsyncClient):
        yield b""


def register() -> None:
    from app.providers import ADAPTERS

    ADAPTERS[FakeOkAdapter.type_name] = FakeOkAdapter
    ADAPTERS[FakeFailAdapter.type_name] = FakeFailAdapter
