
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud import valid_license
from ..database import get_db
from ..models import utcnow

router = APIRouter(prefix="/api/pro", tags=["pro"])

FEATURES = {
    "daily_limit": "1000 downloads per day",
    "playlist": "download full playlists",
    "no_ads": "no ads",
    "priority": "priority processing",
}


class RedeemRequest(BaseModel):
    key: str = Field(min_length=4, max_length=64)


@router.post("/redeem")
async def redeem(data: RedeemRequest, db: AsyncSession = Depends(get_db)):
    license = await valid_license(db, data.key)
    if license is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This key is not valid or has expired.")
    if license.redeemed_at is None:
        license.redeemed_at = utcnow()
        await db.commit()
    return {
        "valid": True,
        "plan": license.plan,
        "expires_at": jsonable_encoder(license.expires_at),
        "features": list(FEATURES.keys()),
    }


@router.get("/status")
async def pro_status(key: str = Query(min_length=1, max_length=64), db: AsyncSession = Depends(get_db)):
    license = await valid_license(db, key)
    if license is None:
        return {"valid": False}
    return {
        "valid": True,
        "plan": license.plan,
        "expires_at": jsonable_encoder(license.expires_at),
        "features": list(FEATURES.keys()),
    }
