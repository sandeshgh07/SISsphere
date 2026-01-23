from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, aliased
from sqlalchemy import func, extract, case
from typing import List, Optional, Dict
from datetime import date
from pydantic import BaseModel

from database import SessionLocal
from auth.dependencies import get_db, get_current_active_user, require_roles, Roles, TenantAccess
from attendance.models import Attendance, AttendanceStatus
from students.models import Student, ParentStudentLink
from academics.models import TeacherAssignment
from schools.models import User

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"],
    responses={404: {"description": "Not found"}},
)

class AttendanceCreate(BaseModel):
    student_id: str
    grade_id: str
    section_id: str
    status: AttendanceStatus
    date: date

class AttendanceResponse(BaseModel):
    id: str
    student_id: str
    grade_id: str
    section_id: str
    status: AttendanceStatus
    date: date
    school_id: str

    class Config:
        from_attributes = True

class AttendanceStats(BaseModel):
    student_id: str
    present_count: int
    total_days: int
    percentage: float

class ClassAttendanceStats(BaseModel):
    date: date
    present_percentage: float

class AttendanceTrend(BaseModel):
    month: str
    percentage: float

@router.post("/", response_model=AttendanceResponse)
def mark_attendance(
    attendance_data: AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.TEACHER, Roles.SUPER_USER, Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant_access: TenantAccess = Depends(TenantAccess)
):
    # If teacher, verify assignment
    if current_user.role == Roles.TEACHER:
        assignment = db.query(TeacherAssignment).filter(
            TeacherAssignment.teacher_id == current_user.id,
            TeacherAssignment.grade_id == attendance_data.grade_id,
            TeacherAssignment.section_id == attendance_data.section_id,
            TeacherAssignment.school_id == tenant_access.school_id
        ).first()

        if not assignment:
             raise HTTPException(status_code=403, detail="Not assigned to this Grade/Section")

    # Check if student belongs to school and grade/section
    student = db.query(Student).filter(
        Student.id == attendance_data.student_id,
        Student.school_id == tenant_access.school_id
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if not student.is_active:
        raise HTTPException(status_code=400, detail="Cannot mark attendance for inactive student")

    if student.grade_id != attendance_data.grade_id or student.section_id != attendance_data.section_id:
         raise HTTPException(status_code=400, detail="Student does not belong to the specified Grade/Section")

    # Check if attendance already exists for this day
    existing = db.query(Attendance).filter(
        Attendance.student_id == attendance_data.student_id,
        Attendance.date == attendance_data.date,
        Attendance.school_id == tenant_access.school_id
    ).first()

    if existing:
        existing.status = attendance_data.status
        # Update other fields if necessary
        db.commit()
        db.refresh(existing)

        # Trigger notification if updated to ABSENT
        if existing.status == AttendanceStatus.ABSENT:
            # Hook for SMS/Push
            # Fetch parents
            parents = db.query(User).join(ParentStudentLink, ParentStudentLink.parent_id == User.id).filter(
                ParentStudentLink.student_id == existing.student_id,
                ParentStudentLink.school_id == tenant_access.school_id
            ).all()
            parent_ids = [p.id for p in parents]
            student_name = f"{student.first_name} {student.last_name}"

            print(f"[NOTIFICATION HOOK] Student {student_name} (ID: {existing.student_id}) marked ABSENT (Update). Triggering SMS to parents: {parent_ids}")

        return existing

    new_attendance = Attendance(
        student_id=attendance_data.student_id,
        grade_id=attendance_data.grade_id,
        section_id=attendance_data.section_id,
        status=attendance_data.status,
        date=attendance_data.date,
        school_id=tenant_access.school_id
    )
    db.add(new_attendance)
    db.commit()
    db.refresh(new_attendance)

    # Notification Trigger for ABSENT
    if new_attendance.status == AttendanceStatus.ABSENT:
        # Hook for SMS/Push
        # Fetch parents
        parents = db.query(User).join(ParentStudentLink, ParentStudentLink.parent_id == User.id).filter(
            ParentStudentLink.student_id == new_attendance.student_id,
            ParentStudentLink.school_id == tenant_access.school_id
        ).all()
        parent_ids = [p.id for p in parents]
        student_name = f"{student.first_name} {student.last_name}"

        print(f"[NOTIFICATION HOOK] Student {student_name} (ID: {new_attendance.student_id}) marked ABSENT. Triggering SMS to parents: {parent_ids}")

    return new_attendance

@router.get("/my-history", response_model=List[AttendanceResponse])
def get_my_history(
    student_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.STUDENT, Roles.PARENT)),
    tenant_access: TenantAccess = Depends(TenantAccess)
):
    target_student_id = None
    if current_user.role == Roles.STUDENT:
        # Assuming current_user is linked to a student profile somehow?
        # Typically User -> Student might be 1:1 or User is the Student.
        # But here User table is separate. Let's assume User has email matching Student or there's a link.
        # For simplicity, if role is STUDENT, we might need a way to find their student_id.
        # Given existing models don't show User->Student link directly in User,
        # but Student has email.
        student = db.query(Student).filter(Student.email == current_user.email, Student.school_id == tenant_access.school_id).first()
        if not student:
             raise HTTPException(status_code=404, detail="Student profile not found for user")
        target_student_id = student.id
    elif current_user.role == Roles.PARENT:
        if not student_id:
            raise HTTPException(status_code=400, detail="student_id required for Parent")
        # Verify parent link
        link = db.query(ParentStudentLink).filter(
            ParentStudentLink.parent_id == current_user.id,
            ParentStudentLink.student_id == student_id,
            ParentStudentLink.school_id == tenant_access.school_id
        ).first()
        if not link:
             raise HTTPException(status_code=403, detail="Not authorized for this student")
        target_student_id = student_id

    history = db.query(Attendance).filter(
        Attendance.student_id == target_student_id,
        Attendance.school_id == tenant_access.school_id
    ).order_by(Attendance.date.desc()).all()

    return history

