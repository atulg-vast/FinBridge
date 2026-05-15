from pydantic import BaseModel
from datetime import datetime
from typing import List
import uuid


class SubHeadCreate(BaseModel):
    name: str


class SubHeadResponse(BaseModel):
    id: uuid.UUID
    head_id: uuid.UUID
    company_id: uuid.UUID
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


class HeadCreate(BaseModel):
    name: str


class HeadResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    created_at: datetime
    sub_heads: List[SubHeadResponse] = []

    class Config:
        from_attributes = True
