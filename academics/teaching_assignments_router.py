from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from auth.dependencies import get_current_user, require_roles, TenantAccess, Roles
from academics import models as academic_models
from schools import models as school_models
from pydantic import BaseModel, ConfigDict
import uuid
from datetime import datetime, timezone
import logging

log = logging.getLogger(__name__)

router = APIRouter(prefix="/teaching-assignments", tags=["Teaching Assignments"])

# --- Schemas ---

class TeachingAssignmentBase(BaseModel):
    teacher_user_id: str
    grade_id: str
    section_id: str
    subject_id: str
    is_class_teacher: bool = False

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

class ClassTeacherToggle(BaseModel):
    is_class_teacher: bool

class SubjectOption(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# --- Endpoints ---

@router.get("/teacher/{teacher_user_id}", response_model=List[TeachingAssignmentResponse])
def list_teacher_assignments(
    teacher_user_id: str,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.ACADEMIC_ADMIN, Roles.SUPER_ADMIN, Roles.SUPER_USER))
):
    school_id = str(tenant.school_id)
    
    # Validate teacher exists in school (optional but good practice)
    try:
        t_uuid = uuid.UUID(teacher_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid teacher ID format")

    teacher = db.query(school_models.User).filter(
        school_models.User.id == t_uuid,
        school_models.User.school_id == uuid.UUID(school_id)
    ).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    assignments = db.query(academic_models.TeachingAssignment).filter(
        academic_models.TeachingAssignment.school_id == school_id,
        academic_models.TeachingAssignment.teacher_user_id == teacher_user_id
    ).order_by(academic_models.TeachingAssignment.created_at.desc()).all()
    
    results = []
    
    # Prefetch helpers could be optimised, but loop is fine for per-teacher list
    for assign in assignments:
        resp = TeachingAssignmentResponse.from_orm(assign)
        
        # Populate Names
        resp.teacher_name = f"{teacher.first_name} {teacher.last_name}"
        
        # Subject
        subj = db.query(academic_models.Subject).get(assign.subject_id)
        if subj:
             resp.subject_name = subj.name
             
        # Grade
        grade = db.query(academic_models.Grade).get(assign.grade_id)
        if grade:
            resp.grade_name = grade.name
            
        # Section
        if assign.section_id:
            section = db.query(academic_models.Section).get(assign.section_id)
            if section:
                resp.section_name = section.name
                
        results.append(resp)
        
    return results

@router.post("/", response_model=TeachingAssignmentResponse)
def create_teaching_assignment(
    req: TeachingAssignmentCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.ACADEMIC_ADMIN, Roles.SUPER_ADMIN, Roles.SUPER_USER))
):
    school_id = str(tenant.school_id)
    
    # 1. Validation: Check duplicates
    existing = db.query(academic_models.TeachingAssignment).filter(
        academic_models.TeachingAssignment.school_id == school_id,
        academic_models.TeachingAssignment.academic_year_id == req.academic_year_id,
        academic_models.TeachingAssignment.teacher_user_id == req.teacher_user_id,
        academic_models.TeachingAssignment.grade_id == req.grade_id,
        academic_models.TeachingAssignment.section_id == req.section_id,
        academic_models.TeachingAssignment.subject_id == req.subject_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Assignment already exists for this subject in the same class.")
        
    # 2. Class Teacher Mutual Exclusion
    if req.is_class_teacher:
        # Check if anyone else is class teacher for this Grade+Section+Year
        current_ct = db.query(academic_models.TeachingAssignment).filter(
            academic_models.TeachingAssignment.school_id == school_id,
            academic_models.TeachingAssignment.academic_year_id == req.academic_year_id,
            academic_models.TeachingAssignment.grade_id == req.grade_id,
            academic_models.TeachingAssignment.section_id == req.section_id,
            academic_models.TeachingAssignment.is_class_teacher == True
        ).first()
        
        if current_ct:
            # Option A: Fail
            # raise HTTPException(status_code=400, detail="Another teacher is already assigned as Class Teacher.")
            
            # Option B: Auto-unset (as per plan "automatically toggle OFF any other assignment")
            current_ct.is_class_teacher = False
            db.add(current_ct)
            # We don't commit yet
            
    # 3. Create
    new_assign = academic_models.TeachingAssignment(
        school_id=school_id,
        academic_year_id=req.academic_year_id,
        teacher_user_id=req.teacher_user_id,
        grade_id=req.grade_id,
        section_id=req.section_id,
        subject_id=req.subject_id,
        is_class_teacher=req.is_class_teacher
    )
    db.add(new_assign)
    db.commit()
    db.refresh(new_assign)
    
    # Populate Response
    resp = TeachingAssignmentResponse.from_orm(new_assign)
    
    # Fetch names for response
    teacher = db.query(school_models.User).get(uuid.UUID(new_assign.teacher_user_id))
    if teacher: resp.teacher_name = f"{teacher.first_name} {teacher.last_name}"
    
    subj = db.query(academic_models.Subject).get(new_assign.subject_id)
    if subj: resp.subject_name = subj.name
    
    grade = db.query(academic_models.Grade).get(new_assign.grade_id)
    if grade: resp.grade_name = grade.name
            
    section = db.query(academic_models.Section).get(new_assign.section_id)
    if section: resp.section_name = section.name
    
    return resp

@router.patch("/{assignment_id}/class-teacher")
def toggle_class_teacher(
    assignment_id: str,
    toggle: ClassTeacherToggle,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.ACADEMIC_ADMIN, Roles.SUPER_ADMIN, Roles.SUPER_USER))
):
    school_id = str(tenant.school_id)
    
    assign = db.query(academic_models.TeachingAssignment).filter(
        academic_models.TeachingAssignment.id == assignment_id,
        academic_models.TeachingAssignment.school_id == school_id
    ).first()
    
    if not assign:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    if toggle.is_class_teacher:
         # Check mutual exclusion
        current_ct = db.query(academic_models.TeachingAssignment).filter(
            academic_models.TeachingAssignment.school_id == school_id,
            academic_models.TeachingAssignment.academic_year_id == assign.academic_year_id,
            academic_models.TeachingAssignment.grade_id == assign.grade_id,
            academic_models.TeachingAssignment.section_id == assign.section_id,
            academic_models.TeachingAssignment.is_class_teacher == True
        ).first()
        
        if current_ct and current_ct.id != assign.id:
            current_ct.is_class_teacher = False
            db.add(current_ct)
            
    assign.is_class_teacher = toggle.is_class_teacher
    db.commit()
    
    return {"message": "Updated class teacher status", "is_class_teacher": assign.is_class_teacher}

