from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_
from database import get_db
from auth.dependencies import Roles, require_roles
from schools.models import User
from students.models import ParentStudentLink, Student
from attendance.models import Attendance, AttendanceStatus
from academics.models import MarksEntry, ExamTerm
from finance.models import Fee
from communication.models import Notice, NoticeStudent, NoticeGrade, NoticeSection, NoticeRole
from typing import List
from pydantic import BaseModel
from audit.models import AuditLog
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/parent/dashboard", tags=["Parent Dashboard"])

class ParentDashboardSummary(BaseModel):
    student_id: str
    student_name: str
    attendance_percentage: float
    academic_trend: str # "UP", "DOWN", "STABLE", "N/A"
    fee_status: str # "ALL_PAID", "OVERDUE", "PENDING"
    active_notices: int

@router.get("/summary", response_model=List[ParentDashboardSummary])
def get_parent_dashboard_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.PARENT))
):
    # Get Linked Students
    links = db.query(ParentStudentLink).filter(
        ParentStudentLink.parent_id == user.id,
        ParentStudentLink.school_id == user.school_id
    ).all()

    student_ids = [link.student_id for link in links]
    if not student_ids:
        return []

    students = db.query(Student).filter(Student.id.in_(student_ids)).all()
    
    # Pulse Logging: Log Dashboard View
    try:
        audit_log = AuditLog(
            id=str(uuid.uuid4()),
            actor_id=str(user.id),
            action_type="VIEW",
            table_name="dashboard_summary",
            record_id=None,
            timestamp=datetime.now(timezone.utc),
            reason="Parent Dashboard Access",
            hidden_for_user_ids=None
        )
        db.add(audit_log)
        db.commit()
    except Exception as e:
        # Don't fail the request if logging fails, but log error
        print(f"Audit log failed: {e}")
        db.rollback()
        
    results = []

    for student in students:
        # 1. Attendance %
        total_days = db.query(func.count(Attendance.id)).filter(
            Attendance.student_id == student.id
        ).scalar()

        present_days = db.query(func.count(Attendance.id)).filter(
            Attendance.student_id == student.id,
            Attendance.status == AttendanceStatus.PRESENT
        ).scalar()

        attendance_pct = 0.0
        if total_days and total_days > 0:
            attendance_pct = round((present_days / total_days) * 100, 1)

        # 2. Academic Trend (Last 2 terms)
        # Get last 2 terms based on start_date
        terms = db.query(ExamTerm).filter(
            ExamTerm.school_id == user.school_id,
            ExamTerm.start_date.isnot(None)
        ).order_by(desc(ExamTerm.start_date)).limit(2).all()

        trend = "N/A"
        if len(terms) >= 2:
            current_term = terms[0]
            prev_term = terms[1]

            # Avg marks for current
            avg_curr = db.query(func.avg(MarksEntry.marks_obtained)).filter(
                MarksEntry.student_id == student.id,
                MarksEntry.exam_term_id == current_term.id,
                MarksEntry.is_published == True
            ).scalar()

            # Avg marks for prev
            avg_prev = db.query(func.avg(MarksEntry.marks_obtained)).filter(
                MarksEntry.student_id == student.id,
                MarksEntry.exam_term_id == prev_term.id,
                MarksEntry.is_published == True
            ).scalar()

            if avg_curr is not None and avg_prev is not None:
                if avg_curr > avg_prev:
                    trend = "UP"
                elif avg_curr < avg_prev:
                    trend = "DOWN"
                else:
                    trend = "STABLE"

        # 3. Fee Status
        overdue_fees = db.query(func.count(Fee.id)).filter(
            Fee.student_id == student.id,
            Fee.status == "pending",
            Fee.due_date < func.now()
        ).scalar()

        pending_fees = db.query(func.count(Fee.id)).filter(
            Fee.student_id == student.id,
            Fee.status == "pending"
        ).scalar()

        if overdue_fees > 0:
            fee_status = "OVERDUE"
        elif pending_fees > 0:
            fee_status = "PENDING"
        else:
            fee_status = "ALL_PAID"

        # 4. Active Notices
        notice_query = db.query(func.count(Notice.id)).filter(
            Notice.school_id == user.school_id
        )

        # Subqueries for targeting
        role_sub = db.query(NoticeRole.notice_id).filter(NoticeRole.role == Roles.PARENT)
        grade_sub = db.query(NoticeGrade.notice_id).filter(NoticeGrade.grade_id == student.grade_id)
        section_sub = db.query(NoticeSection.notice_id).filter(NoticeSection.section_id == student.section_id)
        student_sub = db.query(NoticeStudent.notice_id).filter(NoticeStudent.student_id == student.id)

        active_notices = notice_query.filter(
            or_(
                Notice.id.in_(role_sub),
                Notice.id.in_(grade_sub),
                Notice.id.in_(section_sub),
                Notice.id.in_(student_sub)
            )
        ).scalar()

        results.append(ParentDashboardSummary(
            student_id=student.id,
            student_name=f"{student.first_name} {student.last_name}",
            attendance_percentage=attendance_pct,
            academic_trend=trend,
            fee_status=fee_status,
            active_notices=active_notices
        ))

    return results
