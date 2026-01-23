from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from auth.dependencies import get_db, require_roles, TenantAccess, Roles
from academics import models as academic_models
from schools import models as school_models
from students import models as student_models
from audit.listeners import set_reason
from pydantic import BaseModel, Field
from datetime import datetime
from auth.jwt import create_access_token

router = APIRouter(prefix="/students", tags=["students"])

class StudentUpdate(BaseModel):
    grade_id: Optional[str] = None
    section_id: Optional[str] = None
    status: Optional[str] = None
    parent_ids: Optional[List[str]] = None
    reason: Optional[str] = None

class StudentCreate(BaseModel):
    first_name: str
    last_name: str
    grade_id: Optional[str] = None
    section_id: Optional[str] = None
    roll_no: Optional[str] = None
    email: Optional[str] = None
    login_email: Optional[str] = None
    phone: Optional[str] = None
    create_login: bool = False
    login_password: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None

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

@router.post("", response_model=StudentResponse)
def create_student(
    student_in: StudentCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    # Check manual roll number or auto-generate
    if not student_in.roll_no:
        count = db.query(student_models.Student).filter(student_models.Student.school_id == str(tenant.school_id)).count()
        student_in.roll_no = f"R{datetime.now().year}-{count + 1:04d}"

    # Check email uniqueness if provided
    if student_in.email:
        existing = db.query(student_models.Student).filter(
            student_models.Student.email == student_in.email,
            student_models.Student.school_id == str(tenant.school_id)
        ).first()
        if existing:
            # For now just warn or allow? Better to allow unique email per school or globally?
            # Assuming globally unique email for login, but student record email might just be contact.
            pass

    new_student = student_models.Student(
        first_name=student_in.first_name,
        last_name=student_in.last_name,
        roll_number=student_in.roll_no,
        email=student_in.email,
        grade_id=student_in.grade_id,
        section_id=student_in.section_id,
        address=student_in.address,
        school_id=str(tenant.school_id),
        is_active=True
    )
    db.add(new_student)
    db.commit()
    db.refresh(new_student)
    
    # Return response with empty grade/section names if not joined yet (client usually re-fetches or we can join)
    # The response model expects grade_name/section_name. We can fetch them.
    grade_name = None
    section_name = None
    if new_student.grade_id:
        g = db.query(academic_models.Grade).get(new_student.grade_id)
        if g: grade_name = g.name
    
    return StudentResponse(
        id=new_student.id,
        first_name=new_student.first_name,
        last_name=new_student.last_name,
        roll_number=new_student.roll_number,
        grade_name=grade_name,
        section_name=section_name
    )

@router.get("", response_model=List[StudentResponse])
def list_students(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER, Roles.PARENT, Roles.STUDENT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    query = db.query(student_models.Student).filter(
        student_models.Student.school_id == str(tenant.school_id),
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

@router.patch("/{student_id}")
def update_student(
    student_id: str,
    update_data: StudentUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    student = db.query(student_models.Student).filter(
        student_models.Student.id == student_id,
        student_models.Student.school_id == str(tenant.school_id)
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if update_data.grade_id is not None:
        # Check if grade exists
        if not db.query(academic_models.Grade).filter(academic_models.Grade.id == update_data.grade_id, academic_models.Grade.school_id == tenant.school_id).first():
             raise HTTPException(status_code=400, detail="Invalid grade_id")

        # Governance: Check reason if changing grade (promotion/demotion)
        if update_data.grade_id != student.grade_id:
             reason_text = update_data.reason or f"Grade change: {student.grade_id} -> {update_data.grade_id}"
             set_reason(reason_text)

        student.grade_id = update_data.grade_id

    if update_data.section_id is not None:
        # Check if section exists
        if update_data.section_id and not db.query(academic_models.Section).filter(academic_models.Section.id == update_data.section_id, academic_models.Section.school_id == tenant.school_id).first():
             raise HTTPException(status_code=400, detail="Invalid section_id")
        student.section_id = update_data.section_id

    if update_data.status is not None:
        student.is_active = (update_data.status == "active")

    if update_data.parent_ids is not None:
        # Handle parent assignment (simplistic replace or add?)
        # For now, just simplistic re-link for demo purposes or skip if too complex for patch
        # The frontend sends parent_ids.
        # Clear existing
        db.query(student_models.ParentStudentLink).filter(student_models.ParentStudentLink.student_id == student.id).delete()
        for pid in update_data.parent_ids:
            link = student_models.ParentStudentLink(
                parent_id=pid,
                student_id=student.id,
                school_id=tenant.school_id
            )
            db.add(link)

    db.commit()
    db.refresh(student)
    return student

@router.delete("/{student_id}")
def delete_student(
    student_id: str,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    student = db.query(student_models.Student).filter(
        student_models.Student.id == student_id,
        student_models.Student.school_id == str(tenant.school_id)
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
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    query = db.query(student_models.Student).filter(
        student_models.Student.school_id == str(tenant.school_id),
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
    return results

@router.get("/{student_id}/qr-token")
def get_student_qr_token(
    student_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PARENT, Roles.STUDENT, Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    student = db.query(student_models.Student).filter(
        student_models.Student.id == student_id,
        student_models.Student.school_id == str(tenant.school_id)
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Authorization Check
    if user.role == Roles.PARENT:
        link = db.query(student_models.ParentStudentLink).filter(
            student_models.ParentStudentLink.parent_id == user.id,
            student_models.ParentStudentLink.student_id == student_id
        ).first()
        if not link:
            raise HTTPException(status_code=403, detail="Not authorized for this student")
    elif user.role == Roles.STUDENT:
        if user.id != student_id:
            raise HTTPException(status_code=403, detail="Not authorized")

    # Generate QR Token (Valid for 5 minutes)
    token_data = {
        "sub": student.id,
        "type": "qr_entry",
        "school_id": str(tenant.school_id),
        "role": Roles.STUDENT
    }
    token = create_access_token(token_data, expires_minutes=5)

    return {"token": token, "valid_minutes": 5}
    return {"token": token, "valid_minutes": 5}

@router.get("/parent/dashboard/summary")
def get_parent_dashboard_summary(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PARENT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    links = db.query(student_models.ParentStudentLink).filter(
        student_models.ParentStudentLink.parent_id == user.id,
        student_models.ParentStudentLink.school_id == tenant.school_id
    ).all()
    
    student_ids = [link.student_id for link in links]
    if not student_ids:
        return []

    students = db.query(student_models.Student).filter(
        student_models.Student.id.in_(student_ids)
    ).outerjoin(academic_models.Grade, student_models.Student.grade_id == academic_models.Grade.id)\
     .outerjoin(academic_models.Section, student_models.Student.section_id == academic_models.Section.id)\
     .add_columns(academic_models.Grade.name.label("grade_name"), academic_models.Section.name.label("section_name"))\
     .all()

    # The Dashboard expects a specific format for the ChildSwitcher
    # [{id, first_name, last_name, grade_name, section_name, photo_url}]
    
    results = []
    for s, g_name, s_name in students:
        results.append({
            "id": s.id,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "grade": g_name or "N/A",
            "section": s_name or "",
            "photo_url": s.photo_url
        })
    return results
