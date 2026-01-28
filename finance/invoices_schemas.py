from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime
from finance.models import StudentInvoiceStatus, BillingType, RecurrenceType, DiscountType

class BillingEntitySc(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None

class BillToSc(BaseModel):
    name: str = "Parent/Guardian"
    relationship: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class InvoiceLineItemSc(BaseModel):
    id: str
    description: str
    qty: float = 1.0 # Default to 1
    unit_price: float # will equal base_amount if qty=1
    base_amount: float
    discount_amount: float
    final_amount: float
    fee_template_id: Optional[str] = None
    category: Optional[str] = None
    line_metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class InvoicePaymentSc(BaseModel):
    id: str
    amount: float
    entry_source: str
    status: str
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None
    reference: Optional[str] = None
    recorded_by: Optional[str] = None

    class Config:
        from_attributes = True

class StudentInvoiceSc(BaseModel):
    id: str
    student_id: str
    student_name: Optional[str] = None # Enriched
    grade_name: Optional[str] = None # Enriched
    
    # New Enriched Fields for Invoice UI
    billing_entity: Optional[BillingEntitySc] = None
    bill_to: Optional[BillToSc] = None
    
    period: str
    status: StudentInvoiceStatus
    
    subtotal: float
    discount_total: float
    total_due: float
    paid_total: float
    balance: float
    
    generated_at: datetime
    issued_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    
    voided_at: Optional[datetime] = None
    void_reason: Optional[str] = None
    
    lines: List[InvoiceLineItemSc] = []
    payments: List[InvoicePaymentSc] = [] # Depending on how we query
    
    currency: str = "NPR" # Explicit currency

    class Config:
        from_attributes = True

class StudentInvoiceListSc(BaseModel):
    """Lighter version for list view"""
    id: str
    student_id: str
    student_name: Optional[str] = None
    grade_name: Optional[str] = None
    period: str
    status: StudentInvoiceStatus
    total_due: float
    paid_total: float
    balance: float
    due_date: Optional[datetime] = None
    issued_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class GeneratorPreviewRequest(BaseModel):
    period: str
    grade_id: Optional[str] = None # "all" or specific UUID
    template_ids: Optional[List[str]] = None
    conflict_rule: str = "SKIP" # SKIP, UPDATE_DRAFT, REGENERATE

class GeneratorSampleSc(BaseModel):
    student_name: str
    action: str
    amount: float

class GeneratorResultSc(BaseModel):
    created: int
    updated: int
    skipped: int
    errors: List[str]
    samples: List[GeneratorSampleSc]
    preview: bool
    total_impact_value: float

class InvoiceVoidRequest(BaseModel):
    reason: str

class InvoicePaymentRequest(BaseModel):
    amount: float
    method: str = "CASH" # CASH, BANK_TRANSFER, CHEQUE, ONLINE
    reference: Optional[str] = None
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None
