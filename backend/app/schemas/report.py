from pydantic import BaseModel
from datetime import datetime
import uuid


class ReportResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    uploaded_by: uuid.UUID
    title: str
    original_filename: str
    created_at: datetime

    class Config:
        from_attributes = True
