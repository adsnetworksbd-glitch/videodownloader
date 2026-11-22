from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud import create_license, deactivate_license, list_licenses
from ..database import get_db
from ..deps import require_admin
from ..models import LicenseKey
from ..schemas import LicenseCreate, LicenseOut, LicenseUpdate

router = APIRouter(prefix="/api/admin/licenses", tags=["licenses"], dependencies=[Depends(require_admin)])


@router.post("", response_model=LicenseOut, status_code=status.HTTP_201_CREATED)
async def create(data: LicenseCreate, db: AsyncSession = Depends(get_db)):
    return await create_license(db, data.plan, data.days, data.note)


@router.get("", response_model=list[LicenseOut])
async def list_all(limit: int = 200, db: AsyncSession = Depends(get_db)):
    return await list_licenses(db, limit=min(max(limit, 1), 500))




@router.patch("/{key}", response_model=LicenseOut)
async def update(key: str, data: LicenseUpdate, db: AsyncSession = Depends(get_db)):
    license = await db.get(LicenseKey, key)
    if license is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="license not found")
    if data.is_active is not None:
        license.is_active = data.is_active
    await db.commit()
    await db.refresh(license)
    return license


@router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def remove(key: str, db: AsyncSession = Depends(get_db)):
    license = await db.get(LicenseKey, key)
    if license is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="license not found")
    await deactivate_license(db, license)
