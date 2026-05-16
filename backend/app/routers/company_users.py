import secrets
import string
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.deps import require_role
from app.models.user import User, UserRole
from app.models.company import Company
from app.schemas.company import CompanyUserCreate, CompanyUserUpdate, CompanyUserCreateResponse
from app.schemas.user import UserResponse
from app.services.auth_service import hash_password
from app.services.audit_service import log_action

router = APIRouter()


def _temp_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(chars) for _ in range(length))


@router.get("/users", response_model=List[UserResponse])
def list_company_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.company_admin])),
):
    return db.query(User).filter(
        User.company_id == current_user.company_id,
        User.role == UserRole.company_user,
    ).order_by(User.created_at.desc()).all()


@router.post("/users", response_model=CompanyUserCreateResponse, status_code=status.HTTP_201_CREATED)
def create_company_user(
    payload: CompanyUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.company_admin])),
):
    company = db.query(Company).filter(Company.id == current_user.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already in use")

    temp_password = _temp_password()
    user = User(
        firm_id=company.firm_id,
        company_id=current_user.company_id,
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(temp_password),
        role=UserRole.company_user,
    )
    db.add(user)
    log_action(db, current_user.id, "company_user_added", "user",
               entity_id=user.id, company_id=str(current_user.company_id),
               meta={"email": payload.email, "full_name": payload.full_name})
    db.commit()
    db.refresh(user)

    return CompanyUserCreateResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        temp_password=temp_password,
        message=f"User '{user.full_name}' added to {company.name}.",
    )


def _get_own_user(user_id: str, current_user: User, db: Session) -> User:
    user = db.query(User).filter(
        User.id == user_id,
        User.company_id == current_user.company_id,
        User.role == UserRole.company_user,
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_company_user(
    user_id: str,
    payload: CompanyUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.company_admin])),
):
    user = _get_own_user(user_id, current_user, db)
    user.full_name = payload.full_name.strip()
    log_action(db, current_user.id, "company_user_updated", "user",
               entity_id=user.id, company_id=str(current_user.company_id),
               meta={"email": user.email, "full_name": payload.full_name.strip()})
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.company_admin])),
):
    user = _get_own_user(user_id, current_user, db)
    log_action(db, current_user.id, "company_user_deleted", "user",
               entity_id=user.id, company_id=str(current_user.company_id),
               meta={"email": user.email, "full_name": user.full_name})
    db.delete(user)
    db.commit()
