import uuid
import enum
from sqlalchemy import Column, String, Text, Numeric, Date, DateTime, ForeignKey, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class TransactionStatus(str, enum.Enum):
    pending_review = "pending_review"
    accepted = "accepted"
    rejected = "rejected"


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
    head_id = Column(UUID(as_uuid=True), ForeignKey("payment_heads.id"), nullable=True)
    sub_head_id = Column(UUID(as_uuid=True), ForeignKey("payment_sub_heads.id"), nullable=True)
    party_name = Column(String(255), nullable=True)
    amount = Column(Numeric(15, 2), nullable=True)
    transaction_date = Column(Date, nullable=True)
    description = Column(Text, nullable=True)
    extracted_data = Column(JSONB, nullable=True)
    raw_ai_output = Column(JSONB, nullable=True)
    confidence_score = Column(Numeric(3, 2), nullable=True)
    low_confidence_fields = Column(JSONB, nullable=True)
    rejection_note = Column(Text, nullable=True)
    status = Column(Enum(TransactionStatus), default=TransactionStatus.pending_review, nullable=False)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    document = relationship("Document", back_populates="transactions")
    company = relationship("Company", back_populates="transactions")
    head = relationship("PaymentHead", back_populates="transactions")
    sub_head = relationship("PaymentSubHead", back_populates="transactions")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    line_items = relationship("TransactionLineItem", back_populates="transaction", cascade="all, delete-orphan")


class TransactionLineItem(Base):
    __tablename__ = "transaction_line_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id"), nullable=False)
    description = Column(Text, nullable=True)
    hsn_code = Column(String(50), nullable=True)
    quantity = Column(Numeric(10, 3), nullable=True)
    unit_price = Column(Numeric(15, 2), nullable=True)
    amount = Column(Numeric(15, 2), nullable=True)
    tax_amount = Column(Numeric(15, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transaction = relationship("Transaction", back_populates="line_items")
