from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal
from finance.models import DiscountType, DiscountScope, DiscountApplyTo, DiscountEligibilityType

class DiscountRuleBase(BaseModel):
    title: str = Field(..., min_length=1)
    discount_type: DiscountType
    value: Optional[Decimal] = None
    
    apply_to_fee_templates: DiscountApplyTo = DiscountApplyTo.ALL_TEMPLATES
    fee_template_ids: Optional[List[str]] = []
    
    scope_type: DiscountScope = DiscountScope.ALL_STUDENTS
    grade_ids: Optional[List[str]] = []
    student_id: Optional[str] = None # For legacy or specific overrides
    
    eligibility_type: DiscountEligibilityType = DiscountEligibilityType.MANUAL_APPROVAL
    
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    
    is_active: bool = True

class DiscountRuleCreate(DiscountRuleBase):
    pass

class DiscountRuleUpdate(BaseModel):
    title: Optional[str] = None
    discount_type: Optional[DiscountType] = None
    value: Optional[Decimal] = None
    
    apply_to_fee_templates: Optional[DiscountApplyTo] = None
    fee_template_ids: Optional[List[str]] = None
    
    scope_type: Optional[DiscountScope] = None
    grade_ids: Optional[List[str]] = None
    student_id: Optional[str] = None
    
    eligibility_type: Optional[DiscountEligibilityType] = None
    
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    
    is_active: Optional[bool] = None

class DiscountRuleResponse(DiscountRuleBase):
    id: str
    school_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None

    class Config:
        from_attributes = True
