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

# --- NEW SCHEDULE SCHEMAS ---

# Template
class ScheduleTemplateBase(BaseModel):
    name: str
    structure: List[Dict[str, Any]] # [ {label, start, end, type} ]

class ScheduleTemplateCreate(ScheduleTemplateBase):
    pass

class ScheduleTemplateUpdate(BaseModel):
    name: Optional[str] = None
    structure: Optional[List[Dict[str, Any]]] = None

class ScheduleTemplateResponse(ScheduleTemplateBase):
    id: str
    school_id: str
    model_config = ConfigDict(from_attributes=True)

# Weekly Rules
class ScheduleWeeklyRuleBase(BaseModel):
    day_rules: Dict[str, str] # { "Sunday": "template_id" }

class ScheduleWeeklyRuleCreate(ScheduleWeeklyRuleBase):
    pass

class ScheduleWeeklyRuleResponse(ScheduleWeeklyRuleBase):
    id: str
    school_id: str
    model_config = ConfigDict(from_attributes=True)

# Grade Mapping
class ScheduleGradeMappingBase(BaseModel):
    grade_id: str
    inherit_weekly: bool = True
    default_template_id: Optional[str] = None

class ScheduleGradeMappingCreate(ScheduleGradeMappingBase):
    pass

class ScheduleGradeMappingResponse(ScheduleGradeMappingBase):
    id: str
    school_id: str
    model_config = ConfigDict(from_attributes=True)

# Overrides
class ScheduleOverrideBase(BaseModel):
    name: str
    start_date: date
    end_date: date
    target_grade_ids: Optional[List[str]] = None
    rule_config: Dict[str, Any] # { "days": ["Friday"], "template_id": "..." }

class ScheduleOverrideCreate(ScheduleOverrideBase):
    pass

class ScheduleOverrideResponse(ScheduleOverrideBase):
    id: str
    school_id: str
    model_config = ConfigDict(from_attributes=True)

# Section Subject Mapping
class SectionSubjectTimetableBase(BaseModel):
    academic_year_id: str
    grade_id: str
    section_id: str
    day_pattern_key: str
    period_index: int
    period_index: int
    subject_id: Optional[str] = None # Legacy/Base
    grade_subject_id: Optional[str] = None # New Scoped

class SectionSubjectTimetableCreate(SectionSubjectTimetableBase):
    pass # Bulk upsert will likely use a list of these or a specialised structure

class SectionSubjectTimetableResponse(SectionSubjectTimetableBase):
    id: str
    school_id: str
    subject_id: Optional[str] = None # Ensure mapping from model
    grade_subject_id: Optional[str] = None
    subject_name: Optional[str] = None # Convenience for UI
    book_title: Optional[str] = None # New helper
    model_config = ConfigDict(from_attributes=True)

# Class Teacher Assignment
class ClassTeacherAssignmentBase(BaseModel):
    academic_year_id: str
    grade_id: str
    section_id: str
    teacher_user_id: str
    source: str = "AUTO_FROM_P1"

class ClassTeacherAssignmentCreate(ClassTeacherAssignmentBase):
    pass

class ClassTeacherAssignmentResponse(ClassTeacherAssignmentBase):
    id: str
    school_id: str
    derived_from_day_pattern_key: Optional[str] = None
    teacher_name: Optional[str] = None # Convenience
    model_config = ConfigDict(from_attributes=True)

class ClassTeacherOverrideRequest(BaseModel):
    academic_year_id: str
    grade_id: str
    section_id: str
    teacher_user_id: str
    teacher_user_id: str
    
# --- NEW SCHEMAS FOR PHASE 2 ---

# Grade Subject Scoping
class GradeSubjectBase(BaseModel):
    subject_id: str # The base identity
    type: str = "CORE" # CORE, ELECTIVE, OPTIONAL
    is_active: bool = True

class GradeSubjectCreate(GradeSubjectBase):
    pass # academic_year_id and grade_id passed in URL or body? Plan said URL params for GET, likely Body for POST.
    # Actually, simpler to put in body for creation if creating one by one.
    grade_id: str
    academic_year_id: Optional[str] = None # Optional if inferred from context or URL

class GradeSubjectResponse(GradeSubjectBase):
    id: str
    school_id: str
    academic_year_id: str
    grade_id: str
    
    subject_name: Optional[str] = None # Populated join
    subject_code: Optional[str] = None
    
    current_book_title: Optional[str] = None # Populated from active version
    
    model_config = ConfigDict(from_attributes=True)

# Book Versions
class GradeSubjectBookVersionBase(BaseModel):
    title: str
    publisher: Optional[str] = None
    edition: Optional[str] = None
    effective_from: date
    effective_to: Optional[date] = None

class GradeSubjectBookVersionCreate(GradeSubjectBookVersionBase):
    pass

class GradeSubjectBookVersionResponse(GradeSubjectBookVersionBase):
    id: str
    school_id: str
    grade_subject_id: str
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

# Teaching Assignments
class TeachingAssignmentBase(BaseModel):
    teacher_user_id: str
    grade_id: str
    section_id: Optional[str] = None
    grade_subject_id: Optional[str] = None

class TeachingAssignmentCreate(TeachingAssignmentBase):
    academic_year_id: str

class TeachingAssignmentResponse(TeachingAssignmentBase):
    id: str
    school_id: str
    academic_year_id: str
    
    teacher_name: Optional[str] = None
    subject_name: Optional[str] = None
    grade_name: Optional[str] = None
    section_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class SchedulePreviewRequest(BaseModel):
    date: date
    grade_id: Optional[str] = None

class SchedulePreviewResponse(BaseModel):
    date: date
    template_name: str
    periods: List[Dict[str, Any]]
    source: str # "Override" | "GradeMapping" | "WeeklyRule" | "Default"


# Aggregated Overview Schema
class AcademicsOverview(BaseModel):
    active_year: Optional[AcademicYearResponse] = None
    current_term: Optional[TermResponse] = None
    grades_count: int = 0
    sections_count: int = 0
    subjects_count: int = 0
    policy_summary: Optional[str] = None # e.g. "GPA 4.0, Pass 40%"
    alerts: List[Dict[str, Any]] = [] # For now simple list of alerts
