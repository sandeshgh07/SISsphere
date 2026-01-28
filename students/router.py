from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from auth.dependencies import get_db, require_roles, TenantAccess, Roles
from academics import models as academic_models
from schools import models as school_models
from students import models as student_models
from audit.listeners import set_reason
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import enum
from sqlalchemy import or_
import uuid
import attendance.models
import finance.models
import communication.models as comm_models
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
    return results

class StudentAssignmentUpdate(BaseModel):
    grade_id: str
    section_id: str
    roll_number: Optional[str] = None
    admission_number: Optional[str] = None
    reason: Optional[str] = None

@router.patch("/{user_id}/assignment")
def update_student_assignment_by_user_id(
    user_id: str,
    update_data: StudentAssignmentUpdate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess)
):
    # Lookup Student by User ID (Identity link)
    student = db.query(student_models.Student).filter(
        student_models.Student.user_id == user_id,
        student_models.Student.school_id == str(tenant.school_id)
    ).first()

    if not student:
        # Fallback: maybe they passed student_id? 
        # But instructions say "PATCH /api/students/{user_id}/assignment".
        # If student record doesn't exist for a "Student" user (legacy data), we might need to create one? 
        # For now, 404.
        raise HTTPException(status_code=404, detail="Student profile not found for this user")

    # Validate Grade
    grade = db.query(academic_models.Grade).filter(
        academic_models.Grade.id == update_data.grade_id, 
        academic_models.Grade.school_id == tenant.school_id
    ).first()
    if not grade:
        raise HTTPException(status_code=400, detail="Invalid grade_id")

    # Validate Section
    section = db.query(academic_models.Section).filter(
        academic_models.Section.id == update_data.section_id, 
        academic_models.Section.school_id == tenant.school_id
    ).first()
    if not section:
        raise HTTPException(status_code=400, detail="Invalid section_id")

    # Audit / Reason
    old_grade = student.grade_id
    old_section = student.section_id
    
    if old_grade != update_data.grade_id or old_section != update_data.section_id:
        reason = update_data.reason or f"Assignment Change: {old_grade} -> {update_data.grade_id}"
        set_reason(reason)
        # We could also log specific "STUDENT_TRANSFERRED" event here explicitly if listeners don't catch it well enough.
        # Listeners usually catch table updates. 

    student.grade_id = update_data.grade_id
    student.section_id = update_data.section_id
    if update_data.roll_number:
        student.roll_number = update_data.roll_number
    
    db.commit()
    db.refresh(student)
    
    return {
        "message": "Assignment updated",
        "student_id": student.id,
        "new_grade_id": student.grade_id,
        "new_section_id": student.section_id
    }

# --- STUDENT DASHBOARD ---

class StudentDashboardOverview(BaseModel):
    student: dict
    today: dict
    attendance: dict
    academics: dict
    fees: dict
    notices: dict
    complaints: dict
    timeline: dict

