import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class PaymentHead(Base):
    __tablename__ = "payment_heads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="payment_heads")
    sub_heads = relationship("PaymentSubHead", back_populates="head", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="head")


class PaymentSubHead(Base):
    __tablename__ = "payment_sub_heads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    head_id = Column(UUID(as_uuid=True), ForeignKey("payment_heads.id"), nullable=False)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    head = relationship("PaymentHead", back_populates="sub_heads")
    transactions = relationship("Transaction", back_populates="sub_head")
