import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    """In-memory fixed-window limiter per client IP for selected API paths."""

    def __init__(self, app, limit: int = 60, window_seconds: float = 60.0, paths: tuple[str, ...] = ("/api/info", "/api/downloads")):
        super().__init__(app)
        self.limit = limit
        self.window = window_seconds
        self.paths = paths
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request, call_next):
        if request.method not in ("GET", "POST") or not request.url.path.startswith(self.paths):
            return await call_next(request)
        client = request.client
        key = client.host if client else "unknown"
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            return JSONResponse(
                status_code=429,
                content={"detail": "too many requests, please slow down"},
            )
        hits.append(now)
        if len(self._hits) > 10000:
            self._hits.clear()
        return await call_next(request)
