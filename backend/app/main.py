import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import init_db
from .middleware.ratelimit import RateLimitMiddleware
from .provider_manager import AllProvidersFailedError, NoProviderError, UnknownAdapterError
from .routers import catalog, downloads, licenses, media, pro, providers, stats, videos

logging.basicConfig(level=logging.INFO)


from .services.video_service import cleanup_stuck_jobs


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await cleanup_stuck_jobs()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RateLimitMiddleware, limit=settings.rate_limit_requests, window_seconds=settings.rate_limit_window)
    app.include_router(providers.router)
    app.include_router(downloads.router)
    app.include_router(videos.router)
    app.include_router(catalog.router)
    app.include_router(media.router)
    app.include_router(stats.public_router)
    app.include_router(stats.admin_router)
    app.include_router(licenses.router)
    app.include_router(pro.router)

    @app.get("/health", tags=["ops"])
    async def health():
        return {"status": "ok", "app": settings.app_name}

    @app.exception_handler(NoProviderError)
    async def no_provider_handler(request, exc):
        from fastapi.responses import JSONResponse

        return JSONResponse(status_code=503, content={"detail": str(exc)})

    @app.exception_handler(AllProvidersFailedError)
    async def all_failed_handler(request, exc):
        from fastapi.responses import JSONResponse

        return JSONResponse(status_code=502, content={"detail": str(exc), "attempts": exc.attempts})

    @app.exception_handler(UnknownAdapterError)
    async def unknown_adapter_handler(request, exc):
        from fastapi.responses import JSONResponse

        return JSONResponse(status_code=500, content={"detail": str(exc)})

    return app


app = create_app()
