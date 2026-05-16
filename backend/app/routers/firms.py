import secrets
import string
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import require_role
from app.models.user import User, UserRole
from app.models.firm import AccountingFirm
from app.schemas.firm import FirmCreate, FirmResponse, FirmCreateResponse
from app.schemas.user import UserResponse
from app.services.auth_service import hash_password
from app.services.audit_service import log_action
from typing import List

router = APIRouter()


def _make_slug(name: str) -> str:
    return name.lower().replace(" ", "-").replace("_", "-")


def _temp_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(chars) for _ in range(length))


@router.get("", response_model=List[FirmResponse])
def list_firms(
    db: Session = Depends(get_db),
    _=Depends(require_role([UserRole.platform_admin])),
):
    return db.query(AccountingFirm).order_by(AccountingFirm.created_at.desc()).all()


@router.post("", response_model=FirmCreateResponse, status_code=status.HTTP_201_CREATED)
def create_firm(
    payload: FirmCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role([UserRole.platform_admin])),
):
    slug = _make_slug(payload.name)
    if db.query(AccountingFirm).filter(AccountingFirm.slug == slug).first():
        raise HTTPException(status_code=400, detail="A firm with this name already exists")

    if db.query(User).filter(User.email == payload.admin_email).first():
        raise HTTPException(status_code=400, detail="Email already in use")

    firm = AccountingFirm(name=payload.name, slug=slug)
    db.add(firm)
    db.flush()

    temp_password = _temp_password()
    admin = User(
        firm_id=firm.id,
        email=payload.admin_email,
        full_name=payload.admin_full_name,
        password_hash=hash_password(temp_password),
        role=UserRole.firm_admin,
    )
    db.add(admin)
    log_action(db, admin.id, "firm_created", "firm",
               entity_id=firm.id,
               meta={"firm_name": firm.name, "admin_email": payload.admin_email})
    db.commit()
    db.refresh(firm)

    return FirmCreateResponse(
        firm=FirmResponse.model_validate(firm),
        admin_email=payload.admin_email,
        admin_password=temp_password,
        message=f"Firm '{firm.name}' created. Share credentials with the firm admin.",
    )


@router.get("/{firm_id}", response_model=FirmResponse)
def get_firm(
    firm_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_role([UserRole.platform_admin])),
):
    firm = db.query(AccountingFirm).filter(AccountingFirm.id == firm_id).first()
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found")
    return firm


@router.get("/{firm_id}/users", response_model=List[UserResponse])
def list_firm_users(
    firm_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_role([UserRole.platform_admin])),
):
    return db.query(User).filter(User.firm_id == firm_id).all()
