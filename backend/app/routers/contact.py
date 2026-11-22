import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request, status

from ..crud import create_message, is_banned
from ..database import get_db
from ..deps import client_ip
from ..schemas import ContactCreated, ContactMessageIn
from ..services.telegram_bot import send_admin_alert
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/contact", tags=["contact"])


@router.post("", response_model=ContactCreated, status_code=status.HTTP_201_CREATED)
async def submit_message(data: ContactMessageIn, request: Request, db: AsyncSession = Depends(get_db)):
    ip = client_ip(request)
    if await is_banned(db, ip):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your access is restricted.")
    if data.kind == "pro_order" and not data.txid:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Transaction ID is required for orders")
    message = await create_message(db, data)
    if message.kind == "pro_order":
        alert = (
            f"New Pro order message\nName: {message.name}{f' ({message.phone})' if message.phone else ''}\n"
            f"TXID: {message.txid or '-'}\n{(message.body or '')[:500]}"
        )
    else:
        alert = f"New contact message\nName: {message.name}{f' ({message.phone})' if message.phone else ''}\n{(message.body or '')[:500]}"
    asyncio.create_task(send_admin_alert(alert))
    return ContactCreated(id=message.id)