@router.get("/overview", response_model=StudentDashboardOverview)
def get_student_dashboard_overview(
    db: Session = Depends(get_db),
    user = Depends(require_roles(Roles.STUDENT)), # Strict RBAC
    tenant: TenantAccess = Depends(TenantAccess)
):
    """
    aggregated endpoint for Student Dashboard.
    """
    
    # Link Identity -> Student Record
    student = db.query(student_models.Student).filter(
        student_models.Student.user_id == str(user.id),
        student_models.Student.school_id == str(tenant.school_id)
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    # 2. Student Details
    grade_name = "N/A"
    section_name = "N/A"
    if student.grade_id:
        g = db.query(academic_models.Grade).get(student.grade_id)
        if g: grade_name = g.name
    if student.section_id:
        s = db.query(academic_models.Section).get(student.section_id)
        if s: section_name = s.name

    student_data = {
        "id": student.id,
        "name": f"{student.first_name} {student.last_name}",
        "grade": grade_name,
        "section": section_name,
        "photo_url": student.photo_url
    }

    # 3. Attendance (Last 30 Days)
    from datetime import timedelta
    thirty_days_ago = datetime.now(timezone.utc).date() - timedelta(days=30)
    
    attendance_records = db.query(attendance.models.Attendance).filter(
        attendance.models.Attendance.student_id == student.id,
        attendance.models.Attendance.date >= thirty_days_ago
    ).all()
    
    present = 0
    absent = 0
    late = 0
    for rec in attendance_records:
        if rec.status == attendance.models.AttendanceStatus.PRESENT:
            present += 1
        elif rec.status == attendance.models.AttendanceStatus.ABSENT:
            absent += 1
        elif rec.status == attendance.models.AttendanceStatus.LATE:
            late += 1
            present += 1 

    total_recs = len(attendance_records)
    present_count = present # already includes late if we counted it
    percent = 0
    if total_recs > 0:
        percent = round((present_count / total_recs) * 100, 1)

    attendance_data = {
        "last30": {
            "present": present,
            "absent": absent,
            "late": late,
            "percent": percent
        },
        "thisTermPercent": percent, # Placeholder
        "streak": {"daysPresent": 0} 
    }

    # 4. Fees (Due Amount)
    invoices = db.query(finance.models.StudentInvoice).filter(
        finance.models.StudentInvoice.student_id == student.id,
        finance.models.StudentInvoice.status.notin_([
            finance.models.StudentInvoiceStatus.PAID,
            finance.models.StudentInvoiceStatus.VOID
        ])
    ).all()
    
    due_amount = sum(inv.balance for inv in invoices)
    due_count = len(invoices)
    
    fees_data = {
        "dueAmount": float(due_amount),
        "dueCount": due_count,
        "nextDueDate": None 
    }

    # 5. Notices (Critical & Recent)
    # Critical
    critical_notices = db.query(comm_models.Notice).filter(
        comm_models.Notice.school_id == str(tenant.school_id),
        comm_models.Notice.priority == comm_models.NoticePriority.CRITICAL
    ).order_by(comm_models.Notice.created_at.desc()).limit(2).all()
    
    # Recent (Normal)
    recent_notices = db.query(comm_models.Notice).filter(
        comm_models.Notice.school_id == str(tenant.school_id),
        comm_models.Notice.priority != comm_models.NoticePriority.CRITICAL
    ).order_by(comm_models.Notice.created_at.desc()).limit(5).all()

    notices_data = {
        "critical": [
            {"id": n.id, "title": n.title, "posted_at": n.created_at, "priority": "critical"} 
            for n in critical_notices
        ],
        "recent": [
            {"id": n.id, "title": n.title, "posted_at": n.created_at, "priority": "normal"} 
            for n in recent_notices
        ]
    }

    # 6. Complaints
    my_complaints = db.query(comm_models.Complaint).filter(
        comm_models.Complaint.created_by_id == str(user.id)
    ).order_by(comm_models.Complaint.updated_at.desc()).all()
    
    open_count = sum(1 for c in my_complaints if c.status not in [comm_models.ComplaintStatus.RESOLVED, comm_models.ComplaintStatus.CLOSED])
    
    complaints_data = {
        "openCount": open_count,
        "myRecent": [
            {"id": c.id, "title": c.title, "status": c.status, "updated_at": c.updated_at}
            for c in my_complaints[:3]
        ]
    }

    # 7. Mock Data (Today, Academics, Timeline)
    today_data = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "periods": [
            {"time": "09:00", "subject": "Mathematics", "teacher": "Mr. Smith", "room": "101"},
            {"time": "10:00", "subject": "Physics", "teacher": "Ms. Doe", "room": "Lab 2"},
        ],
        "next_class": {"subject": "Mathematics", "time": "09:00"}
    }
    
    academics_data = {
        "gpa": {"current": 3.8, "trend": [3.5, 3.6, 3.8]},
        "subjects": [
            {"name": "Mathematics", "progress": 85, "grade": "A"},
            {"name": "Physics", "progress": 78, "grade": "B+"},
            {"name": "English", "progress": 92, "grade": "A+"}
        ],
        "missingSubmissions": 1
    }
    
    timeline_data = {
        "academic_year": "2025-2026",
        "term": "First Term",
        "upcoming": [
            {"type": "EXAM", "title": "Mid-term Exams", "date": "2026-03-15"},
            {"type": "EVENT", "title": "Science Fair", "date": "2026-04-10"}
        ]
    }

    return StudentDashboardOverview(
        student=student_data,
        today=today_data,
        attendance=attendance_data,
        academics=academics_data,
        fees=fees_data,
        notices=notices_data,
        complaints=complaints_data,
        timeline=timeline_data
    )

