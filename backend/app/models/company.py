import uuid
import enum
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class BusinessType(str, enum.Enum):
    manufacturing = "Manufacturing"
    it = "IT"
    services = "Services"
    trading = "Trading"
    other = "Other"


class Company(Base):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firm_id = Column(UUID(as_uuid=True), ForeignKey("accounting_firms.id"), nullable=False)
    name = Column(String(255), nullable=False)
    business_type = Column(Enum(BusinessType), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    firm = relationship("AccountingFirm", back_populates="companies")
    users = relationship("User", back_populates="company", foreign_keys="User.company_id")
    payment_heads = relationship("PaymentHead", back_populates="company", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="company")
    transactions = relationship("Transaction", back_populates="company")
    reports = relationship("Report", back_populates="company")
    audit_logs = relationship("AuditLog", back_populates="company")
