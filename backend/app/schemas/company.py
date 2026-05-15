from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
import uuid


class CompanyCreate(BaseModel):
    name: str
    business_type: str
    admin_full_name: str
    admin_email: EmailStr


class CompanyResponse(BaseModel):
    id: uuid.UUID
    firm_id: uuid.UUID
    name: str
    business_type: str
    created_at: datetime

    class Config:
        from_attributes = True


class CompanyCreateResponse(BaseModel):
    company: CompanyResponse
    admin_email: str
    admin_password: str
    message: str


class AccountantCreate(BaseModel):
    full_name: str
    email: EmailStr


class AccountantCreateResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    temp_password: str
    message: str