@router.get("/stats", response_model=ClassAttendanceStats)
def get_class_stats(
    grade_id: str,
    section_id: str,
    date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.PARENT, Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant_access: TenantAccess = Depends(TenantAccess)
):
    # Parents can see class percentage, but NOT individual attendance.
    # We verify if parent has a child in this grade/section?
    # The rule says: "Parents can see the class attendance percentage"
    # It implies checking if they have access.
    # For simplicity, if they are a PARENT in the school, we allow seeing stats (low risk).
    # Or stricter: check if they have a child in that class.

    if current_user.role == Roles.PARENT:
         # Check linkage
         # Find any child in this grade/section
         child_in_class = db.query(Student).join(ParentStudentLink).filter(
             ParentStudentLink.parent_id == current_user.id,
             Student.grade_id == grade_id,
             Student.section_id == section_id,
             Student.school_id == tenant_access.school_id
         ).first()
         if not child_in_class:
              raise HTTPException(status_code=403, detail="No child in this class")

    total_attendance = db.query(Attendance).filter(
        Attendance.grade_id == grade_id,
        Attendance.section_id == section_id,
        Attendance.date == date,
        Attendance.school_id == tenant_access.school_id
    ).count()

    if total_attendance == 0:
        return {"date": date, "present_percentage": 0.0}

    present_count = db.query(Attendance).filter(
        Attendance.grade_id == grade_id,
        Attendance.section_id == section_id,
        Attendance.date == date,
        Attendance.status == AttendanceStatus.PRESENT,
        Attendance.school_id == tenant_access.school_id
    ).count()

    percentage = (present_count / total_attendance) * 100
    return {"date": date, "present_percentage": round(percentage, 2)}

@router.get("/trends", response_model=List[AttendanceTrend])
def get_attendance_trends(
    student_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.STUDENT, Roles.PARENT, Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant_access: TenantAccess = Depends(TenantAccess)
):
    target_student_id = None
    if current_user.role == Roles.STUDENT:
        student = db.query(Student).filter(Student.email == current_user.email, Student.school_id == tenant_access.school_id).first()
        if not student:
             raise HTTPException(status_code=404, detail="Student profile not found")
        target_student_id = student.id
    elif current_user.role == Roles.PARENT:
        if not student_id:
            raise HTTPException(status_code=400, detail="student_id required")
        link = db.query(ParentStudentLink).filter(
            ParentStudentLink.parent_id == current_user.id,
            ParentStudentLink.student_id == student_id,
            ParentStudentLink.school_id == tenant_access.school_id
        ).first()
        if not link:
             raise HTTPException(status_code=403, detail="Not authorized")
        target_student_id = student_id
    elif current_user.role == Roles.TEACHER:
        if not student_id:
            raise HTTPException(status_code=400, detail="student_id required")
        # Verify assignment (Assuming if teacher is assigned to student's grade/section they can see trends)
        student = db.query(Student).filter(Student.id == student_id, Student.school_id == tenant_access.school_id).first()
        if not student:
             raise HTTPException(status_code=404, detail="Student not found")

        assignment = db.query(TeacherAssignment).filter(
            TeacherAssignment.teacher_id == current_user.id,
            TeacherAssignment.grade_id == student.grade_id,
            TeacherAssignment.school_id == tenant_access.school_id
        ).all()
        # Simplified check: if assigned to grade/section
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

    # Calculate trends: Group by Month
    # SQLite strftime('%Y-%m', date)

    # We need total days and present days per month
    results = db.query(
        func.strftime('%Y-%m', Attendance.date).label('month'),
        func.count(Attendance.id).label('total'),
        func.sum(case((Attendance.status == AttendanceStatus.PRESENT, 1), else_=0)).label('present')
    ).filter(
        Attendance.student_id == target_student_id,
        Attendance.school_id == tenant_access.school_id
    ).group_by('month').order_by('month').all()

    trends = []
    for r in results:
        percentage = (r.present / r.total * 100) if r.total > 0 else 0
        trends.append(AttendanceTrend(month=r.month, percentage=round(percentage, 2)))

    return trends
