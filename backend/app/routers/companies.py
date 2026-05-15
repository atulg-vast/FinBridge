import secrets
import string
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.company import Company, BusinessType
from app.models.firm import AccountingFirm
from app.schemas.company import (
    CompanyCreate, CompanyResponse, CompanyCreateResponse,
    AccountantCreate, AccountantCreateResponse,
)
from app.schemas.user import UserResponse
from app.services.auth_service import hash_password

router = APIRouter()


def _temp_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(chars) for _ in range(length))


# ── Companies ──────────────────────────────────────────────

@router.get("/{firm_id}/companies", response_model=List[CompanyResponse])
def list_companies(
    firm_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.firm_admin:
        if str(current_user.firm_id) != firm_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role != UserRole.platform_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    return db.query(Company).filter(Company.firm_id == firm_id).order_by(Company.created_at.desc()).all()


@router.post("/{firm_id}/companies", response_model=CompanyCreateResponse, status_code=status.HTTP_201_CREATED)
def create_company(
    firm_id: str,
    payload: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.firm_admin])),
):
    if str(current_user.firm_id) != firm_id:
        raise HTTPException(status_code=403, detail="Access denied")

    firm = db.query(AccountingFirm).filter(AccountingFirm.id == firm_id).first()
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found")

    if db.query(User).filter(User.email == payload.admin_email).first():
        raise HTTPException(status_code=400, detail="Email already in use")

    try:
        btype = BusinessType(payload.business_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid business type. Choose from: {[e.value for e in BusinessType]}")

    company = Company(firm_id=firm_id, name=payload.name, business_type=btype)
    db.add(company)
    db.flush()

    temp_password = _temp_password()
    admin = User(
        firm_id=firm_id,
        company_id=company.id,
        email=payload.admin_email,
        full_name=payload.admin_full_name,
        password_hash=hash_password(temp_password),
        role=UserRole.company_admin,
    )
    db.add(admin)
    db.commit()
    db.refresh(company)

    return CompanyCreateResponse(
        company=CompanyResponse.model_validate(company),
        admin_email=payload.admin_email,
        admin_password=temp_password,
        message=f"Company '{company.name}' created successfully.",
    )


# ── Accountants ────────────────────────────────────────────

@router.get("/{firm_id}/accountants", response_model=List[UserResponse])
def list_accountants(
    firm_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.firm_admin:
        if str(current_user.firm_id) != firm_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role != UserRole.platform_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    return db.query(User).filter(
        User.firm_id == firm_id,
        User.role == UserRole.accountant,
    ).order_by(User.created_at.desc()).all()


@router.post("/{firm_id}/accountants", response_model=AccountantCreateResponse, status_code=status.HTTP_201_CREATED)
def create_accountant(
    firm_id: str,
    payload: AccountantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.firm_admin])),
):
    if str(current_user.firm_id) != firm_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already in use")

    temp_password = _temp_password()
    accountant = User(
        firm_id=firm_id,
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(temp_password),
        role=UserRole.accountant,
    )
    db.add(accountant)
    db.commit()
    db.refresh(accountant)

    return AccountantCreateResponse(
        id=accountant.id,
        email=accountant.email,
        full_name=accountant.full_name,
        role=accountant.role.value,
        temp_password=temp_password,
        message=f"Accountant '{accountant.full_name}' added successfully.",
    )
