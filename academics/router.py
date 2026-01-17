from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from database import SessionLocal
from auth.dependencies import get_db, get_current_user, require_roles, TenantAccess, Roles
from students import models as student_models
from academics import models as academic_models
from schools import models as school_models
from pydantic import BaseModel
import uuid
from audit.models import AuditLog
from audit.listeners import set_reason
import json
from datetime import datetime, timezone, date
from typing import Dict, Any
from auth.subscription import require_subscription_feature

router = APIRouter(prefix="/api/academics", tags=["academics"])

# Schemas
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
    coverage_percent: float

# Endpoints for Lesson Plans
@router.post("/lesson-plans", response_model=LessonPlanResponse)
def create_lesson_plan(
    plan: LessonPlanCreate,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SCHOOL_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("LESSON_PLANNER"))
):
    # If teacher, enforce teacher_id = user.id
    teacher_id = user.id
    if user.role != Roles.TEACHER:
        # Principals might plan for others? Let's assume user is the teacher for now unless we add teacher_id in schema
        pass

    new_plan = academic_models.LessonPlan(
        school_id=tenant.school_id,
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
    user: school_models.User = Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SCHOOL_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("LESSON_PLANNER"))
):
    query = db.query(academic_models.LessonPlan).filter(
        academic_models.LessonPlan.school_id == tenant.school_id
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
        academic_models.LessonPlan.school_id == tenant.school_id,
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
    user: school_models.User = Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("LESSON_PLANNER"))
):
    # Aggregates how many planned lessons have been marked as 'Completed'
    # Group by Teacher and Subject
    from sqlalchemy import func, case

    results = db.query(
        academic_models.LessonPlan.teacher_id,
        academic_models.LessonPlan.subject_id,
        func.count(academic_models.LessonPlan.id).label('total'),
        func.sum(case((academic_models.LessonPlan.status == academic_models.LessonPlanStatus.COMPLETED, 1), else_=0)).label('completed')
    ).filter(
        academic_models.LessonPlan.school_id == tenant.school_id
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

# Endpoints for Sections
@router.post("/sections", response_model=SectionResponse)
def create_section(
    section: SectionCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    new_section = academic_models.Section(
        name=section.name,
        school_id=tenant.school_id
    )
    db.add(new_section)
    db.commit()
    db.refresh(new_section)
    return new_section

@router.get("/sections", response_model=List[SectionResponse])
def list_sections(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    return db.query(academic_models.Section).filter(academic_models.Section.school_id == tenant.school_id).all()

# Endpoints for Grades
@router.post("/grades", response_model=GradeResponse)
def create_grade(
    grade: GradeCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    new_grade = academic_models.Grade(
        name=grade.name,
        sequence=grade.sequence,
        school_id=tenant.school_id
    )
    db.add(new_grade)
    db.commit()
    db.refresh(new_grade)
    return new_grade

@router.get("/grades", response_model=List[GradeResponse])
def list_grades(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER, Roles.PARENT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    return db.query(academic_models.Grade).filter(academic_models.Grade.school_id == tenant.school_id).order_by(academic_models.Grade.sequence).all()

@router.post("/grades/{grade_id}/sections")
def link_grade_section(
    grade_id: str,
    link_data: GradeSectionLink, # accept body
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    # Verify grade and section exist and belong to school
    grade = db.query(academic_models.Grade).filter(academic_models.Grade.id == grade_id, academic_models.Grade.school_id == tenant.school_id).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Grade not found")

    section = db.query(academic_models.Section).filter(academic_models.Section.id == link_data.section_id, academic_models.Section.school_id == tenant.school_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    # Check if link exists
    existing = db.query(academic_models.GradeSection).filter(
        academic_models.GradeSection.grade_id == grade_id,
        academic_models.GradeSection.section_id == link_data.section_id,
        academic_models.GradeSection.school_id == tenant.school_id
    ).first()

    if existing:
        return {"message": "Link already exists"}

    new_link = academic_models.GradeSection(
        grade_id=grade_id,
        section_id=link_data.section_id,
        school_id=tenant.school_id
    )
    db.add(new_link)
    db.commit()
    return {"message": "Grade linked to Section successfully"}

@router.post("/assignments")
def assign_teacher(
    assignment: TeacherAssignmentCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    # Verify teacher exists and is in the school
    teacher = db.query(school_models.User).filter(
        school_models.User.id == assignment.teacher_id,
        school_models.User.school_id == tenant.school_id,
        school_models.User.role == Roles.TEACHER
    ).first()

    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    # Verify grade/section/subject if provided
    if assignment.grade_id:
        if not db.query(academic_models.Grade).filter(academic_models.Grade.id == assignment.grade_id, academic_models.Grade.school_id == tenant.school_id).first():
            raise HTTPException(status_code=404, detail="Grade not found")

    if assignment.section_id:
        if not db.query(academic_models.Section).filter(academic_models.Section.id == assignment.section_id, academic_models.Section.school_id == tenant.school_id).first():
            raise HTTPException(status_code=404, detail="Section not found")

    if assignment.subject_id:
         if not db.query(academic_models.Subject).filter(academic_models.Subject.id == assignment.subject_id, academic_models.Subject.school_id == tenant.school_id).first():
            raise HTTPException(status_code=404, detail="Subject not found")

    new_assignment = academic_models.TeacherAssignment(
        teacher_id=assignment.teacher_id,
        grade_id=assignment.grade_id,
        section_id=assignment.section_id,
        subject_id=assignment.subject_id,
        school_id=tenant.school_id
    )
    db.add(new_assignment)
    db.commit()
    return {"message": "Teacher assigned successfully"}

@router.post("/promote")
def promote_students(
    target_academic_year_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    # Verify target AY
    target_ay = db.query(academic_models.AcademicYear).filter(
        academic_models.AcademicYear.id == target_academic_year_id,
        academic_models.AcademicYear.school_id == tenant.school_id
    ).first()
    if not target_ay:
        raise HTTPException(status_code=404, detail="Target Academic Year not found")

    # Get all active students
    students = db.query(student_models.Student).filter(
        student_models.Student.school_id == tenant.school_id,
        student_models.Student.is_active == True
    ).all()

    promoted_count = 0
    retained_count = 0
    graduated_count = 0

    # Cache grades for sequence lookup
    grades = db.query(academic_models.Grade).filter(academic_models.Grade.school_id == tenant.school_id).all()
    grade_map = {g.id: g for g in grades}
    max_sequence = max([g.sequence for g in grades]) if grades else 0

    for student in students:
        if student.retention_flag:
            # Repeater Rule: Stay in current grade, but move to new Academic Year
            student.academic_year_id = target_academic_year_id
            student.retention_flag = False
            retained_count += 1
        else:
            # Promotion Logic
            if not student.grade_id:
                continue # Skip unassigned

            current_grade = grade_map.get(student.grade_id)
            if not current_grade:
                continue

            # Find next grade with sequence > current_grade.sequence
            # We want the smallest sequence that is strictly greater than current
            possible_next_grades = [g for g in grades if g.sequence > current_grade.sequence]
            possible_next_grades.sort(key=lambda x: x.sequence)

            if not possible_next_grades:
                # Graduated: No higher grade exists
                graduated_count += 1
                # Mark as graduated/inactive or move to 'Alumni' status
                # For now, we deactivate them to clear them from active lists
                student.is_active = False
                student.grade_id = None
                student.section_id = None
                # student.academic_year_id remains last active year or set to null?
                # Keeping it might be good for history, or set to target_ay to show "Graduated in 2024-25"
                # Let's keep academic_year_id as is (last active year)
            else:
                next_grade = possible_next_grades[0]
                student.grade_id = next_grade.id
                student.academic_year_id = target_academic_year_id

                # Check section validity
                link = db.query(academic_models.GradeSection).filter(
                    academic_models.GradeSection.grade_id == next_grade.id,
                    academic_models.GradeSection.section_id == student.section_id
                ).first()
                if not link:
                    student.section_id = None # Clear section if not valid for new grade

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
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    student = db.query(student_models.Student).filter(
        student_models.Student.id == student_id,
        student_models.Student.school_id == tenant.school_id
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # We set the flag
    student.retention_flag = True

    # Create manual audit log for the reason
    audit_entry = AuditLog(
        actor_id=user.id,
        action_type="MANUAL_RETENTION",
        table_name="students",
        record_id=student.id,
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
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    new_term = academic_models.ExamTerm(
        name=term.name,
        school_id=tenant.school_id
    )
    db.add(new_term)
    db.commit()
    db.refresh(new_term)
    return new_term

@router.post("/exams/marks", response_model=MarksEntryResponse)
def enter_marks(
    marks_data: MarksEntryCreate,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SCHOOL_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    # Verify Student exists
    student = db.query(student_models.Student).filter(student_models.Student.id == marks_data.student_id, student_models.Student.school_id == tenant.school_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Verify Exam Term belongs to tenant
    exam_term = db.query(academic_models.ExamTerm).filter(
        academic_models.ExamTerm.id == marks_data.exam_term_id,
        academic_models.ExamTerm.school_id == tenant.school_id
    ).first()
    if not exam_term:
        raise HTTPException(status_code=404, detail="Exam Term not found")

    # Check for Teacher assignment if user is Teacher
    if user.role == Roles.TEACHER:
        # Teacher must be assigned to the Subject
        # They should also be assigned to the Student's Grade/Section for that Subject?
        # A simple check: Teacher assigned to Subject X?
        # More robust: Teacher assigned to Subject X for Grade G and Section S?
        if not student.grade_id:
             raise HTTPException(status_code=400, detail="Student not assigned to a grade")

        assignment = db.query(academic_models.TeacherAssignment).filter(
            academic_models.TeacherAssignment.teacher_id == user.id,
            academic_models.TeacherAssignment.subject_id == marks_data.subject_id,
            # We check if assignment matches student's grade (and section if specified in assignment)
            # If assignment has section_id, it must match student's section.
            # If assignment has no section_id, it applies to all sections in that grade? Or maybe just grade is enough?
            # Let's assume strict checking:
            academic_models.TeacherAssignment.school_id == tenant.school_id
        ).all()

        # Filter assignments in python or refine query
        valid_assignment = False
        for asn in assignment:
            if asn.grade_id == student.grade_id:
                if asn.section_id is None or asn.section_id == student.section_id:
                    valid_assignment = True
                    break

        if not valid_assignment:
             raise HTTPException(status_code=403, detail="Teacher not assigned to this student's grade/subject")

    # Check if marks already exist
    existing_marks = db.query(academic_models.MarksEntry).filter(
        academic_models.MarksEntry.student_id == marks_data.student_id,
        academic_models.MarksEntry.subject_id == marks_data.subject_id,
        academic_models.MarksEntry.exam_term_id == marks_data.exam_term_id,
        academic_models.MarksEntry.school_id == tenant.school_id
    ).first()

    if existing_marks:
        if existing_marks.is_published:
            raise HTTPException(status_code=403, detail="Marks are locked (Published). Contact Admin for override.")

        # Governance: Require justification, default to system note if missing to prevent breakage
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
            school_id=tenant.school_id
        )
        db.add(new_marks)
        db.commit()
        db.refresh(new_marks)
        return new_marks

@router.post("/exams/marks/{marks_id}/publish")
def publish_marks(
    marks_id: str,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SCHOOL_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    marks = db.query(academic_models.MarksEntry).filter(
        academic_models.MarksEntry.id == marks_id,
        academic_models.MarksEntry.school_id == tenant.school_id
    ).first()

    if not marks:
        raise HTTPException(status_code=404, detail="Marks entry not found")

    # Verify ownership if teacher
    if user.role == Roles.TEACHER:
        student = db.query(student_models.Student).filter(student_models.Student.id == marks.student_id).first()
        if not student or not student.grade_id:
             raise HTTPException(status_code=400, detail="Student invalid or unassigned")

        assignment = db.query(academic_models.TeacherAssignment).filter(
            academic_models.TeacherAssignment.teacher_id == user.id,
            academic_models.TeacherAssignment.subject_id == marks.subject_id,
            academic_models.TeacherAssignment.school_id == tenant.school_id
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
    user: school_models.User = Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    marks = db.query(academic_models.MarksEntry).filter(
        academic_models.MarksEntry.id == marks_id,
        academic_models.MarksEntry.school_id == tenant.school_id
    ).first()

    if not marks:
        raise HTTPException(status_code=404, detail="Marks entry not found")

    # Set reason in context for audit logging
    set_reason(override_data.reason)

    marks.marks_obtained = override_data.marks_obtained
    # We might also want to ensure it remains published or allow unpublishing?
    # User just said "change to a published grade requires override".
    # We keep it published probably, just update the value.

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
        student = db.query(student_models.Student).filter(student_models.Student.email == user.email, student_models.Student.school_id == tenant.school_id).first()
        if not student:
             raise HTTPException(status_code=404, detail="Student profile not found")
        target_student_id = student.id
    elif user.role == Roles.PARENT:
        if not student_id:
            raise HTTPException(status_code=400, detail="student_id required")
        # Verify link
        link = db.query(student_models.ParentStudentLink).filter(
            student_models.ParentStudentLink.parent_id == user.id,
            student_models.ParentStudentLink.student_id == student_id,
            student_models.ParentStudentLink.school_id == tenant.school_id
        ).first()
        if not link:
             raise HTTPException(status_code=403, detail="Not authorized for this student")
        target_student_id = student_id

    query = db.query(academic_models.MarksEntry).filter(
        academic_models.MarksEntry.student_id == target_student_id,
        academic_models.MarksEntry.school_id == tenant.school_id,
        academic_models.MarksEntry.is_published == True # Only published results
    )

    if exam_term_id:
        query = query.filter(academic_models.MarksEntry.exam_term_id == exam_term_id)

    return query.all()

@router.get("/performance/trends", response_model=List[PerformanceTrend])
def get_performance_trends(
    student_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.STUDENT, Roles.PARENT, Roles.TEACHER, Roles.PRINCIPAL, Roles.SCHOOL_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    target_student_id = None
    if user.role == Roles.STUDENT:
        student = db.query(student_models.Student).filter(student_models.Student.email == user.email, student_models.Student.school_id == tenant.school_id).first()
        if not student:
             raise HTTPException(status_code=404, detail="Student profile not found")
        target_student_id = student.id
    elif user.role == Roles.PARENT:
        if not student_id:
            raise HTTPException(status_code=400, detail="student_id required")
        link = db.query(student_models.ParentStudentLink).filter(
            student_models.ParentStudentLink.parent_id == user.id,
            student_models.ParentStudentLink.student_id == student_id,
            student_models.ParentStudentLink.school_id == tenant.school_id
        ).first()
        if not link:
             raise HTTPException(status_code=403, detail="Not authorized")
        target_student_id = student_id
    elif user.role == Roles.TEACHER:
        if not student_id:
            raise HTTPException(status_code=400, detail="student_id required")
        student = db.query(student_models.Student).filter(student_models.Student.id == student_id, student_models.Student.school_id == tenant.school_id).first()
        if not student:
             raise HTTPException(status_code=404, detail="Student not found")

        # Check assignment
        assignment = db.query(academic_models.TeacherAssignment).filter(
            academic_models.TeacherAssignment.teacher_id == user.id,
            academic_models.TeacherAssignment.grade_id == student.grade_id,
            academic_models.TeacherAssignment.school_id == tenant.school_id
        ).all()
        valid = False
        for asn in assignment:
            if asn.section_id is None or asn.section_id == student.section_id:
                valid = True
                break
        if not valid:
             raise HTTPException(status_code=403, detail="Not authorized")
        target_student_id = student_id
    else: # Admin
         if not student_id:
             raise HTTPException(status_code=400, detail="student_id required")
         target_student_id = student_id

    # Calculate average marks per Exam Term
    # Published marks only

    # We need to join with ExamTerm to get name
    from sqlalchemy import func

    results = db.query(
        academic_models.ExamTerm.name,
        func.avg(academic_models.MarksEntry.marks_obtained).label('average')
    ).join(academic_models.ExamTerm, academic_models.ExamTerm.id == academic_models.MarksEntry.exam_term_id).filter(
        academic_models.MarksEntry.student_id == target_student_id,
        academic_models.MarksEntry.is_published == True,
        academic_models.MarksEntry.school_id == tenant.school_id
    ).group_by(academic_models.ExamTerm.name, academic_models.ExamTerm.id).all()

    trends = []
    for r in results:
        trends.append(PerformanceTrend(exam_term_name=r.name, average_score=round(r.average, 2)))

    return trends
