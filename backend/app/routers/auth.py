from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserMeResponse
from app.services.auth_service import verify_password, create_access_token
from app.deps import get_current_user

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email, User.is_active == True).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value,
        "firm_id": str(user.firm_id) if user.firm_id else None,
        "company_id": str(user.company_id) if user.company_id else None,
    })
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserMeResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout():
    return {"message": "Logged out successfully"}
