from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from jose import JWTError, jwt
from app.database import get_db
from app.deps import get_current_user
from app.config import settings
from app.models.user import User
from app.models.notification import Notification
from app.services.notification_service import stream_for_user
from pydantic import BaseModel
import uuid

router = APIRouter()


class NotificationResponse(BaseModel):
    id: uuid.UUID
    message: str
    type: str
    entity_id: Optional[uuid.UUID] = None
    entity_type: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/stream")
async def notification_stream(
    token: Optional[str] = None,
    request: Request = None,
    db: Session = Depends(get_db),
):
    """SSE endpoint. Accepts token via query param (EventSource can't set headers)."""
    raw_token = token
    if not raw_token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            raw_token = auth[7:]

    if not raw_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(raw_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return StreamingResponse(
        stream_for_user(str(user.id)),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("", response_model=List[NotificationResponse])
def list_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        q = q.filter(Notification.is_read == False)
    return q.order_by(Notification.created_at.desc()).limit(50).all()


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}
