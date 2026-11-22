import os

os.environ["ADMIN_TOKEN"] = "test-token"

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.database import Base
from app.main import app

AUTH = {"X-Admin-Token": "test-token"}


@pytest_asyncio.fixture
async def client(tmp_path):
    from app import database
    from app.config import get_settings

    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{tmp_path}/test.db"
    get_settings.cache_clear()
    database.reset_engine()
    engine = database.get_engine()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    await engine.dispose()
    database.reset_engine()
    get_settings.cache_clear()
