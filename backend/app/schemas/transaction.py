from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime, date
from decimal import Decimal
import uuid


class LineItemResponse(BaseModel):
    id: uuid.UUID
    description: Optional[str]
    hsn_code: Optional[str]
    quantity: Optional[Decimal]
    unit_price: Optional[Decimal]
    amount: Optional[Decimal]
    tax_amount: Optional[Decimal]

    class Config:
        from_attributes = True


class TransactionResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    company_id: uuid.UUID
    head_id: Optional[uuid.UUID]
    sub_head_id: Optional[uuid.UUID]
    party_name: Optional[str]
    amount: Optional[Decimal]
    transaction_date: Optional[date]
    description: Optional[str]
    extracted_data: Optional[Any]
    confidence_score: Optional[Decimal]
    low_confidence_fields: Optional[Any]
    rejection_note: Optional[str]
    status: str
    reviewed_by: Optional[uuid.UUID]
    reviewed_at: Optional[datetime]
    created_at: datetime
    line_items: List[LineItemResponse] = []

    class Config:
        from_attributes = True


class TransactionUpdate(BaseModel):
    party_name: Optional[str] = None
    amount: Optional[Decimal] = None
    transaction_date: Optional[date] = None
    description: Optional[str] = None
    head_id: Optional[uuid.UUID] = None
    sub_head_id: Optional[uuid.UUID] = None
    extracted_data: Optional[Any] = None


class ReviewAction(BaseModel):
    rejection_note: Optional[str] = None
