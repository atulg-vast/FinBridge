from sqlalchemy.orm import Session
from app.models.audit import AuditLog


def log_action(
    db: Session,
    user_id,
    action: str,
    entity_type: str,
    entity_id=None,
    company_id=None,
    meta: dict | None = None,
):
    entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        company_id=company_id,
        meta=meta or {},
    )
    db.add(entry)
    # Caller is responsible for db.commit()
