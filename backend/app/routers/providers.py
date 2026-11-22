from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud import create_provider, delete_provider, get_provider, get_provider_by_name, list_providers, update_provider
from ..database import get_db
from ..deps import require_admin
from ..provider_manager import manager
from ..providers import ADAPTERS
from ..schemas import ProviderCreate, ProviderOut, ProviderUpdate

router = APIRouter(prefix="/api/admin/providers", tags=["admin-providers"], dependencies=[Depends(require_admin)])


def _validate(data_adapter: str, base_url: str | None) -> None:
    if data_adapter not in ADAPTERS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"unknown adapter '{data_adapter}'")
    if data_adapter != "ytdlp" and not (base_url or "").strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="base_url is required for this adapter")


@router.get("", response_model=list[ProviderOut])
async def list_all(db: AsyncSession = Depends(get_db)):
    providers = await list_providers(db)
    return [ProviderOut.from_model(p) for p in providers]


@router.post("", response_model=ProviderOut, status_code=status.HTTP_201_CREATED)
async def create(data: ProviderCreate, db: AsyncSession = Depends(get_db)):
    if await get_provider_by_name(db, data.name):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"provider '{data.name}' already exists")
    _validate(data.adapter, data.base_url)
    return ProviderOut.from_model(await create_provider(db, data))


@router.get("/{provider_id}", response_model=ProviderOut)
async def read(provider_id: int, db: AsyncSession = Depends(get_db)):
    provider = await get_provider(db, provider_id)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="provider not found")
    return ProviderOut.from_model(provider)


@router.patch("/{provider_id}", response_model=ProviderOut)
async def patch(provider_id: int, data: ProviderUpdate, db: AsyncSession = Depends(get_db)):
    provider = await get_provider(db, provider_id)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="provider not found")
    if data.name and data.name != provider.name and await get_provider_by_name(db, data.name):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"provider '{data.name}' already exists")
    _validate(data.adapter or provider.adapter, data.base_url if data.base_url is not None else provider.base_url)
    return ProviderOut.from_model(await update_provider(db, provider, data))


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove(provider_id: int, db: AsyncSession = Depends(get_db)):
    provider = await get_provider(db, provider_id)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="provider not found")
    await delete_provider(db, provider)


@router.post("/{provider_id}/test")
async def test_provider(provider_id: int, db: AsyncSession = Depends(get_db)):
    provider = await get_provider(db, provider_id)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="provider not found")
    results = await manager.health_check_chain(db)
    return next((r for r in results if r["provider_id"] == provider_id), {"provider_id": provider_id, "status": "unknown"})
