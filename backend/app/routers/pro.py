
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud import (
    create_license,
    effective_int,
    is_banned,
    list_packages,
    txid_taken,
    valid_license,
)
from ..database import get_db
from ..deps import client_ip
from ..services.telegram_bot import send_admin_alert
from ..models import ProPackage, ProOrder, utcnow

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




class PurchaseRequest(BaseModel):
    package_id: int
    txid: str = Field(min_length=6, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    contact: str | None = Field(default=None, max_length=120)


@router.get("/packages")
async def public_packages(db: AsyncSession = Depends(get_db)):
    rows = await list_packages(db, active_only=True)
    return [
        {
            "id": row.id,
            "name": row.name,
            "price": row.price,
            "duration_days": row.duration_days,
            "description": row.description,
        }
        for row in rows
    ]


@router.post("/purchase", status_code=status.HTTP_201_CREATED)
async def purchase(data: PurchaseRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = client_ip(request)
    if await is_banned(db, ip):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your access is restricted.")
    package = await db.get(ProPackage, data.package_id)
    if package is None or not package.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This package is not available.")
    if await txid_taken(db, data.txid):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This transaction ID was already used.")
    instant = await effective_int(db, "pro_instant_activation", 1)
    license = await create_license(
        db, plan=package.name, days=package.duration_days, note=f"package {package.id} txid {data.txid}"
    )
    if not instant:
        license.is_active = False
        await db.commit()
    order = ProOrder(
        package_id=package.id,
        txid=data.txid,
        contact=data.contact,
        status="completed" if instant else "pending",
        license_key=license.key,
        ip=ip,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    asyncio.create_task(
        send_admin_alert(
            f"New Pro purchase\nPackage: {package.name} ({package.price} Tk)\n"
            f"TXID: {data.txid}\nContact: {data.contact or '-'}\nStatus: {order.status}"
        )
    )
    return {
        "status": order.status,
        "key": license.key,
        "plan": license.plan,
        "expires_at": jsonable_encoder(license.expires_at),
        "message": (
            "Your Pro key is active right now — keep it safe, it is already applied."
            if instant
            else "Order received! Your key will activate after the admin approves the transaction."
        ),
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
