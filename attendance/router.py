from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, case
from typing import List, Optional, Dict
from datetime import date, datetime, timezone
import uuid
from pydantic import BaseModel

from database import SessionLocal
from auth.dependencies import get_db, require_roles, Roles, TenantAccess, get_current_user
from attendance.models import Attendance, AttendanceStatus
from students.models import Student, ParentStudentLink
from academics.models import TeacherAssignment, Section, Grade, GradeSection
from schools.models import User
from audit.listeners import set_actor_id, set_reason

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"],
    responses={404: {"description": "Not found"}},
)

# --- SCHEMAS ---

class AttendanceRecordInput(BaseModel):
    student_id: str
    status: AttendanceStatus
    note: Optional[str] = None

class AttendanceBulkCreate(BaseModel):
    date: date
    grade_id: Optional[str] = None # Optional if derived from context, but explicit is better
    section_id: str
    records: List[AttendanceRecordInput]

class AttendanceSummary(BaseModel):
    created: int
    updated: int

class StudentAttendanceStats(BaseModel):
    summary: dict
    trend: List[dict]
    byMonth: List[dict]

class SectionOption(BaseModel):
    id: str
    name: str
    grade_id: str
    grade_name: str

class RosterStudent(BaseModel):
    id: str
    name: str
    roll_number: Optional[str]
    photo_url: Optional[str]

# --- TEACHER ENDPOINTS ---

@router.get("/teacher/context", response_model=List[SectionOption])
def get_teacher_attendance_context(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN, "school_admin")),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """
    Returns list of Grade/Sections the teacher can take attendance for.
    If Teacher: based on assignments.
    If Admin: all sections.
    """
    options = []
    
    if user.role == Roles.TEACHER:
        assignments = db.query(TeacherAssignment).filter(
            TeacherAssignment.teacher_id == user.id,
            TeacherAssignment.school_id == tenant.school_id
        ).all()
        
        # We need to resolve Grade/Section details.
        # Assignments can be Grade-only (all sections) or Grade+Section.
        
        for asn in assignments:
            if asn.section_id:
                # Specific Section
                gs_info = db.query(Grade, Section).filter(
                     Grade.id == asn.grade_id,
                     Section.id == asn.section_id
                ).first()
                if gs_info:
                    g, s = gs_info
                    options.append({"id": s.id, "name": s.name, "grade_id": g.id, "grade_name": g.name})
            elif asn.grade_id:
                # All sections in Grade
                # Fetch all sections linked to this grade
                sections = db.query(Section, GradeSection).join(GradeSection).filter(
                    GradeSection.grade_id == asn.grade_id,
                    GradeSection.section_id == Section.id,
                    Section.school_id == tenant.school_id
                ).all()
                # We need Grade name
                grade = db.query(Grade).get(asn.grade_id)
                for s, gs in sections:
                     options.append({"id": s.id, "name": s.name, "grade_id": grade.id, "grade_name": grade.name})
        
        # Deduplicate
        unique_options = {o["id"]: o for o in options}.values()
        return list(unique_options)

    else:
        # Admins see all sections
        # Join GradeSection to get Grade info
        results = db.query(Section, Grade).join(GradeSection, GradeSection.section_id == Section.id)\
            .join(Grade, GradeSection.grade_id == Grade.id)\
            .filter(Section.school_id == tenant.school_id).all()
            
        for s, g in results:
             options.append({"id": s.id, "name": s.name, "grade_id": g.id, "grade_name": g.name})
             
        return options

@router.get("/teacher/roster", response_model=List[RosterStudent])
def get_section_roster(
    section_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN, "school_admin")),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """
    Get students for a specific section (to populate attendance form).
    Security: Verify teacher assignment.
    """
    # 1. Verify Access
    if user.role == Roles.TEACHER:
        # Check if teacher assigned to this section (directly or via grade)
        # Find grade of this section first
        gs = db.query(GradeSection).filter(GradeSection.section_id == section_id, GradeSection.school_id == tenant.school_id).first()
        if not gs:
             raise HTTPException(status_code=404, detail="Section not found")
        
        has_access = db.query(TeacherAssignment).filter(
            TeacherAssignment.teacher_id == user.id,
            TeacherAssignment.school_id == tenant.school_id,
            (TeacherAssignment.section_id == section_id) | 
            ((TeacherAssignment.grade_id == gs.grade_id) & (TeacherAssignment.section_id == None))
        ).first()
        
        if not has_access:
            raise HTTPException(status_code=403, detail="Not authorized for this section")

    # 2. Fetch Students
    students = db.query(Student).filter(
        Student.section_id == section_id,
        Student.school_id == tenant.school_id,
        Student.is_active == True
    ).order_by(Student.roll_number, Student.first_name).all()
    
    return [
        {"id": s.id, "name": f"{s.first_name} {s.last_name}", "roll_number": s.roll_number, "photo_url": s.photo_url}
        for s in students
    ]

