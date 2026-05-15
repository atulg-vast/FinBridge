from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
import uuid


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    firm_id: Optional[uuid.UUID]
    company_id: Optional[uuid.UUID]
    created_at: datetime

    class Config:
        from_attributes = True
