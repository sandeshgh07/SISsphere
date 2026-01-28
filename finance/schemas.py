from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from finance.models import InvoiceStatus

class InvoiceCreate(BaseModel):
    student_id: str
    amount_due: float # Keep for backward compatibility in request, map to total_amount
    currency: str = "USD"

class InvoiceResponse(BaseModel):
    id: str
    school_id: str
    student_id: str
    total_amount: float
    amount_paid: float
    currency: str
    status: str
    created_at: datetime
    updated_at: datetime

class PaymentInitiateRequest(BaseModel):
    invoice_id: str
    amount: Optional[float] = None # Optional, defaults to remaining balance

class PaymentInitiateResponse(BaseModel):
    payment_intent_id: str
    client_secret: str
    gateway_session_id: str
    amount: float
    currency: str

class PaymentStatusResponse(BaseModel):
    invoice_id: str
    status: str
    total_amount: float
    amount_paid: float
    remaining_amount: float

class PaymentResponse(BaseModel):
    id: str
    school_id: str
    amount: float
    currency: str
    status: str
    entry_source: str
    # notes: Optional[str] = None # notes is nullable in model
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
