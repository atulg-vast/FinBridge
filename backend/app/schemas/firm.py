from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
import uuid


class FirmCreate(BaseModel):
    name: str
    admin_full_name: str
    admin_email: EmailStr


class FirmResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    created_at: datetime

    class Config:
        from_attributes = True


class FirmCreateResponse(BaseModel):
    firm: FirmResponse
    admin_email: str
    admin_password: str
    message: str
