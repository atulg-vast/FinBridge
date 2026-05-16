from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.payment import PaymentHead, PaymentSubHead
from app.schemas.payment import HeadCreate, HeadResponse, SubHeadCreate, SubHeadResponse
from app.services.audit_service import log_action

router = APIRouter()

# Preset templates per business type
PRESET_TEMPLATES = {
    "Manufacturing": {
        "Raw Materials": ["Steel", "Plastics", "Chemicals", "Packaging"],
        "Salaries & Wages": ["Factory Workers", "Supervisors", "Management"],
        "Utilities": ["Electricity", "Water", "Gas"],
        "Maintenance": ["Machinery", "Infrastructure"],
        "Logistics": ["Inbound Freight", "Outbound Freight"],
        "Sales & Marketing": ["Advertising", "Sales Commission"],
        "Office Expenses": ["Stationery", "Rent", "Telephone"],
    },
    "IT": {
        "Salaries": ["Engineering", "Product", "Sales", "HR", "Operations"],
        "Infrastructure": ["Cloud (AWS/GCP)", "SaaS Tools", "Hardware"],
        "Marketing": ["Digital Ads", "Events", "Content"],
        "Legal & Compliance": ["Legal Fees", "Auditing"],
        "Office Expenses": ["Rent", "Utilities", "Stationery"],
        "Travel": ["Domestic", "International"],
    },
    "Services": {
        "Salaries": ["Senior Staff", "Junior Staff", "Contract"],
        "Operations": ["Office Rent", "Utilities", "Supplies"],
        "Marketing": ["Online", "Offline", "Referrals"],
        "Professional Fees": ["Legal", "Accounting", "Consulting"],
        "Travel & Conveyance": ["Client Visits", "Staff Travel"],
    },
    "Trading": {
        "Purchase": ["Domestic Goods", "Imported Goods", "Freight & Duty"],
        "Salaries": ["Sales Staff", "Warehouse Staff", "Admin"],
        "Warehouse": ["Rent", "Security", "Utilities"],
        "Logistics": ["Inward Freight", "Outward Freight"],
        "Marketing": ["Trade Fairs", "Ads", "Promotions"],
        "Office Expenses": ["Rent", "Stationery", "Telephone"],
    },
    "Other": {
        "Revenue": ["Primary Income", "Secondary Income"],
        "Operating Expenses": ["Salaries", "Rent", "Utilities"],
        "Marketing": ["Advertising", "Promotions"],
        "Miscellaneous": ["Other Expenses"],
    },
}


def _check_company_access(company_id: str, current_user: User, db: Session) -> Company:
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if current_user.role == UserRole.platform_admin:
        return company
    if current_user.role in (UserRole.firm_admin, UserRole.accountant):
        if str(current_user.firm_id) != str(company.firm_id):
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role in (UserRole.company_admin, UserRole.company_user):
        if str(current_user.company_id) != company_id:
            raise HTTPException(status_code=403, detail="Access denied")
    return company


# ── Payment Heads ──────────────────────────────────────────

@router.get("/{company_id}/payment-heads", response_model=List[HeadResponse])
def list_heads(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_company_access(company_id, current_user, db)
    return db.query(PaymentHead).filter(
        PaymentHead.company_id == company_id
    ).order_by(PaymentHead.created_at).all()


@router.post("/{company_id}/payment-heads", response_model=HeadResponse, status_code=status.HTTP_201_CREATED)
def create_head(
    company_id: str,
    payload: HeadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.firm_admin, UserRole.platform_admin])),
):
    _check_company_access(company_id, current_user, db)
    head = PaymentHead(company_id=company_id, name=payload.name.strip())
    db.add(head)
    log_action(db, current_user.id, "payment_head_created", "payment_head",
               entity_id=head.id, company_id=company_id,
               meta={"name": payload.name.strip()})
    db.commit()
    db.refresh(head)
    return head


@router.delete("/{company_id}/payment-heads/{head_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_head(
    company_id: str,
    head_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.firm_admin, UserRole.platform_admin])),
):
    _check_company_access(company_id, current_user, db)
    head = db.query(PaymentHead).filter(
        PaymentHead.id == head_id, PaymentHead.company_id == company_id
    ).first()
    if not head:
        raise HTTPException(status_code=404, detail="Payment head not found")
    log_action(db, current_user.id, "payment_head_deleted", "payment_head",
               entity_id=head.id, company_id=company_id,
               meta={"name": head.name})
    db.delete(head)
    db.commit()


# ── Sub Heads ──────────────────────────────────────────────

@router.get("/{company_id}/payment-heads/{head_id}/sub-heads", response_model=List[SubHeadResponse])
def list_sub_heads(
    company_id: str,
    head_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_company_access(company_id, current_user, db)
    return db.query(PaymentSubHead).filter(
        PaymentSubHead.company_id == company_id,
        PaymentSubHead.head_id == head_id,
    ).order_by(PaymentSubHead.created_at).all()


@router.post("/{company_id}/payment-heads/{head_id}/sub-heads", response_model=SubHeadResponse, status_code=status.HTTP_201_CREATED)
def create_sub_head(
    company_id: str,
    head_id: str,
    payload: SubHeadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.firm_admin, UserRole.platform_admin])),
):
    _check_company_access(company_id, current_user, db)
    head = db.query(PaymentHead).filter(
        PaymentHead.id == head_id, PaymentHead.company_id == company_id
    ).first()
    if not head:
        raise HTTPException(status_code=404, detail="Payment head not found")
    sub = PaymentSubHead(company_id=company_id, head_id=head_id, name=payload.name.strip())
    db.add(sub)
    log_action(db, current_user.id, "payment_sub_head_created", "payment_head",
               entity_id=sub.id, company_id=company_id,
               meta={"name": payload.name.strip(), "head_name": head.name})
    db.commit()
    db.refresh(sub)
    return sub


@router.delete("/{company_id}/payment-heads/{head_id}/sub-heads/{sub_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sub_head(
    company_id: str,
    head_id: str,
    sub_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.firm_admin, UserRole.platform_admin])),
):
    _check_company_access(company_id, current_user, db)
    sub = db.query(PaymentSubHead).filter(
        PaymentSubHead.id == sub_id,
        PaymentSubHead.head_id == head_id,
        PaymentSubHead.company_id == company_id,
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Sub-head not found")
    log_action(db, current_user.id, "payment_sub_head_deleted", "payment_head",
               entity_id=sub.id, company_id=company_id,
               meta={"name": sub.name})
    db.delete(sub)
    db.commit()


# ── Preset template ────────────────────────────────────────

@router.post("/{company_id}/payment-heads/apply-preset", status_code=status.HTTP_201_CREATED)
def apply_preset(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.firm_admin, UserRole.platform_admin])),
):
    company = _check_company_access(company_id, current_user, db)
    template = PRESET_TEMPLATES.get(company.business_type.value if hasattr(company.business_type, 'value') else company.business_type)
    if not template:
        raise HTTPException(status_code=400, detail="No preset available for this business type")

    created = 0
    for head_name, sub_names in template.items():
        head = PaymentHead(company_id=company_id, name=head_name)
        db.add(head)
        db.flush()
        for sub_name in sub_names:
            db.add(PaymentSubHead(company_id=company_id, head_id=head.id, name=sub_name))
        created += 1
    log_action(db, current_user.id, "payment_heads_preset_applied", "payment_head",
               company_id=company_id,
               meta={"business_type": str(company.business_type), "heads_created": created})
    db.commit()
    return {"message": f"Applied preset: {created} heads created", "business_type": str(company.business_type)}
