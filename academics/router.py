from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from database import SessionLocal
from auth.dependencies import get_db, get_current_user, require_roles, TenantAccess, Roles
from students import models as student_models
from academics import models as academic_models
from academics import schemas as academic_schemas
from schools import models as school_models
from pydantic import BaseModel
import uuid
from audit.models import AuditLog
from audit.listeners import set_reason
import json
from datetime import datetime, timezone, date
from auth.subscription import require_subscription_feature

router = APIRouter(prefix="/academics", tags=["academics"])

# --- NEW ACADEMIC SETUP HUB ENDPOINTS ---

@router.get("/overview", response_model=academic_schemas.AcademicsOverview)
def get_academics_overview(
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    school_id = str(tenant.school_id)
    
    # Active Year
    active_year = db.query(academic_models.AcademicYear).filter(
        academic_models.AcademicYear.school_id == school_id,
        academic_models.AcademicYear.is_active == True
    ).first()
    
    # Current Term
    current_term = None
    if active_year:
        today = date.today()
        current_term = db.query(academic_models.Term).filter(
            academic_models.Term.school_id == school_id,
            academic_models.Term.academic_year_id == active_year.id,
            academic_models.Term.start_date <= today,
            academic_models.Term.end_date >= today
        ).first()
        
    # Counts
    grades_count = db.query(academic_models.Grade).filter(academic_models.Grade.school_id == school_id).count()
    sections_count = db.query(academic_models.Section).filter(academic_models.Section.school_id == school_id).count()
    subjects_count = db.query(academic_models.Subject).filter(academic_models.Subject.school_id == school_id).count()
    
    # Policy Summary
    policy_summary = "Not Configured"
    if active_year:
        policy = db.query(academic_models.GradingPolicy).filter(
            academic_models.GradingPolicy.school_id == school_id,
            academic_models.GradingPolicy.academic_year_id == active_year.id
        ).first()
        if policy:
             policy_summary = f"GPA Scale: {policy.gpa_scale}, Pass: {policy.pass_mark}%"
    
    # Alerts (Mock logic for v1, or basic queries)
    alerts = []
    # Example: Check for missing grades in published terms?
    # Keeping it simple for now
    
    return {
        "active_year": active_year,
        "current_term": current_term,
        "grades_count": grades_count,
        "sections_count": sections_count,
        "subjects_count": subjects_count,
        "policy_summary": policy_summary,
        "alerts": alerts
    }

# Academic Years
@router.post("/academic-years", response_model=academic_schemas.AcademicYearResponse)
def create_academic_year(
    ay: academic_schemas.AcademicYearCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER))
):
    # Check if active is being set, unset others
    if ay.is_active:
        db.query(academic_models.AcademicYear).filter(
            academic_models.AcademicYear.school_id == str(tenant.school_id)
        ).update({"is_active": False})
    
    new_ay = academic_models.AcademicYear(
        name=ay.name,
        start_date=ay.start_date,
        end_date=ay.end_date,
        is_active=ay.is_active,
        is_closed=ay.is_closed,
        school_id=str(tenant.school_id)
    )
    db.add(new_ay)
    db.commit()
    db.refresh(new_ay)
    return new_ay

@router.get("/academic-years", response_model=List[academic_schemas.AcademicYearResponse])
def list_academic_years(
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    return db.query(academic_models.AcademicYear).filter(
        academic_models.AcademicYear.school_id == str(tenant.school_id)
    ).order_by(academic_models.AcademicYear.start_date.desc()).all()

@router.patch("/academic-years/{ay_id}/set-active")
def set_active_year(
    ay_id: str,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    # Deactivate all
    db.query(academic_models.AcademicYear).filter(
        academic_models.AcademicYear.school_id == str(tenant.school_id)
    ).update({"is_active": False})
    
    # Activate target
    ay = db.query(academic_models.AcademicYear).filter(
        academic_models.AcademicYear.id == ay_id,
        academic_models.AcademicYear.school_id == str(tenant.school_id)
    ).first()
    if not ay:
        raise HTTPException(status_code=404, detail="Academic Year not found")
        
    ay.is_active = True
    db.commit()
    return {"message": "Active academic year updated"}

# Terms
@router.post("/terms", response_model=academic_schemas.TermResponse)
def create_term(
    term: academic_schemas.TermCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER))
):
    # Verify AY exists
    ay = db.query(academic_models.AcademicYear).filter(
        academic_models.AcademicYear.id == term.academic_year_id,
        academic_models.AcademicYear.school_id == str(tenant.school_id)
    ).first()
    if not ay:
        raise HTTPException(status_code=404, detail="Academic Year not found")

    new_term = academic_models.Term(
        name=term.name,
        academic_year_id=term.academic_year_id,
        start_date=term.start_date,
        end_date=term.end_date,
        weightage=term.weightage,
        school_id=str(tenant.school_id)
    )
    db.add(new_term)
    db.commit()
    db.refresh(new_term)
    return new_term

