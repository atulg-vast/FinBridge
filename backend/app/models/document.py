import uuid
import enum
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class DocumentStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    extracted = "extracted"
    failed = "failed"


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    document_type_id = Column(UUID(as_uuid=True), ForeignKey("document_types.id"), nullable=False)
    file_path = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=False)
    status = Column(Enum(DocumentStatus), default=DocumentStatus.pending, nullable=False)
    error_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="documents")
    uploader = relationship("User", back_populates="uploaded_documents", foreign_keys=[uploaded_by])
    document_type = relationship("DocumentType", back_populates="documents")
    transactions = relationship("Transaction", back_populates="document", cascade="all, delete-orphan")