@router.delete("/{assignment_id}")
def delete_assignment(
    assignment_id: str,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.ACADEMIC_ADMIN, Roles.SUPER_ADMIN, Roles.SUPER_USER))
):
    school_id = str(tenant.school_id)
    
    assign = db.query(academic_models.TeachingAssignment).filter(
        academic_models.TeachingAssignment.id == assignment_id,
        academic_models.TeachingAssignment.school_id == school_id
    ).first()
    
    if not assign:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    db.delete(assign)
    db.commit()
    
    return {"message": "Assignment deleted"}

@router.get("/options/subjects", response_model=List[SubjectOption])
def list_available_subjects(
    academic_year_id: str,
    grade_id: str,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.ACADEMIC_ADMIN, Roles.SUPER_ADMIN, Roles.SUPER_USER))
):
    school_id = str(tenant.school_id)
    
    # Priority: GradeSubjects (scoped) -> Subjects (generic grade_id)
    # Check GradeSubject mapping first
    grade_subjects = db.query(academic_models.GradeSubject).filter(
        academic_models.GradeSubject.school_id == school_id,
        academic_models.GradeSubject.academic_year_id == academic_year_id,
        academic_models.GradeSubject.grade_id == grade_id,
        academic_models.GradeSubject.is_active == True
    ).all()
    
    if grade_subjects:
        subject_ids = [gs.subject_id for gs in grade_subjects]
        subjects = db.query(academic_models.Subject).filter(
             academic_models.Subject.id.in_(subject_ids)
        ).all()
        return subjects
    
    # Fallback to Generic Subjects filtered by Grade
    subjects = db.query(academic_models.Subject).filter(
        academic_models.Subject.school_id == school_id,
        academic_models.Subject.grade_id == grade_id
    ).all()
    
    return subjects