# --- STUDENT 360 (STAFF ONLY) ---

from students.schemas_360 import IncidentCreate, IncidentUpdate, IncidentResponse, DocumentCreate, DocumentResponse, Student360Overview
from fastapi.responses import StreamingResponse
import io

def check_360_access(user, student, db, tenant):
    """
    Enforce RBAC for Student 360.
    - Teachers: Must be assigned to student's grade/section.
    - Admins: School scoped.
    - Students: BLOCKED.
    """
    if user.role == Roles.STUDENT or user.role == Roles.PARENT:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if user.role == Roles.TEACHER:
        # Check Grade Access
        assignment = db.query(academic_models.TeacherAssignment).filter(
            academic_models.TeacherAssignment.teacher_id == user.id,
            academic_models.TeacherAssignment.school_id == tenant.school_id,
            academic_models.TeacherAssignment.grade_id == student.grade_id
        ).first()
        
        # If section specific assignment exists, check section
        if assignment and assignment.section_id:
             if assignment.section_id != student.section_id:
                  raise HTTPException(status_code=403, detail="Teacher not assigned to this student's section")
        
        if not assignment:
             # Check if they have class teacher role or subject teacher role?
             # Requirement says "Teacher can view Student 360 ONLY for students in grades they are mapped to."
             # Assuming purely Grade/Section mapping for now.
             raise HTTPException(status_code=403, detail="Teacher not assigned to this student's grade")

