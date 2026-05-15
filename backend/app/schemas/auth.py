from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserMeResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    firm_id: Optional[uuid.UUID]
    company_id: Optional[uuid.UUID]
    is_active: bool

    class Config:
        from_attributes = True
