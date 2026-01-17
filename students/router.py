from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from auth.dependencies import get_db, require_roles, TenantAccess, Roles
from academics import models as academic_models
from schools import models as school_models
from students import models as student_models
from audit.listeners import set_reason
from pydantic import BaseModel

router = APIRouter(prefix="/api/students", tags=["students"])

class StudentResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    roll_number: str
    grade_name: Optional[str] = None
    section_name: Optional[str] = None
    pickup_blocked: bool = False
    pickup_block_reason: Optional[str] = None

    class Config:
        from_attributes = True

@router.get("/", response_model=List[StudentResponse])
def list_students(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.SUPER_ADMIN, Roles.TEACHER, Roles.PARENT, Roles.STUDENT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    query = db.query(student_models.Student).filter(
        student_models.Student.school_id == tenant.school_id,
        student_models.Student.is_active == True # Default to active only
    )

    if user.role == Roles.TEACHER:
        # Teacher: Scope to assigned grade/sections
        assignments = db.query(academic_models.TeacherAssignment).filter(
            academic_models.TeacherAssignment.teacher_id == user.id,
            academic_models.TeacherAssignment.school_id == tenant.school_id
        ).all()

        if not assignments:
            # Teacher has no assignments, sees nothing? Or sees all? Strict scoping implies nothing.
            return []

        # Collect allowed (grade_id, section_id) pairs
        # If assignment has grade_id but no section_id -> all sections in that grade
        # If assignment has grade_id AND section_id -> specific section

        # We need to construct a complex filter or filter in python. SQL is better.
        # OR conditions:
        # (grade_id = G1 AND section_id IS NULL) OR (grade_id = G1 AND section_id = S1)

        from sqlalchemy import or_, and_
        conditions = []
        for assign in assignments:
            if assign.grade_id and not assign.section_id:
                conditions.append(student_models.Student.grade_id == assign.grade_id)
            elif assign.grade_id and assign.section_id:
                conditions.append(and_(
                    student_models.Student.grade_id == assign.grade_id,
                    student_models.Student.section_id == assign.section_id
                ))
            # What if assignment only has subject? Usually subject is tied to grade/section.
            # If raw subject assignment (e.g. "Math" for whole school?) - unlikely for "Class Teacher".
            # Assuming Grade/Section is primary scoping.

        if conditions:
            query = query.filter(or_(*conditions))
        else:
            return []

    elif user.role == Roles.PARENT:
        # Parent: Only linked children
        # Get linked student IDs
        links = db.query(student_models.ParentStudentLink).filter(
            student_models.ParentStudentLink.parent_id == user.id,
            student_models.ParentStudentLink.school_id == tenant.school_id
        ).all()
        student_ids = [link.student_id for link in links]
        query = query.filter(student_models.Student.id.in_(student_ids))

    elif user.role == Roles.STUDENT:
        # Student: Only self
        query = query.filter(student_models.Student.id == user.id)

    # Optimized query with joins
    query = query.outerjoin(academic_models.Grade, student_models.Student.grade_id == academic_models.Grade.id)\
                 .outerjoin(academic_models.Section, student_models.Student.section_id == academic_models.Section.id)\
                 .add_columns(academic_models.Grade.name.label("grade_name"), academic_models.Section.name.label("section_name"))

    results = []
    # Query returns (Student, grade_name, section_name) tuples
    for student, grade_name, section_name in query.all():
        results.append(StudentResponse(
            id=student.id,
            first_name=student.first_name,
            last_name=student.last_name,
            roll_number=student.roll_number,
            grade_name=grade_name,
            section_name=section_name,
            pickup_blocked=student.pickup_blocked,
            pickup_block_reason=student.pickup_block_reason
        ))

    return results

@router.delete("/{student_id}")
def delete_student(
    student_id: str,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    student = db.query(student_models.Student).filter(
        student_models.Student.id == student_id,
        student_models.Student.school_id == tenant.school_id
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    set_reason(reason or "No justification provided")

    student.is_active = False
    db.commit()
    return {"message": "Student deactivated successfully"}

@router.get("/inactive", response_model=List[StudentResponse])
def list_inactive_students(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    query = db.query(student_models.Student).filter(
        student_models.Student.school_id == tenant.school_id,
        student_models.Student.is_active == False
    ).outerjoin(academic_models.Grade, student_models.Student.grade_id == academic_models.Grade.id)\
     .outerjoin(academic_models.Section, student_models.Student.section_id == academic_models.Section.id)\
     .add_columns(academic_models.Grade.name.label("grade_name"), academic_models.Section.name.label("section_name"))

    results = []
    for student, grade_name, section_name in query.all():
        results.append(StudentResponse(
            id=student.id,
            first_name=student.first_name,
            last_name=student.last_name,
            roll_number=student.roll_number,
            grade_name=grade_name,
            section_name=section_name
        ))
    return results