@router.post("/{student_id}/incidents", response_model=IncidentResponse)
def report_incident(
    student_id: str,
    incident: IncidentCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SCHOOL_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    student = db.query(student_models.Student).filter(student_models.Student.id == student_id, student_models.Student.school_id == str(tenant.school_id)).first()
    if not student: raise HTTPException(status_code=404, detail="Student not found")
    
    check_360_access(user, student, db, tenant)
    
    new_incident = student_models.BehaviorIncident(
        school_id=str(tenant.school_id),
        student_id=student_id,
        reported_by_user_id=user.id,
        incident_type=incident.incident_type,
        severity=incident.severity,
        title=incident.title,
        description=incident.description,
        occurred_at=incident.occurred_at,
        action_taken=incident.action_taken
    )
    db.add(new_incident)
    db.commit()
    db.refresh(new_incident)
    return new_incident

@router.get("/{student_id}/incidents", response_model=List[IncidentResponse])
def list_incidents(
    student_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SCHOOL_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    student = db.query(student_models.Student).filter(student_models.Student.id == student_id, student_models.Student.school_id == str(tenant.school_id)).first()
    if not student: raise HTTPException(status_code=404, detail="Student not found")
    check_360_access(user, student, db, tenant)
    
    return db.query(student_models.BehaviorIncident).filter(
        student_models.BehaviorIncident.student_id == student_id,
        student_models.BehaviorIncident.school_id == str(tenant.school_id)
    ).order_by(student_models.BehaviorIncident.occurred_at.desc()).all()


@router.get("/{student_id}/overview_360", response_model=Student360Overview)
def get_student_360_overview(
    student_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SCHOOL_ADMIN, Roles.ACCOUNTANT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    student = db.query(student_models.Student).filter(student_models.Student.id == student_id, student_models.Student.school_id == str(tenant.school_id)).first()
    if not student: raise HTTPException(status_code=404, detail="Student not found")
    check_360_access(user, student, db, tenant)

    # 1. Student Basic
    grade_name = "N/A"
    section_name = "N/A"
    
    # Resolve Grade Name
    if student.grade_id:
        from academics.models import Grade
        grade_obj = db.query(Grade).filter(Grade.id == student.grade_id).first()
        if grade_obj:
            grade_name = grade_obj.name
            
    # Resolve Section Name
    if student.section_id:
        from academics.models import Section
        section_obj = db.query(Section).filter(Section.id == student.section_id).first()
        if section_obj:
            section_name = section_obj.name

    student_info = {
        "id": student.id,
        "name": f"{student.first_name} {student.last_name}",
        "grade": grade_name,
        "section": section_name,
        "roll_no": student.roll_number,
        "photo_url": student.photo_url
    }
    
    # 2. Guardians
    links = db.query(student_models.ParentStudentLink).filter(student_models.ParentStudentLink.student_id == student.id).all()
    guardians = []
    for link in links:
        parent = db.query(school_models.User).get(link.parent_id)
        if parent:
            guardians.append({
                "name": f"{parent.first_name} {parent.last_name}",
                "email": parent.email,
                "phone": parent.phone_number,
                "is_primary": link.is_authorized_pickup
            })

    # 3. Attendance
    # Simple summary
    attendance_recs = db.query(attendance.models.Attendance).filter(
        attendance.models.Attendance.student_id == student.id
    ).all()
    present = sum(1 for r in attendance_recs if r.status == "PRESENT")
    total = len(attendance_recs)
    att_rate = round(present/total * 100, 1) if total > 0 else 0
    att_data = {
        "term_rate": att_rate,
        "last30_rate": att_rate, # Placeholder logic
        "trend_last30": [] # Populate if needed
    }
    
    # 4. Assessments
    assessments = {
        "upcoming": [],
        "trend_by_subject": []
    }
    
    # 5. Risk
    risk_alerts = db.query(student_models.StudentRiskAlert).filter(
        student_models.StudentRiskAlert.student_id == student.id,
        student_models.StudentRiskAlert.is_resolved == False
    ).all()
    risk_level = "LOW"
    if any(r.severity == "HIGH" for r in risk_alerts): risk_level = "HIGH"
    elif any(r.severity == "MEDIUM" for r in risk_alerts): risk_level = "MEDIUM"
    
    risk_data = {
        "level": risk_level,
        "reasons": [r.type for r in risk_alerts],
        "subjects_at_risk": []
    }
    
    # 6. Incidents
    incidents = db.query(student_models.BehaviorIncident).filter(
        student_models.BehaviorIncident.student_id == student.id
    ).all()
    incidents_summary = {
        "open_count": sum(1 for i in incidents if i.status == "open"),
        "resolved_count": sum(1 for i in incidents if i.status != "open"),
        "recent": [] # Populate details in separate list endpoint
    }
    
    # 7. Complaints (Confidentiality Masking)
    complaints_summary = {"open_count": 0, "masked_count": 0, "recent": []}
    if user.role in [Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SCHOOL_ADMIN]:
        # Fetch complaints about student or from student? Usually Profile shows complaints "Related to Student"
        # Since implementation plan said "complaints visibility", I assume complaints linked to student.
        pass
        
    # 8. Fees (RBAC)
    fees_summary = None
    if user.role in [Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SCHOOL_ADMIN, Roles.ACCOUNTANT]:
        # Calculate fees
        invoices = db.query(finance.models.StudentInvoice).filter(finance.models.StudentInvoice.student_id == student.id).all()
        outstanding = sum(inv.balance for inv in invoices if inv.status not in ["PAID", "VOID"])
        fees_summary = {
            "outstanding_balance": outstanding,
            "status": "OVERDUE" if outstanding > 0 else "CLEAR",
            "last_payment_date": None
        }

    # 9. Documents
    docs = db.query(student_models.StudentDocument).filter(student_models.StudentDocument.student_id == student.id).all()
    doc_list = [DocumentResponse.from_orm(d) for d in docs]

    return Student360Overview(
        student=student_info,
        guardians=guardians,
        attendance=att_data,
        assessments=assessments,
        risk=risk_data,
        incidents_summary=incidents_summary,
        complaints_summary=complaints_summary,
        fees_summary=fees_summary,
        documents=doc_list
    )

@router.get("/{student_id}/report.pdf")
def export_student_report(
    student_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SCHOOL_ADMIN, Roles.ACCOUNTANT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    student = db.query(student_models.Student).filter(student_models.Student.id == student_id, student_models.Student.school_id == str(tenant.school_id)).first()
    if not student: raise HTTPException(status_code=404, detail="Student not found")
    check_360_access(user, student, db, tenant)

    # Use ReportLab to generate PDF
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
    except ImportError:
        # Fallback or error
        raise HTTPException(status_code=500, detail="PDF generation library missing")

    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Header
    p.setFont("Helvetica-Bold", 16)
    p.drawString(50, height - 50, f"Student 360 Report: {student.first_name} {student.last_name}")
    p.setFont("Helvetica", 10)
    
    # Resolve School Name
    school_name = tenant.school_id
    if tenant.school_id:
        try:
            import uuid
            # Convert string ID to UUID object for SQLAlchemy
            s_uuid = uuid.UUID(tenant.school_id)
            from schools.models import School
            school_obj = db.query(School).get(s_uuid)
            if school_obj:
                school_name = school_obj.name
        except Exception as e:
            # Fallback for any conversion/query error
            print(f"Error fetching school name: {e}")
            pass

    p.drawString(50, height - 70, f"School: {school_name}")
    p.drawString(50, height - 85, f"Date: {datetime.now().strftime('%Y-%m-%d')}")
    p.drawString(50, height - 100, f"Generated By: {user.email}")
    
    # Content sections (Simulated)
    y = height - 140
    p.setFont("Helvetica-Bold", 12)
    p.drawString(50, y, "Academic Summary")
    y -= 20
    p.setFont("Helvetica", 10)
    p.setFont("Helvetica", 10)
    
    # Resolve names
    grade_name = student.grade_id or 'N/A'
    if student.grade_id:
        from academics.models import Grade
        g = db.query(Grade).get(student.grade_id)
        if g: grade_name = g.name

    section_name = student.section_id or 'N/A'
    if student.section_id:
        from academics.models import Section
        s = db.query(Section).get(student.section_id)
        if s: section_name = s.name

    p.drawString(50, y, f"Grade: {grade_name}   Section: {section_name}")
    y -= 40
    
    p.setFont("Helvetica-Bold", 12)
    p.drawString(50, y, "Behavior & Incidents")
    y -= 20
    p.setFont("Helvetica", 10)
    # Fetch incidents count
    inc_count = db.query(student_models.BehaviorIncident).filter(student_models.BehaviorIncident.student_id == student_id).count()
    p.drawString(50, y, f"Total Incidents: {inc_count}")
    y -= 40
    
    if user.role in [Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.ACCOUNTANT]:
        p.setFont("Helvetica-Bold", 12)
        p.drawString(50, y, "Financial Status")
        y -= 20
        p.setFont("Helvetica", 10)
        p.drawString(50, y, "Confidential Financial Data included.")
        y -= 40

    p.showPage()
    p.save()
    
    buffer.seek(0)
    return StreamingResponse(
        buffer, 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"attachment; filename=student_report_{student.roll_number}.pdf"}
    )

