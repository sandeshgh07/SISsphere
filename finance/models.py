from sqlalchemy import Column, String, ForeignKey, Float, DateTime, Index, UniqueConstraint, Enum, Integer, JSON
from sqlalchemy.orm import relationship
from database import Base
import uuid
import enum
from datetime import datetime, timezone

def generate_uuid():
    return str(uuid.uuid4())

class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PENDING = "PENDING"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"
    CANCELLED = "CANCELLED"

class PaymentIntentStatus(str, enum.Enum):
    CREATED = "CREATED"
    PENDING = "PENDING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"

class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"
    REJECTED = "REJECTED"

class EntrySource(str, enum.Enum):
    REMOTE = "REMOTE"
    OFFICE_CASH = "OFFICE_CASH"
    AUTOMATED = "AUTOMATED"

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    total_amount = Column(Float, nullable=False) # Was amount_due
    amount_paid = Column(Float, default=0.0, nullable=False)
    currency = Column(String, default="USD", nullable=False)
    status = Column(String, default=InvoiceStatus.DRAFT, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_invoices_school_id_id", "school_id", "id"),
    )

class PaymentIntent(Base):
    __tablename__ = "payment_intents"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False)
    idempotency_key = Column(String, unique=True, nullable=False)
    status = Column(String, default=PaymentIntentStatus.CREATED, nullable=False)
    gateway_session_id = Column(String, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_payment_intents_school_id", "school_id"),
    )

class Payment(Base):
    __tablename__ = "payments"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=True) # Made nullable to support direct Fee payment
    fee_id = Column(String, ForeignKey("fees.id"), nullable=True) # Added to link to Fees
    payment_intent_id = Column(String, ForeignKey("payment_intents.id"), nullable=True)

    gateway = Column(String, nullable=True)
    gateway_txn_id = Column(String, nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False)
    status = Column(String, nullable=False)
    raw_event = Column(JSON, nullable=True)

    # Hybrid Payment Entry Fields
    entry_source = Column(Enum(EntrySource), default=EntrySource.AUTOMATED, nullable=False)
    verifier_id = Column(String, ForeignKey("users.id"), nullable=True)
    receipt_url = Column(String, nullable=True)
    notes = Column(String, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint('gateway', 'gateway_txn_id', name='uq_payment_gateway_txn'),
        Index("idx_payments_school_id", "school_id"),
    )

class Fee(Base):
    __tablename__ = "fees"
    id = Column(String, primary_key=True, default=generate_uuid)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=False)
    status = Column(String, default="pending") # pending, paid
    due_date = Column(DateTime, nullable=True)
    paid_date = Column(DateTime, nullable=True) # Added for payment speed analysis
    receipt_url = Column(String, nullable=True) # Added for payment evidence
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)

    __table_args__ = (
        Index("idx_fees_school_id_id", "school_id", "id"),
    )

class PaymentPlanStatus(str, enum.Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class InstallmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    OVERDUE = "OVERDUE"

class PaymentPlan(Base):
    __tablename__ = "payment_plans"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=False)
    status = Column(Enum(PaymentPlanStatus), default=PaymentPlanStatus.PENDING_APPROVAL)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    approved_by_id = Column(String, ForeignKey("users.id"), nullable=True)

class Installment(Base):
    __tablename__ = "installments"
    id = Column(String, primary_key=True, default=generate_uuid)
    payment_plan_id = Column(String, ForeignKey("payment_plans.id"), nullable=False)
    due_date = Column(DateTime, nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(Enum(InstallmentStatus), default=InstallmentStatus.PENDING)
