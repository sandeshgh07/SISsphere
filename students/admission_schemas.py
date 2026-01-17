from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from students.models import AdmissionStatus

class AdmissionCreate(BaseModel):
    first_name: str
    last_name: str
    parent_phone: str
    email: Optional[EmailStr] = None
    documents: Optional[List[str]] = None

class AdmissionResponse(BaseModel):
    id: str
    school_id: str
    first_name: str
    last_name: str
    email: Optional[str]
    parent_phone: str
    status: AdmissionStatus
    submission_date: datetime

    class Config:
        orm_mode = True

class AdmissionApprove(BaseModel):
    grade_id: str
    section_id: str
    registration_fee_amount: float
    academic_year_id: Optional[str] = None
