from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.transaction import Transaction, TransactionStatus
from app.models.company import Company
from app.schemas.transaction import TransactionResponse, TransactionUpdate, ReviewAction

router = APIRouter()


def _check_access(transaction: Transaction, current_user: User):
    if current_user.role == UserRole.platform_admin:
        return
    if current_user.role in (UserRole.firm_admin, UserRole.accountant):
        return  # filtered at query level
    if current_user.role in (UserRole.company_admin, UserRole.company_user):
        if str(transaction.company_id) != str(current_user.company_id):
            raise HTTPException(status_code=403, detail="Access denied")


@router.get("", response_model=List[TransactionResponse])
def list_transactions(
    company_id: Optional[str] = None,
    document_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Transaction)

    if current_user.role in (UserRole.company_admin, UserRole.company_user):
        q = q.filter(Transaction.company_id == current_user.company_id)
    elif current_user.role in (UserRole.accountant, UserRole.firm_admin):
        firm_company_ids = [
            str(c.id) for c in db.query(Company).filter(Company.firm_id == current_user.firm_id).all()
        ]
        q = q.filter(Transaction.company_id.in_(firm_company_ids))
        if company_id:
            q = q.filter(Transaction.company_id == company_id)
    elif current_user.role == UserRole.platform_admin:
        if company_id:
            q = q.filter(Transaction.company_id == company_id)

    if document_id:
        q = q.filter(Transaction.document_id == document_id)
    if status:
        q = q.filter(Transaction.status == status)

    return q.order_by(Transaction.created_at.desc()).all()


@router.get("/{txn_id}", response_model=TransactionResponse)
def get_transaction(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    _check_access(txn, current_user)
    return txn


@router.put("/{txn_id}", response_model=TransactionResponse)
def update_transaction(
    txn_id: str,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.accountant, UserRole.firm_admin, UserRole.platform_admin])),
):
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.status != TransactionStatus.pending_review:
        raise HTTPException(status_code=400, detail="Only pending_review transactions can be edited")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(txn, field, value)

    db.commit()
    db.refresh(txn)
    return txn


@router.post("/{txn_id}/accept", response_model=TransactionResponse)
def accept_transaction(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.accountant, UserRole.firm_admin, UserRole.platform_admin])),
):
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.status != TransactionStatus.pending_review:
        raise HTTPException(status_code=400, detail="Transaction is not pending review")

    txn.status = TransactionStatus.accepted
    txn.reviewed_by = current_user.id
    txn.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(txn)
    return txn


@router.post("/{txn_id}/reject", response_model=TransactionResponse)
def reject_transaction(
    txn_id: str,
    payload: ReviewAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.accountant, UserRole.firm_admin, UserRole.platform_admin])),
):
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.status != TransactionStatus.pending_review:
        raise HTTPException(status_code=400, detail="Transaction is not pending review")
    if not payload.rejection_note:
        raise HTTPException(status_code=400, detail="Rejection note is required")

    txn.status = TransactionStatus.rejected
    txn.rejection_note = payload.rejection_note
    txn.reviewed_by = current_user.id
    txn.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(txn)
    return txn
