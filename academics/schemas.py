from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Any, Dict
from datetime import date
from uuid import UUID

class AcademicYearBase(BaseModel):
    name: str
    start_date: date
    end_date: date
    is_active: bool = True
    is_closed: bool = False

class AcademicYearCreate(AcademicYearBase):
    pass

class AcademicYearUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    is_closed: Optional[bool] = None

class AcademicYearResponse(AcademicYearBase):
    id: str
    school_id: str
    model_config = ConfigDict(from_attributes=True)

class TermBase(BaseModel):
    name: str
    start_date: date
    end_date: date
    weightage: float = 0.0
    is_locked: bool = False

class TermCreate(TermBase):
    academic_year_id: str # UUID string

class TermUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    weightage: Optional[float] = None
    is_locked: Optional[bool] = None

class TermResponse(TermBase):
    id: str
    school_id: str
    academic_year_id: str
    model_config = ConfigDict(from_attributes=True)

class SubjectBase(BaseModel):
    name: str
    code: Optional[str] = None
    is_elective: bool = False
    grade_id: Optional[str] = None
    assigned_teacher_id: Optional[str] = None

class SubjectCreate(SubjectBase):
    pass

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    is_elective: Optional[bool] = None
    grade_id: Optional[str] = None
    assigned_teacher_id: Optional[str] = None

class SubjectResponse(SubjectBase):
    id: str
    school_id: str
    model_config = ConfigDict(from_attributes=True)

class GradingPolicyBase(BaseModel):
    gpa_scale: str = "4.0"
    grading_structure: Optional[List[Dict[str, Any]]] = None
    pass_mark: float = 40.0
    full_mark: float = 100.0
    weight_rules: Optional[Dict[str, Any]] = None
    is_locked: bool = False

class GradingPolicyCreate(GradingPolicyBase):
    academic_year_id: str

class GradingPolicyResponse(GradingPolicyBase):
    id: str
    school_id: str
    academic_year_id: str
    model_config = ConfigDict(from_attributes=True)

class PromotionRuleBase(BaseModel):
    rules: Dict[str, Any]

class PromotionRuleCreate(PromotionRuleBase):
    academic_year_id: str

class PromotionRuleResponse(PromotionRuleBase):
    id: str
    school_id: str
    academic_year_id: str
    model_config = ConfigDict(from_attributes=True)

class PeriodStructureBase(BaseModel):
    structure: Dict[str, Any]

class PeriodStructureCreate(PeriodStructureBase):
    academic_year_id: Optional[str] = None

class PeriodStructureResponse(PeriodStructureBase):
    id: str
    school_id: str
    academic_year_id: Optional[str]
    model_config = ConfigDict(from_attributes=True)

# Aggregated Overview Schema
class AcademicsOverview(BaseModel):
    active_year: Optional[AcademicYearResponse] = None
    current_term: Optional[TermResponse] = None
    grades_count: int = 0
    sections_count: int = 0
    subjects_count: int = 0
    policy_summary: Optional[str] = None # e.g. "GPA 4.0, Pass 40%"
    alerts: List[Dict[str, Any]] = [] # For now simple list of alerts