@router.get("/terms", response_model=List[academic_schemas.TermResponse])
def list_terms(
    academic_year_id: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    query = db.query(academic_models.Term).filter(academic_models.Term.school_id == str(tenant.school_id))
    if academic_year_id:
        query = query.filter(academic_models.Term.academic_year_id == academic_year_id)
    
    return query.order_by(academic_models.Term.start_date).all()

# Grading Policy
@router.post("/grading-policies", response_model=academic_schemas.GradingPolicyResponse)
def create_grading_policy(
    policy: academic_schemas.GradingPolicyCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    # Check if policy exists for this year
    existing = db.query(academic_models.GradingPolicy).filter(
        academic_models.GradingPolicy.academic_year_id == policy.academic_year_id,
        academic_models.GradingPolicy.school_id == str(tenant.school_id)
    ).first()
    if existing:
        # Update existing?
        existing.gpa_scale = policy.gpa_scale
        existing.grading_structure = policy.grading_structure
        existing.pass_mark = policy.pass_mark
        existing.full_mark = policy.full_mark
        existing.weight_rules = policy.weight_rules
        db.commit()
        db.refresh(existing)
        return existing
        
    new_policy = academic_models.GradingPolicy(
        academic_year_id=policy.academic_year_id,
        gpa_scale=policy.gpa_scale,
        grading_structure=policy.grading_structure,
        pass_mark=policy.pass_mark,
        full_mark=policy.full_mark,
        weight_rules=policy.weight_rules,
        school_id=str(tenant.school_id)
    )
    db.add(new_policy)
    db.commit()
    db.refresh(new_policy)
    return new_policy

@router.get("/grading-policies", response_model=List[academic_schemas.GradingPolicyResponse])
def list_grading_policies(
    academic_year_id: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    query = db.query(academic_models.GradingPolicy).filter(
        academic_models.GradingPolicy.school_id == str(tenant.school_id)
    )
    if academic_year_id:
        query = query.filter(academic_models.GradingPolicy.academic_year_id == academic_year_id)
    return query.all()



# Promotion Rules
@router.post("/promotion-rules", response_model=academic_schemas.PromotionRuleResponse)
def create_promotion_rules(
    rules: academic_schemas.PromotionRuleCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    # Check existing
    existing = db.query(academic_models.PromotionRule).filter(
        academic_models.PromotionRule.academic_year_id == rules.academic_year_id,
        academic_models.PromotionRule.school_id == str(tenant.school_id)
    ).first()

    if existing:
        existing.rules = rules.rules
        db.commit()
        db.refresh(existing)
        return existing
    
    new_rules = academic_models.PromotionRule(
        academic_year_id=rules.academic_year_id,
        rules=rules.rules,
        school_id=str(tenant.school_id)
    )
    db.add(new_rules)
    db.commit()
    db.refresh(new_rules)
    return new_rules

@router.get("/promotion-rules", response_model=List[academic_schemas.PromotionRuleResponse])
def list_promotion_rules(
    academic_year_id: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    query = db.query(academic_models.PromotionRule).filter(
        academic_models.PromotionRule.school_id == str(tenant.school_id)
    )
    if academic_year_id:
        query = query.filter(academic_models.PromotionRule.academic_year_id == academic_year_id)
    return query.all()

@router.post("/promotions/execute")
def execute_promotion(
    academic_year_id: str,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    # Logic to promote students based on rules
    # This is complex, will implement placeholder for now as per plan
    return {"message": "Promotion execution started (Logic pending implementation)"}

# Period Structures
@router.post("/period-structures", response_model=academic_schemas.PeriodStructureResponse)
def create_period_structure(
    structure: academic_schemas.PeriodStructureCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    # Logic to handle defaults vs specific year
    new_struct = academic_models.PeriodStructure(
        academic_year_id=structure.academic_year_id,
        structure=structure.structure,
        school_id=str(tenant.school_id)
    )
    db.add(new_struct)
    db.commit()
    db.refresh(new_struct)
    return new_struct

@router.get("/period-structures", response_model=List[academic_schemas.PeriodStructureResponse])
def list_period_structures(
    academic_year_id: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    query = db.query(academic_models.PeriodStructure).filter(
        academic_models.PeriodStructure.school_id == str(tenant.school_id)
    )
    if academic_year_id:
        query = query.filter(academic_models.PeriodStructure.academic_year_id == academic_year_id)
    return query.all()


# Update Subjects create/list to use new Schema
@router.post("/subjects", response_model=academic_schemas.SubjectResponse)
def create_subject(
    subject: academic_schemas.SubjectCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER))
):
    new_subject = academic_models.Subject(
        name=subject.name,
        code=subject.code,
        is_elective=subject.is_elective,
        grade_id=subject.grade_id,
        assigned_teacher_id=subject.assigned_teacher_id,
        school_id=str(tenant.school_id)
    )
    db.add(new_subject)
    db.commit()
    db.refresh(new_subject)
    return new_subject

@router.get("/subjects", response_model=List[academic_schemas.SubjectResponse])
def list_subjects(
    grade_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    query = db.query(academic_models.Subject).filter(academic_models.Subject.school_id == str(tenant.school_id))
    if grade_id:
        query = query.filter(academic_models.Subject.grade_id == grade_id)
    return query.all()


# --- EXISTING ENDPOINTS (UPDATED IMPORTS) ---
# Keeping them below to maintain functionality

class SectionCreate(BaseModel):
    name: str

class SectionResponse(BaseModel):
    id: str
    name: str
    school_id: str
    class Config:
        from_attributes = True

class GradeCreate(BaseModel):
    name: str
    sequence: int

class GradeResponse(BaseModel):
    id: str
    name: str
    sequence: int
    school_id: str
    class Config:
        from_attributes = True

class GradeSectionLink(BaseModel):
    grade_id: str
    section_id: str

class TeacherAssignmentCreate(BaseModel):
    teacher_id: str
    grade_id: Optional[str] = None
    section_id: Optional[str] = None
    subject_id: Optional[str] = None

class ExamTermCreate(BaseModel):
    name: str

class ExamTermResponse(BaseModel):
    id: str
    name: str
    is_active: bool
    school_id: str
    class Config:
        orm_mode = True

class MarksEntryCreate(BaseModel):
    student_id: str
    subject_id: str
    exam_term_id: str
    marks_obtained: int
    total_marks: int
    reason: Optional[str] = None

class MarksEntryResponse(BaseModel):
    id: str
    student_id: str
    subject_id: str
    exam_term_id: str
    marks_obtained: int
    total_marks: int
    is_published: bool
    school_id: str

    class Config:
        orm_mode = True

class MarksOverride(BaseModel):
    marks_obtained: int
    reason: str

class PerformanceTrend(BaseModel):
    exam_term_name: str
    average_score: float

class LessonPlanCreate(BaseModel):
    subject_id: str
    content: Dict[str, Any]
    date: date

class LessonPlanResponse(BaseModel):
    id: str
    teacher_id: str
    subject_id: str
    content: Dict[str, Any]
    date: date
    status: academic_models.LessonPlanStatus
    school_id: str
    class Config:
        orm_mode = True

class SyllabusCoverage(BaseModel):
    subject_name: str
    teacher_name: str
    planned_lessons: int
    completed_lessons: int
    completed_lessons: int
    coverage_percent: float

# Flexible Grading Schemas
class AssessmentTypeCreate(BaseModel):
    name: str

class AssessmentTypeResponse(BaseModel):
    id: str
    name: str
    school_id: str
    class Config:
        orm_mode = True

class AssessmentCreate(BaseModel):
    name: str
    subject_id: str
    exam_term_id: str
    max_marks: int
    assessment_type_id: Optional[str] = None

class AssessmentResponse(BaseModel):
    id: str
    name: str
    subject_id: str
    exam_term_id: str
    max_marks: int
    assessment_type_id: Optional[str] = None
    school_id: str
    class Config:
        orm_mode = True

class ScoreEntry(BaseModel):
    student_id: str
    score: float

class BulkScoreInput(BaseModel):
    assessment_id: str
    scores: List[ScoreEntry]

# Endpoints for Lesson Plans

@router.post("/lesson-plans", response_model=LessonPlanResponse)
def create_lesson_plan(
    plan: LessonPlanCreate,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("LESSON_PLANNER"))
):
    # If teacher, enforce teacher_id = user.id
    teacher_id = user.id
    if user.role != Roles.TEACHER:
        pass

    new_plan = academic_models.LessonPlan(
        school_id=str(tenant.school_id),
        teacher_id=teacher_id,
        subject_id=plan.subject_id,
        content=plan.content,
        date=plan.date,
        status=academic_models.LessonPlanStatus.PLANNED
    )
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)
    return new_plan

@router.get("/lesson-plans", response_model=List[LessonPlanResponse])
def list_lesson_plans(
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("LESSON_PLANNER"))
):
    query = db.query(academic_models.LessonPlan).filter(
        academic_models.LessonPlan.school_id == str(tenant.school_id)
    )
    if user.role == Roles.TEACHER:
        query = query.filter(academic_models.LessonPlan.teacher_id == user.id)

    return query.order_by(academic_models.LessonPlan.date.desc()).all()

@router.patch("/lesson-plans/{plan_id}/complete", response_model=LessonPlanResponse)
def complete_lesson_plan(
    plan_id: str,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.TEACHER)),
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("LESSON_PLANNER"))
):
    plan = db.query(academic_models.LessonPlan).filter(
        academic_models.LessonPlan.id == plan_id,
        academic_models.LessonPlan.school_id == str(tenant.school_id),
        academic_models.LessonPlan.teacher_id == user.id
    ).first()

    if not plan:
        raise HTTPException(status_code=404, detail="Lesson Plan not found")

    plan.status = academic_models.LessonPlanStatus.COMPLETED
    db.commit()
    db.refresh(plan)
    return plan

@router.get("/reports/syllabus-coverage", response_model=List[SyllabusCoverage])
def get_syllabus_coverage(
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("LESSON_PLANNER"))
):
    from sqlalchemy import func, case

    results = db.query(
        academic_models.LessonPlan.teacher_id,
        academic_models.LessonPlan.subject_id,
        func.count(academic_models.LessonPlan.id).label('total'),
        func.sum(case((academic_models.LessonPlan.status == academic_models.LessonPlanStatus.COMPLETED, 1), else_=0)).label('completed')
    ).filter(
        academic_models.LessonPlan.school_id == str(tenant.school_id)
    ).group_by(academic_models.LessonPlan.teacher_id, academic_models.LessonPlan.subject_id).all()

    report = []
    for r in results:
        teacher = db.query(school_models.User).get(r.teacher_id)
        subject = db.query(academic_models.Subject).get(r.subject_id)

        planned = r.total
        completed = r.completed or 0
        coverage = (completed / planned * 100) if planned > 0 else 0

        report.append(SyllabusCoverage(
            subject_name=subject.name if subject else "Unknown",
            teacher_name=f"{teacher.first_name} {teacher.last_name}" if teacher else "Unknown",
            planned_lessons=planned,
            completed_lessons=completed,
            coverage_percent=round(coverage, 2)
        ))

    return report

