from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import uuid
from app.database import get_db
from app.deps import require_role
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.models.company import Company

router = APIRouter()


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    company_id: Optional[uuid.UUID] = None
    action: str
    entity_type: str
    entity_id: Optional[uuid.UUID] = None
    meta: Optional[dict] = None
    created_at: datetime
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    company_name: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("", response_model=List[AuditLogResponse])
def list_audit_logs(
    company_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.firm_admin, UserRole.platform_admin])),
):
    q = db.query(AuditLog)

    # Firm admin can only see logs for their firm's companies
    if current_user.role == UserRole.firm_admin:
        firm_company_ids = [
            str(c.id) for c in db.query(Company).filter(Company.firm_id == current_user.firm_id).all()
        ]
        # Include logs where company_id is in firm OR the user belongs to the firm
        from app.models.user import User as UserModel
        firm_user_ids = [
            str(u.id) for u in db.query(UserModel).filter(UserModel.firm_id == current_user.firm_id).all()
        ]
        q = q.filter(
            (AuditLog.company_id.in_(firm_company_ids)) |
            (AuditLog.user_id.in_(firm_user_ids))
        )

    if company_id:
        q = q.filter(AuditLog.company_id == company_id)
    if action:
        q = q.filter(AuditLog.action == action)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if date_from:
        try:
            q = q.filter(AuditLog.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            q = q.filter(AuditLog.created_at <= datetime.fromisoformat(date_to))
        except ValueError:
            pass

    logs = q.order_by(AuditLog.created_at.desc()).limit(limit).all()

    # Enrich with user/company names
    from app.models.user import User as UserModel
    user_cache: dict = {}
    company_cache: dict = {}

    results = []
    for log in logs:
        uid = str(log.user_id)
        if uid not in user_cache:
            u = db.query(UserModel).filter(UserModel.id == log.user_id).first()
            user_cache[uid] = u
        u = user_cache[uid]

        cid = str(log.company_id) if log.company_id else None
        if cid and cid not in company_cache:
            c = db.query(Company).filter(Company.id == log.company_id).first()
            company_cache[cid] = c
        c = company_cache.get(cid) if cid else None

        results.append(AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            company_id=log.company_id,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            meta=log.meta,
            created_at=log.created_at,
            user_email=u.email if u else None,
            user_name=u.full_name if u else None,
            company_name=c.name if c else None,
        ))

    return results
