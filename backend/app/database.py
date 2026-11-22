from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings


class Base(DeclarativeBase):
    pass


_engine: AsyncEngine | None = None
_session_maker: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(get_settings().database_url, echo=False, future=True)
    return _engine


def session_maker() -> async_sessionmaker[AsyncSession]:
    global _session_maker
    if _session_maker is None:
        _session_maker = async_sessionmaker(get_engine(), class_=AsyncSession, expire_on_commit=False)
    return _session_maker


def reset_engine() -> None:
    global _engine, _session_maker
    _engine = None
    _session_maker = None


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with session_maker()() as session:
        yield session


async def init_db() -> None:
    from . import models  # noqa: F401

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _migrate(engine)
    from .crud import ensure_default_providers

    async with session_maker()() as session:
        await ensure_default_providers(session)


async def _migrate(engine: AsyncEngine) -> None:
    statements = [
        "ALTER TABLE download_jobs ADD COLUMN quality VARCHAR(10)",
    ]
    for statement in statements:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(statement))
        except Exception:
            pass