@router.post("/sections", response_model=SectionResponse)
def create_section(
    section: SectionCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    existing = db.query(academic_models.Section).filter(
        academic_models.Section.school_id == str(tenant.school_id),
        academic_models.Section.name == section.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Section already exists")

    new_section = academic_models.Section(
        name=section.name,
        school_id=str(tenant.school_id)
    )
    db.add(new_section)
    db.commit()
    db.refresh(new_section)
    return new_section

@router.get("/sections", response_model=List[SectionResponse])
def list_sections(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    return db.query(academic_models.Section).filter(academic_models.Section.school_id == str(tenant.school_id)).all()

@router.post("/grades", response_model=GradeResponse)
def create_grade(
    grade: GradeCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    try:
        new_grade = academic_models.Grade(
            name=grade.name,
            sequence=grade.sequence,
            school_id=str(tenant.school_id)
        )
        db.add(new_grade)
        db.commit()
        db.refresh(new_grade)
        return new_grade
    except Exception as e:
        if "unique constraint" in str(e).lower():
             raise HTTPException(status_code=400, detail="Grade with this name or data already exists info.")
        raise HTTPException(status_code=500, detail=f"Backend Error: {str(e)}")

@router.get("/grades", response_model=List[GradeResponse])
def list_grades(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER, Roles.PARENT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    return db.query(academic_models.Grade).filter(academic_models.Grade.school_id == str(tenant.school_id)).order_by(academic_models.Grade.sequence).all()

class StructureItem(BaseModel):
    grade: GradeResponse
    sections: List[SectionResponse]

@router.get("/structure", response_model=List[StructureItem])
def get_academic_structure(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER, Roles.PARENT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    grades = db.query(academic_models.Grade).filter(academic_models.Grade.school_id == str(tenant.school_id)).order_by(academic_models.Grade.sequence).all()
    sections = db.query(academic_models.Section).filter(academic_models.Section.school_id == str(tenant.school_id)).all()
    links = db.query(academic_models.GradeSection).filter(academic_models.GradeSection.school_id == str(tenant.school_id)).all()

    section_map = {s.id: s for s in sections}
    grade_section_map = {}
    for link in links:
        if link.grade_id not in grade_section_map:
            grade_section_map[link.grade_id] = []
        grade_section_map[link.grade_id].append(link.section_id)

    structure = []
    for grade in grades:
        grade_sections = []
        if grade.id in grade_section_map:
            for sid in grade_section_map[grade.id]:
                if sid in section_map:
                    grade_sections.append(section_map[sid])
        
        structure.append({
            "grade": grade,
            "sections": grade_sections
        })

    return structure

@router.post("/grades/{grade_id}/sections")
def link_grade_section(
    grade_id: str,
    link_data: GradeSectionLink,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    grade = db.query(academic_models.Grade).filter(academic_models.Grade.id == grade_id, academic_models.Grade.school_id == str(tenant.school_id)).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Grade not found")

    section = db.query(academic_models.Section).filter(academic_models.Section.id == link_data.section_id, academic_models.Section.school_id == str(tenant.school_id)).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    existing = db.query(academic_models.GradeSection).filter(
        academic_models.GradeSection.grade_id == grade_id,
        academic_models.GradeSection.section_id == link_data.section_id,
        academic_models.GradeSection.school_id == str(tenant.school_id)
    ).first()

    if existing:
        return {"message": "Link already exists"}

    new_link = academic_models.GradeSection(
        grade_id=grade_id,
        section_id=link_data.section_id,
        school_id=str(tenant.school_id)
    )
    db.add(new_link)
    db.commit()
    return {"message": "Grade linked to Section successfully"}

@router.post("/assignments")
def assign_teacher(
    assignment: TeacherAssignmentCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    teacher = db.query(school_models.User).filter(
        school_models.User.id == assignment.teacher_id,
        school_models.User.school_id == str(tenant.school_id),
        school_models.User.role == Roles.TEACHER
    ).first()

    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    if assignment.grade_id:
        if not db.query(academic_models.Grade).filter(academic_models.Grade.id == assignment.grade_id, academic_models.Grade.school_id == str(tenant.school_id)).first():
            raise HTTPException(status_code=404, detail="Grade not found")

    if assignment.section_id:
        if not db.query(academic_models.Section).filter(academic_models.Section.id == assignment.section_id, academic_models.Section.school_id == str(tenant.school_id)).first():
            raise HTTPException(status_code=404, detail="Section not found")

    if assignment.subject_id:
         if not db.query(academic_models.Subject).filter(academic_models.Subject.id == assignment.subject_id, academic_models.Subject.school_id == str(tenant.school_id)).first():
            raise HTTPException(status_code=404, detail="Subject not found")

    new_assignment = academic_models.TeacherAssignment(
        teacher_id=assignment.teacher_id,
        grade_id=assignment.grade_id,
        section_id=assignment.section_id,
        subject_id=assignment.subject_id,
        school_id=str(tenant.school_id)
    )
    db.add(new_assignment)
    db.commit()
    return {"message": "Teacher assigned successfully"}

@router.post("/promote")
def promote_students(
    target_academic_year_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    target_ay = db.query(academic_models.AcademicYear).filter(
        academic_models.AcademicYear.id == target_academic_year_id,
        academic_models.AcademicYear.school_id == str(tenant.school_id)
    ).first()
    if not target_ay:
        raise HTTPException(status_code=404, detail="Target Academic Year not found")

    students = db.query(student_models.Student).filter(
        student_models.Student.school_id == str(tenant.school_id),
        student_models.Student.is_active == True
    ).all()

    promoted_count = 0
    retained_count = 0
    graduated_count = 0

    grades = db.query(academic_models.Grade).filter(academic_models.Grade.school_id == str(tenant.school_id)).all()
    grade_map = {g.id: g for g in grades}
    
    for student in students:
        if student.retention_flag:
            student.academic_year_id = target_academic_year_id
            student.retention_flag = False
            retained_count += 1
        else:
            if not student.grade_id:
                continue 

            current_grade = grade_map.get(student.grade_id)
            if not current_grade:
                continue

            possible_next_grades = [g for g in grades if g.sequence > current_grade.sequence]
            possible_next_grades.sort(key=lambda x: x.sequence)

            if not possible_next_grades:
                graduated_count += 1
                student.is_active = False
                student.grade_id = None
                student.section_id = None
            else:
                next_grade = possible_next_grades[0]
                student.grade_id = next_grade.id
                student.academic_year_id = target_academic_year_id

                link = db.query(academic_models.GradeSection).filter(
                    academic_models.GradeSection.grade_id == next_grade.id,
                    academic_models.GradeSection.section_id == student.section_id
                ).first()
                if not link:
                    student.section_id = None 

                promoted_count += 1

    db.commit()
    return {
        "message": "Promotion cycle completed",
        "promoted": promoted_count,
        "retained": retained_count,
        "graduated_or_max_grade": graduated_count
    }

@router.post("/students/{student_id}/retain")
def retain_student(
    student_id: str,
    reason: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    student = db.query(student_models.Student).filter(
        student_models.Student.id == student_id,
        student_models.Student.school_id == str(tenant.school_id)
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student.retention_flag = True

    audit_entry = AuditLog(
        actor_id=user.id,
        action_type="MANUAL_RETENTION",
        table_name="students",
        record_id=student.id,
        school_id=student.school_id, # Added school_id
        after_state=json.dumps({"retention_flag": True, "reason": reason}),
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit_entry)

    db.commit()
    return {"message": "Student flagged for retention"}

# Exam Management Endpoints

@router.post("/exams/terms", response_model=ExamTermResponse)
def create_exam_term(
    term: ExamTermCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    new_term = academic_models.ExamTerm(
        name=term.name,
        school_id=str(tenant.school_id)
    )
    db.add(new_term)
    db.commit()
    db.refresh(new_term)
    return new_term

@router.get("/exams/terms", response_model=List[ExamTermResponse])
def list_exam_terms(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    return db.query(academic_models.ExamTerm).filter(academic_models.ExamTerm.school_id == str(tenant.school_id)).all()

@router.post("/exams/marks", response_model=MarksEntryResponse)
def enter_marks(
    marks_data: MarksEntryCreate,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    student = db.query(student_models.Student).filter(student_models.Student.id == marks_data.student_id, student_models.Student.school_id == str(tenant.school_id)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    exam_term = db.query(academic_models.ExamTerm).filter(
        academic_models.ExamTerm.id == marks_data.exam_term_id,
        academic_models.ExamTerm.school_id == str(tenant.school_id)
    ).first()
    if not exam_term:
        raise HTTPException(status_code=404, detail="Exam Term not found")

    if user.role == Roles.TEACHER:
        if not student.grade_id:
             raise HTTPException(status_code=400, detail="Student not assigned to a grade")

        assignment = db.query(academic_models.TeacherAssignment).filter(
            academic_models.TeacherAssignment.teacher_id == user.id,
            academic_models.TeacherAssignment.subject_id == marks_data.subject_id,
            academic_models.TeacherAssignment.school_id == str(tenant.school_id)
        ).all()

        valid_assignment = False
        for asn in assignment:
            if asn.grade_id == student.grade_id:
                if asn.section_id is None or asn.section_id == student.section_id:
                    valid_assignment = True
                    break

        if not valid_assignment:
             raise HTTPException(status_code=403, detail="Teacher not assigned to this student's grade/subject")

    existing_marks = db.query(academic_models.MarksEntry).filter(
        academic_models.MarksEntry.student_id == marks_data.student_id,
        academic_models.MarksEntry.subject_id == marks_data.subject_id,
        academic_models.MarksEntry.exam_term_id == marks_data.exam_term_id,
        academic_models.MarksEntry.school_id == str(tenant.school_id)
    ).first()

    if existing_marks:
        if existing_marks.is_published:
            raise HTTPException(status_code=403, detail="Marks are locked (Published). Contact Admin for override.")

        reason_text = marks_data.reason or "No justification provided"
        set_reason(reason_text)

        existing_marks.marks_obtained = marks_data.marks_obtained
        existing_marks.total_marks = marks_data.total_marks
        db.commit()
        db.refresh(existing_marks)
        return existing_marks
    else:
        new_marks = academic_models.MarksEntry(
            student_id=marks_data.student_id,
            subject_id=marks_data.subject_id,
            exam_term_id=marks_data.exam_term_id,
            marks_obtained=marks_data.marks_obtained,
            total_marks=marks_data.total_marks,
            school_id=str(tenant.school_id)
        )
        db.add(new_marks)
        db.commit()
        db.refresh(new_marks)
        return new_marks

@router.post("/exams/marks/{marks_id}/publish")
def publish_marks(
    marks_id: str,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    marks = db.query(academic_models.MarksEntry).filter(
        academic_models.MarksEntry.id == marks_id,
        academic_models.MarksEntry.school_id == str(tenant.school_id)
    ).first()

    if not marks:
        raise HTTPException(status_code=404, detail="Marks entry not found")

    if user.role == Roles.TEACHER:
        student = db.query(student_models.Student).filter(student_models.Student.id == marks.student_id).first()
        if not student or not student.grade_id:
             raise HTTPException(status_code=400, detail="Student invalid or unassigned")

        assignment = db.query(academic_models.TeacherAssignment).filter(
            academic_models.TeacherAssignment.teacher_id == user.id,
            academic_models.TeacherAssignment.subject_id == marks.subject_id,
            academic_models.TeacherAssignment.school_id == str(tenant.school_id)
        ).all()

        valid_assignment = False
        for asn in assignment:
            if asn.grade_id == student.grade_id:
                if asn.section_id is None or asn.section_id == student.section_id:
                    valid_assignment = True
                    break

        if not valid_assignment:
             raise HTTPException(status_code=403, detail="Not authorized to publish marks for this student/subject")

    marks.is_published = True
    db.commit()
    return {"message": "Marks published and locked"}

@router.put("/exams/marks/{marks_id}/override", response_model=MarksEntryResponse)
def override_marks(
    marks_id: str,
    override_data: MarksOverride,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    marks = db.query(academic_models.MarksEntry).filter(
        academic_models.MarksEntry.id == marks_id,
        academic_models.MarksEntry.school_id == str(tenant.school_id)
    ).first()

    if not marks:
        raise HTTPException(status_code=404, detail="Marks entry not found")

    set_reason(override_data.reason)

    marks.marks_obtained = override_data.marks_obtained
    db.commit()
    db.refresh(marks)
    return marks

@router.get("/exams/results", response_model=List[MarksEntryResponse])
def get_exam_results(
    student_id: Optional[str] = None,
    exam_term_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.STUDENT, Roles.PARENT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    target_student_id = None
    if user.role == Roles.STUDENT:
        student = db.query(student_models.Student).filter(student_models.Student.email == user.email, student_models.Student.school_id == str(tenant.school_id)).first()
        if not student:
             raise HTTPException(status_code=404, detail="Student profile not found")
        target_student_id = student.id
    elif user.role == Roles.PARENT:
        if not student_id:
            raise HTTPException(status_code=400, detail="student_id required")
        link = db.query(student_models.ParentStudentLink).filter(
            student_models.ParentStudentLink.parent_id == user.id,
            student_models.ParentStudentLink.student_id == student_id,
            student_models.ParentStudentLink.school_id == str(tenant.school_id)
        ).first()
        if not link:
             raise HTTPException(status_code=403, detail="Not authorized for this student")
        target_student_id = student_id

    query = db.query(academic_models.MarksEntry).filter(
        academic_models.MarksEntry.student_id == target_student_id,
        academic_models.MarksEntry.school_id == str(tenant.school_id),
        academic_models.MarksEntry.is_published == True 
    )

    if exam_term_id:
        query = query.filter(academic_models.MarksEntry.exam_term_id == exam_term_id)

    return query.all()

@router.get("/performance/trends", response_model=List[PerformanceTrend])
def get_performance_trends(
    student_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.STUDENT, Roles.PARENT, Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    target_student_id = None
    if user.role == Roles.STUDENT:
        student = db.query(student_models.Student).filter(student_models.Student.email == user.email, student_models.Student.school_id == str(tenant.school_id)).first()
        if not student:
             raise HTTPException(status_code=404, detail="Student profile not found")
        target_student_id = student.id
    elif user.role == Roles.PARENT:
        if not student_id:
            raise HTTPException(status_code=400, detail="student_id required")
        link = db.query(student_models.ParentStudentLink).filter(
            student_models.ParentStudentLink.parent_id == user.id,
            student_models.ParentStudentLink.student_id == student_id,
            student_models.ParentStudentLink.school_id == str(tenant.school_id)
        ).first()
        if not link:
             raise HTTPException(status_code=403, detail="Not authorized")
        target_student_id = student_id
    elif user.role == Roles.TEACHER:
        if not student_id:
            raise HTTPException(status_code=400, detail="student_id required")
        student = db.query(student_models.Student).filter(student_models.Student.id == student_id, student_models.Student.school_id == str(tenant.school_id)).first()
        if not student:
             raise HTTPException(status_code=404, detail="Student not found")

        assignment = db.query(academic_models.TeacherAssignment).filter(
            academic_models.TeacherAssignment.teacher_id == user.id,
            academic_models.TeacherAssignment.grade_id == student.grade_id,
            academic_models.TeacherAssignment.school_id == str(tenant.school_id)
        ).all()
        valid = False
        for asn in assignment:
            if asn.section_id is None or asn.section_id == student.section_id:
                valid = True
                break
        if not valid:
             raise HTTPException(status_code=403, detail="Not authorized")
        target_student_id = student_id
    else: 
         if not student_id:
             raise HTTPException(status_code=400, detail="student_id required")
         target_student_id = student_id

    from sqlalchemy import func

    results = db.query(
        academic_models.ExamTerm.name,
        func.avg(academic_models.MarksEntry.marks_obtained).label('average')
    ).join(academic_models.ExamTerm, academic_models.ExamTerm.id == academic_models.MarksEntry.exam_term_id).filter(
        academic_models.MarksEntry.student_id == target_student_id,
        academic_models.MarksEntry.is_published == True,
        academic_models.MarksEntry.school_id == str(tenant.school_id)
    ).group_by(academic_models.ExamTerm.name, academic_models.ExamTerm.id).all()

    trends = []
    for r in results:
        trends.append(PerformanceTrend(exam_term_name=r.name, average_score=round(r.average, 2)))

    return trends

@router.post("/assessment-types", response_model=AssessmentTypeResponse)
def create_assessment_type(
    type_data: AssessmentTypeCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    new_type = academic_models.AssessmentType(
        name=type_data.name,
        school_id=str(tenant.school_id)
    )
    db.add(new_type)
    db.commit()
    db.refresh(new_type)
    return new_type

@router.get("/assessment-types", response_model=List[AssessmentTypeResponse])
def list_assessment_types(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    return db.query(academic_models.AssessmentType).filter(academic_models.AssessmentType.school_id == str(tenant.school_id)).all()

@router.post("/assessments", response_model=AssessmentResponse)
def create_assessment(
    data: AssessmentCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    new_assessment = academic_models.Assessment(
        name=data.name,
        subject_id=data.subject_id,
        exam_term_id=data.exam_term_id,
        max_marks=data.max_marks,
        assessment_type_id=data.assessment_type_id,
        school_id=str(tenant.school_id)
    )
    db.add(new_assessment)
    db.commit()
    db.refresh(new_assessment)
    return new_assessment

@router.get("/assessments", response_model=List[AssessmentResponse])
def list_assessments(
    subject_id: Optional[str] = None,
    exam_term_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    query = db.query(academic_models.Assessment).filter(academic_models.Assessment.school_id == str(tenant.school_id))
    if subject_id:
        query = query.filter(academic_models.Assessment.subject_id == subject_id)
    if exam_term_id:
        query = query.filter(academic_models.Assessment.exam_term_id == exam_term_id)
    return query.all()

@router.post("/assessments/scores")
def bulk_enter_scores(
    input_data: BulkScoreInput,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    assessment = db.query(academic_models.Assessment).filter(
        academic_models.Assessment.id == input_data.assessment_id,
        academic_models.Assessment.school_id == str(tenant.school_id)
    ).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    updated_student_ids = []

    for item in input_data.scores:
        if item.score > assessment.max_marks:
             raise HTTPException(status_code=400, detail=f"Score {item.score} exceeds max marks {assessment.max_marks} for student {item.student_id}")

        existing = db.query(academic_models.StudentAssessmentScore).filter(
            academic_models.StudentAssessmentScore.assessment_id == assessment.id,
            academic_models.StudentAssessmentScore.student_id == item.student_id,
            academic_models.StudentAssessmentScore.school_id == str(tenant.school_id)
        ).first()

        if existing:
            existing.score = item.score
        else:
            new_score = academic_models.StudentAssessmentScore(
                assessment_id=assessment.id,
                student_id=item.student_id,
                score=item.score,
                school_id=str(tenant.school_id)
            )
            db.add(new_score)
        
        if item.student_id not in updated_student_ids:
            updated_student_ids.append(item.student_id)

    db.commit()

    term_assessments = db.query(academic_models.Assessment).filter(
        academic_models.Assessment.subject_id == assessment.subject_id,
        academic_models.Assessment.exam_term_id == assessment.exam_term_id,
        academic_models.Assessment.school_id == str(tenant.school_id)
    ).all()
    
    total_possible_marks = sum(a.max_marks for a in term_assessments)
    assessment_ids = [a.id for a in term_assessments]

    for student_id in updated_student_ids:
        scores = db.query(academic_models.StudentAssessmentScore).filter(
            academic_models.StudentAssessmentScore.student_id == student_id,
            academic_models.StudentAssessmentScore.assessment_id.in_(assessment_ids)
        ).all()
        
        total_score = sum(s.score for s in scores)
        
        marks_entry = db.query(academic_models.MarksEntry).filter(
            academic_models.MarksEntry.student_id == student_id,
            academic_models.MarksEntry.subject_id == assessment.subject_id,
            academic_models.MarksEntry.exam_term_id == assessment.exam_term_id,
            academic_models.MarksEntry.school_id == str(tenant.school_id)
        ).first()
        
        if marks_entry:
            if marks_entry.is_published and user.role == Roles.TEACHER:
                 pass
            else:
                marks_entry.marks_obtained = int(total_score)
                marks_entry.total_marks = total_possible_marks
        else:
             new_entry = academic_models.MarksEntry(
                student_id=student_id,
                subject_id=assessment.subject_id,
                exam_term_id=assessment.exam_term_id,
                marks_obtained=int(total_score),
                total_marks=total_possible_marks,
                school_id=str(tenant.school_id),
                is_published=False
             )
             db.add(new_entry)

    db.commit()
    return {"message": "Scores updated and final grades recalculated"}
