from .base import ProviderAdapter, UpstreamResponse
from .http_mirror import HttpMirrorAdapter
from .proxy_pass import ProxyPassAdapter
from .ytdlp import YtDlpAdapter, VideoResolutionError, extract_info_sync, summarize

ADAPTERS: dict[str, type[ProviderAdapter]] = {
    HttpMirrorAdapter.type_name: HttpMirrorAdapter,
    ProxyPassAdapter.type_name: ProxyPassAdapter,
    YtDlpAdapter.type_name: YtDlpAdapter,
}

__all__ = [
    "ADAPTERS",
    "ProviderAdapter",
    "UpstreamResponse",
    "HttpMirrorAdapter",
    "ProxyPassAdapter",
    "YtDlpAdapter",
    "VideoResolutionError",
    "extract_info_sync",
    "summarize",
]
