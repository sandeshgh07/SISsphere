from sqlalchemy import Column, String, ForeignKey, Float, DateTime, Index, UniqueConstraint, Enum, Integer, JSON, Numeric
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
    total_amount = Column(Numeric(10, 2), nullable=False) # Was amount_due - Precision for currency
    amount_paid = Column(Numeric(10, 2), default=0.0, nullable=False)
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
    amount = Column(Numeric(10, 2), nullable=False)
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
    amount = Column(Numeric(10, 2), nullable=False)
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
    amount = Column(Numeric(10, 2), nullable=False)
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
    amount = Column(Numeric(10, 2), nullable=False)
    status = Column(Enum(InstallmentStatus), default=InstallmentStatus.PENDING)


# ============================================
# NEW FEE TEMPLATES BILLING SYSTEM MODELS
# ============================================

class BillingType(str, enum.Enum):
    """Whether a fee is charged once or repeatedly"""
    ONE_TIME = "ONE_TIME"
    RECURRING = "RECURRING"


class RecurrenceType(str, enum.Enum):
    """Frequency for recurring fees"""
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    YEARLY = "YEARLY"


class DiscountType(str, enum.Enum):
    """How the discount is calculated"""
    PERCENT = "PERCENT"
    FIXED_AMOUNT = "FIXED_AMOUNT"
    FULL_WAIVER = "FULL_WAIVER"


class DiscountScope(str, enum.Enum):
    """Whether discount applies to a specific student or a group rule"""
    STUDENT_SPECIFIC = "STUDENT_SPECIFIC"
    GROUP_RULE = "GROUP_RULE"  # Future extension for auto-selection


class StudentInvoiceStatus(str, enum.Enum):
    """Status for auto-generated student invoices"""
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PARTIAL = "PARTIAL"
    PAID = "PAID"
    VOID = "VOID"


class FeeItemTemplate(Base):
    """
    Grade-scoped fee definition (e.g., Tuition Fee, Exam Fee, Bus Fee).
    This is a template that applies to all students in a grade (or all grades).
    """
    __tablename__ = "fee_item_templates"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    title = Column(String(200), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), default="NPR")
    
    # NULL = applies to all grades, otherwise specific grade
    grade_id = Column(String, ForeignKey("grades.id"), nullable=True)
    
    billing_type = Column(Enum(BillingType), nullable=False, default=BillingType.RECURRING)
    recurrence = Column(Enum(RecurrenceType), nullable=True)  # Required if RECURRING
    
    # Period range for when this fee applies (YYYY-MM format)
    start_period = Column(String(7), nullable=True)  # e.g., "2026-01"
    end_period = Column(String(7), nullable=True)    # NULL = no end
    
    # Optional add-on (e.g., Bus, Hostel) - students must be enrolled
    is_optional_addon = Column(String(5), default="false")  # "true" or "false" for SQLite compatibility
    is_active = Column(String(5), default="true")
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        Index("idx_fee_templates_school_id", "school_id"),
        Index("idx_fee_templates_school_grade", "school_id", "grade_id"),
        Index("idx_fee_templates_school_active", "school_id", "is_active"),
    )


class StudentAddonEnrollment(Base):
    """
    Student-specific enrollment in optional add-on fees (e.g., Bus, Hostel).
    Only templates with is_optional_addon=true require enrollment.
    """
    __tablename__ = "student_addon_enrollments"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    fee_template_id = Column(String, ForeignKey("fee_item_templates.id"), nullable=False)
    
    status = Column(String(20), default="active")  # active/inactive
    start_period = Column(String(7), nullable=True)  # YYYY-MM
    end_period = Column(String(7), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    
    __table_args__ = (
        Index("idx_addon_school_student", "school_id", "student_id"),
        Index("idx_addon_school_template", "school_id", "fee_template_id"),
        UniqueConstraint("school_id", "student_id", "fee_template_id", name="uq_student_addon_enrollment"),
    )


class DiscountRule(Base):
    """
    Student-scoped discounts that apply automatically to invoices.
    Supports recurring and one-time discounts.
    """
    __tablename__ = "discount_rules"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    title = Column(String(200), nullable=False)  # e.g., "School Topper Tuition Waiver"
    
    discount_type = Column(Enum(DiscountType), nullable=False)
    value = Column(Numeric(12, 2), nullable=True)  # NULL for FULL_WAIVER
    
    # Which fee template this applies to (NULL = all templates)
    applies_to_fee_template_id = Column(String, ForeignKey("fee_item_templates.id"), nullable=True)
    
    # Scope type for future group rule extension
    scope_type = Column(Enum(DiscountScope), default=DiscountScope.STUDENT_SPECIFIC)
    
    # For STUDENT_SPECIFIC discounts
    student_id = Column(String, ForeignKey("students.id"), nullable=True)
    
    billing_type = Column(Enum(BillingType), nullable=False, default=BillingType.RECURRING)
    recurrence = Column(Enum(RecurrenceType), nullable=True)
    
    start_period = Column(String(7), nullable=True)
    end_period = Column(String(7), nullable=True)
    
    is_active = Column(String(5), default="true")
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    
    __table_args__ = (
        Index("idx_discount_school_student", "school_id", "student_id"),
        Index("idx_discount_school_template", "school_id", "applies_to_fee_template_id"),
        Index("idx_discount_school_active", "school_id", "is_active"),
    )


class StudentInvoice(Base):
    """
    Auto-generated student invoice per billing period.
    Unique constraint prevents duplicate invoices per student per period.
    """
    __tablename__ = "student_invoices"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    
    period = Column(String(7), nullable=False)  # YYYY-MM or YYYY-Q1 format
    status = Column(Enum(StudentInvoiceStatus), default=StudentInvoiceStatus.DRAFT)
    
    # Computed totals (updated when lines change)
    subtotal = Column(Numeric(12, 2), default=0)
    discount_total = Column(Numeric(12, 2), default=0)
    total_due = Column(Numeric(12, 2), default=0)
    paid_total = Column(Numeric(12, 2), default=0)
    balance = Column(Numeric(12, 2), default=0)
    
    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    issued_at = Column(DateTime, nullable=True)
    
    __table_args__ = (
        UniqueConstraint("school_id", "student_id", "period", name="uq_student_invoice_period"),
        Index("idx_student_invoice_school_period", "school_id", "period"),
        Index("idx_student_invoice_school_student", "school_id", "student_id"),
    )


class InvoiceLine(Base):
    """
    Line item for each fee on a student invoice.
    Links back to the fee template for reference.
    """
    __tablename__ = "invoice_lines"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    invoice_id = Column(String, ForeignKey("student_invoices.id"), nullable=False)
    
    fee_template_id = Column(String, ForeignKey("fee_item_templates.id"), nullable=True)
    description = Column(String(500), nullable=False)
    
    base_amount = Column(Numeric(12, 2), nullable=False)
    discount_amount = Column(Numeric(12, 2), default=0)
    final_amount = Column(Numeric(12, 2), nullable=False)
    
    # Store discount rule ID and reason for audit
    line_metadata = Column(JSON, nullable=True)  # {"discount_rule_id": "...", "reason": "..."}
    
    __table_args__ = (
        Index("idx_invoice_line_invoice", "invoice_id"),
        Index("idx_invoice_line_school", "school_id"),
    )

