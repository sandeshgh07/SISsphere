from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from finance.models import PaymentPlanStatus, InstallmentStatus

class InstallmentCreate(BaseModel):
    due_date: datetime
    amount: float

class PaymentPlanCreate(BaseModel):
    installments: List[InstallmentCreate]

class InstallmentResponse(BaseModel):
    id: str
    due_date: datetime
    amount: float
    status: InstallmentStatus

    class Config:
        orm_mode = True

class PaymentPlanResponse(BaseModel):
    id: str
    invoice_id: str
    status: PaymentPlanStatus
    created_at: datetime
    installments: List[InstallmentResponse]

    class Config:
        orm_mode = True