@router.post("/record", response_model=AttendanceSummary)
def record_attendance_bulk(
    payload: AttendanceBulkCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN, "school_admin")),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """
    Bulk upsert attendance records.
    Idempotent per (school, date, section, student).
    """
    # Set Audit Context
    set_actor_id(user.id)
    set_reason(f"Bulk Attendance Record: {payload.date} / Section {payload.section_id}")

    # 1. Access Check (Reuse roster logic or simplify)
    if user.role == Roles.TEACHER:
         # Find grade of this section
        gs = db.query(GradeSection).filter(GradeSection.section_id == payload.section_id, GradeSection.school_id == tenant.school_id).first()
        if not gs:
             raise HTTPException(status_code=404, detail="Section not found")
             
        has_access = db.query(TeacherAssignment).filter(
            TeacherAssignment.teacher_id == user.id,
            TeacherAssignment.school_id == tenant.school_id,
            (TeacherAssignment.section_id == payload.section_id) | 
            ((TeacherAssignment.grade_id == gs.grade_id) & (TeacherAssignment.section_id == None))
        ).first()
        if not has_access:
             raise HTTPException(status_code=403, detail="Not authorized")
        
        # If grade_id not provided, use from GS
        grade_id_to_use = gs.grade_id
    else:
        # Admin
        grade_id_to_use = payload.grade_id
        if not grade_id_to_use:
             # resolve
             gs = db.query(GradeSection).filter(GradeSection.section_id == payload.section_id).first()
             if gs: grade_id_to_use = gs.grade_id

    created_count = 0
    updated_count = 0
    
    for rec in payload.records:
        # Upsert Logic
        existing = db.query(Attendance).filter(
            Attendance.school_id == tenant.school_id,
            Attendance.date == payload.date,
            Attendance.section_id == payload.section_id,
            Attendance.student_id == rec.student_id
        ).first()
        
        if existing:
            # Update
            if existing.status != rec.status or existing.note != rec.note:
                existing.status = rec.status
                existing.note = rec.note
                existing.recorded_by_user_id = str(user.id)
                existing.updated_at = datetime.now(timezone.utc)
                updated_count += 1
        else:
            # Create
            new_rec = Attendance(
                id=str(uuid.uuid4()),
                school_id=str(tenant.school_id),
                student_id=rec.student_id,
                grade_id=grade_id_to_use,
                section_id=payload.section_id,
                date=payload.date,
                status=rec.status,
                note=rec.note,
                recorded_by_user_id=str(user.id)
            )
            db.add(new_rec)
            created_count += 1

    db.commit()
    return {"created": created_count, "updated": updated_count}

# --- STUDENT ENDPOINTS ---

@router.get("/student/me", response_model=StudentAttendanceStats)
def get_my_attendance_stats(
    range: Optional[str] = "term", # last30, term, year
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.STUDENT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """
    Read-only attendance stats for the calling student.
    """
    # Resolve Student
    student = db.query(Student).filter(
        Student.user_id == str(user.id),
        Student.school_id == tenant.school_id
    ).first()
    
    if not student:
         raise HTTPException(status_code=404, detail="Student profile not found")

    # Date Filter
    query = db.query(Attendance).filter(
        Attendance.student_id == student.id,
        Attendance.school_id == tenant.school_id
    )
    
    from datetime import timedelta
    today = datetime.now(timezone.utc).date()
    
    if range == "last30":
        start_date = today - timedelta(days=30)
        query = query.filter(Attendance.date >= start_date)
    # elif range == "term":
        # fetch current term start date... mocking for now or assuming start of year
        # start_date = ...
        # pass
    
    records = query.order_by(Attendance.date.asc()).all()
    
    total = len(records)
    present = sum(1 for r in records if r.status == AttendanceStatus.PRESENT or r.status == AttendanceStatus.LATE)
    absent = sum(1 for r in records if r.status == AttendanceStatus.ABSENT)
    late = sum(1 for r in records if r.status == AttendanceStatus.LATE)
    
    percent = round((present / total * 100), 1) if total > 0 else 0
    
    # Trend (Last 30 days regardless of range param for chart?)
    # Let's use records from query
    trend_data = [
        {"date": r.date, "status": r.status} 
        for r in records[-30:] # Last 30 entries
    ]
    
    # By Month
    # Not implemented efficiently here, placeholder
    by_month = []
    
    return {
        "summary": {
            "present": present,
            "absent": absent,
            "late": late,
            "excused": 0,
            "percent": percent
        },
        "trend": trend_data,
        "byMonth": by_month
    }

