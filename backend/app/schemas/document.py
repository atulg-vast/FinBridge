from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class DocumentTypeResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str]
    accepted_file_formats: list

    class Config:
        from_attributes = True


class DocumentResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    uploaded_by: uuid.UUID
    document_type_id: uuid.UUID
    original_filename: str
    status: str
    error_reason: Optional[str]
    created_at: datetime
    document_type: Optional[DocumentTypeResponse] = None

    class Config:
        from_attributes = True
