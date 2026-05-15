import uuid
from sqlalchemy import Column, String, Text, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class DocumentType(Base):
    __tablename__ = "document_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    extraction_prompt_template = Column(Text, nullable=False)
    expected_fields = Column(JSONB, nullable=False)
    accepted_file_formats = Column(JSONB, nullable=False, default=["pdf", "jpg", "jpeg", "png"])
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    documents = relationship("Document", back_populates="document_type")
