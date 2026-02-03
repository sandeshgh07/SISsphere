from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class LedgerLineSc(BaseModel):
    description: str
    qty: float = 1.0
    unit_price: float
    amount: float
    discount_amount: float
    kind: str # FEE | DISCOUNT

class FeeTemplateSc(BaseModel):
    id: str
    name: str
    amount: float
    type: str # RECURRING | ONE_TIME

class MatchedDiscountSc(BaseModel):
    id: str
    rule_name: str
    type: str
    value: float
    computed_amount: float

class StudentSummarySc(BaseModel):
    id: str
    name: str
    grade: Optional[str] = None
    guardian_name: Optional[str] = None

class LedgerTotalsSc(BaseModel):
    base_total: float
    discount_total: float
    net_total: float
    paid_total: float
    balance: float

class LedgerResponse(BaseModel):
    student: StudentSummarySc
    period: str
    invoice_id: Optional[str] = None
    invoice_status: Optional[str] = None
    applicable_fee_templates: List[FeeTemplateSc]
    matched_discounts: List[MatchedDiscountSc]
    breakdown_lines: List[LedgerLineSc]
    totals: LedgerTotalsSc
    assigned_discount_ids: List[str] = []

class ApplyDiscountRequest(BaseModel):
    student_id: str
    period: str
    rule_ids: List[str]
