"""
Notification service — creates DB notifications and pushes to SSE streams.
"""
import asyncio
import json
from datetime import datetime, timezone
from typing import AsyncGenerator
from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.models.company import Company

# In-memory SSE queues per user_id (str → asyncio.Queue)
_streams: dict[str, list[asyncio.Queue]] = {}


def _push(user_id: str, payload: dict):
    """Push a notification payload to all open SSE streams for a user."""
    for q in _streams.get(str(user_id), []):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass


def create_notification(
    db: Session,
    user_id,
    message: str,
    type: str,
    entity_id=None,
    entity_type: str | None = None,
):
    now = datetime.now(timezone.utc)
    n = Notification(
        user_id=user_id,
        message=message,
        type=type,
        entity_id=entity_id,
        entity_type=entity_type,
        created_at=now,
    )
    db.add(n)
    db.flush()  # get the auto-generated id

    payload = {
        "id": str(n.id),
        "message": message,
        "type": type,
        "entity_id": str(entity_id) if entity_id else None,
        "entity_type": entity_type,
        "is_read": False,
        "created_at": now.isoformat(),
    }
    _push(str(user_id), payload)
    return n


def notify_company_users(db: Session, company_id, message: str, type: str, entity_id=None, entity_type: str | None = None):
    """Notify all active company_admin and company_user in a company."""
    from app.models.user import UserRole
    users = db.query(User).filter(
        User.company_id == company_id,
        User.role.in_([UserRole.company_admin, UserRole.company_user]),
        User.is_active == True,
    ).all()
    for u in users:
        create_notification(db, u.id, message, type, entity_id, entity_type)


def notify_firm_accountants(db: Session, firm_id, message: str, type: str, entity_id=None, entity_type: str | None = None):
    """Notify all active accountants in a firm."""
    users = db.query(User).filter(
        User.firm_id == firm_id,
        User.role.in_([UserRole.accountant, UserRole.firm_admin]),
        User.is_active == True,
    ).all()
    for u in users:
        create_notification(db, u.id, message, type, entity_id, entity_type)


async def stream_for_user(user_id: str) -> AsyncGenerator[str, None]:
    """Async generator that yields SSE-formatted events for a user."""
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    _streams.setdefault(user_id, []).append(q)
    try:
        # Send a heartbeat immediately so browser knows connection is alive
        yield "event: connected\ndata: {}\n\n"
        while True:
            try:
                payload = await asyncio.wait_for(q.get(), timeout=30)
                yield f"event: notification\ndata: {json.dumps(payload)}\n\n"
            except asyncio.TimeoutError:
                yield ": heartbeat\n\n"
    finally:
        _streams[user_id].remove(q)
        if not _streams[user_id]:
            del _streams[user_id]
