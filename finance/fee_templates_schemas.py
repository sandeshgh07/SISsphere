"""
Pydantic schemas for Fee Templates billing system
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


# Enums for API
class BillingTypeEnum(str, Enum):
    ONE_TIME = "ONE_TIME"
    RECURRING = "RECURRING"


class RecurrenceTypeEnum(str, Enum):
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    YEARLY = "YEARLY"


class DiscountTypeEnum(str, Enum):
    PERCENT = "PERCENT"
    FIXED_AMOUNT = "FIXED_AMOUNT"
    FULL_WAIVER = "FULL_WAIVER"


class DiscountScopeEnum(str, Enum):
    STUDENT_SPECIFIC = "STUDENT_SPECIFIC"
    GROUP_RULE = "GROUP_RULE"


class StudentInvoiceStatusEnum(str, Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PARTIAL = "PARTIAL"
    PAID = "PAID"
    VOID = "VOID"


# ============================================
# Fee Template Schemas
# ============================================

class FeeTemplateCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    amount: float = Field(..., gt=0)
    currency: Optional[str] = Field(default="NPR", max_length=3)
    grade_id: Optional[str] = None  # NULL = all grades
    billing_type: BillingTypeEnum = BillingTypeEnum.RECURRING
    recurrence: Optional[RecurrenceTypeEnum] = None
    start_period: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}$")  # YYYY-MM
    end_period: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}$")
    is_optional_addon: bool = False

    class Config:
        use_enum_values = True


class FeeTemplateUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    amount: Optional[float] = Field(default=None, gt=0)
    currency: Optional[str] = Field(default=None, max_length=3)
    grade_id: Optional[str] = None
    billing_type: Optional[BillingTypeEnum] = None
    recurrence: Optional[RecurrenceTypeEnum] = None
    start_period: Optional[str] = None
    end_period: Optional[str] = None
    is_optional_addon: Optional[bool] = None
    is_active: Optional[bool] = None

    class Config:
        use_enum_values = True


class FeeTemplateResponse(BaseModel):
    id: str
    school_id: str
    title: str
    amount: float
    currency: str
    grade_id: Optional[str]
    billing_type: str
    recurrence: Optional[str]
    start_period: Optional[str]
    end_period: Optional[str]
    is_optional_addon: str  # "true" or "false"
    is_active: str
    created_at: datetime
    created_by: Optional[str]

    class Config:
        from_attributes = True


# ============================================
# Student Addon Enrollment Schemas
# ============================================

class StudentAddonCreate(BaseModel):
    student_id: str
    fee_template_id: str
    start_period: Optional[str] = None
    end_period: Optional[str] = None


class StudentAddonUpdate(BaseModel):
    status: Optional[str] = None  # active/inactive
    end_period: Optional[str] = None


class StudentAddonResponse(BaseModel):
    id: str
    school_id: str
    student_id: str
    fee_template_id: str
    status: str
    start_period: Optional[str]
    end_period: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================
# Discount Rule Schemas
# ============================================

class DiscountRuleCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    discount_type: DiscountTypeEnum
    value: Optional[float] = None  # Required for PERCENT and FIXED_AMOUNT
    applies_to_fee_template_id: Optional[str] = None  # NULL = all templates
    student_id: Optional[str] = None  # For STUDENT_SPECIFIC scope
    billing_type: BillingTypeEnum = BillingTypeEnum.RECURRING
    recurrence: Optional[RecurrenceTypeEnum] = None
    start_period: Optional[str] = None
    end_period: Optional[str] = None

    class Config:
        use_enum_values = True


class DiscountRuleUpdate(BaseModel):
    title: Optional[str] = None
    discount_type: Optional[DiscountTypeEnum] = None
    value: Optional[float] = None
    applies_to_fee_template_id: Optional[str] = None
    billing_type: Optional[BillingTypeEnum] = None
    recurrence: Optional[RecurrenceTypeEnum] = None
    start_period: Optional[str] = None
    end_period: Optional[str] = None
    is_active: Optional[bool] = None

    class Config:
        use_enum_values = True


class DiscountRuleResponse(BaseModel):
    id: str
    school_id: str
    title: str
    discount_type: str
    value: Optional[float]
    applies_to_fee_template_id: Optional[str]
    scope_type: str
    student_id: Optional[str]
    billing_type: str
    recurrence: Optional[str]
    start_period: Optional[str]
    end_period: Optional[str]
    is_active: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================
# Invoice Schemas
# ============================================

class InvoiceLineResponse(BaseModel):
    id: str
    fee_template_id: Optional[str]
    description: str
    base_amount: float
    discount_amount: float
    final_amount: float
    line_metadata: Optional[dict]

    class Config:
        from_attributes = True


class StudentInvoiceResponse(BaseModel):
    id: str
    school_id: str
    student_id: str
    period: str
    status: str
    subtotal: float
    discount_total: float
    total_due: float
    paid_total: float
    balance: float
    generated_at: datetime
    issued_at: Optional[datetime]
    lines: Optional[List[InvoiceLineResponse]] = None

    class Config:
        from_attributes = True


class InvoiceGenerateRequest(BaseModel):
    period: str = Field(..., pattern=r"^\d{4}-\d{2}$")  # YYYY-MM format


class InvoiceSummary(BaseModel):
    """Summary statistics for invoices"""
    total_invoices: int
    total_due: float
    total_paid: float
    total_outstanding: float
    by_status: dict  # {status: count}
