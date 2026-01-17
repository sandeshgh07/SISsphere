from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from auth.dependencies import Roles, require_roles, TenantAccess
from schools.models import User
from students.models import Student
from finance.models import Invoice
from attendance.models import Attendance, AttendanceStatus
from communication.models import Complaint, ComplaintStatus
from pydantic import BaseModel

router = APIRouter(prefix="/api/board", tags=["Board Analytics"])

class BoardAnalytics(BaseModel):
    total_enrollment: int
    revenue_velocity: float # %
    avg_complaint_resolution_hours: float
    reputation_index: float

@router.get("/analytics", response_model=BoardAnalytics)
def get_board_analytics(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.BOARD, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    # 1. Total Enrollment
    enrollment = db.query(func.count(Student.id)).filter(
        Student.school_id == tenant.school_id,
        Student.is_active == True
    ).scalar() or 0

    # 2. Revenue Velocity (Collection Rate)
    # Total Paid / Total Invoiced (of invoices that are not cancelled?)
    # Using Invoice.total_amount vs Invoice.amount_paid

    total_invoiced = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.school_id == tenant.school_id,
        Invoice.status != "CANCELLED"
    ).scalar() or 0.0

    total_collected = db.query(func.sum(Invoice.amount_paid)).filter(
        Invoice.school_id == tenant.school_id,
        Invoice.status != "CANCELLED"
    ).scalar() or 0.0

    velocity = 0.0
    if total_invoiced > 0:
        velocity = (total_collected / total_invoiced) * 100

    # 3. Avg Complaint Resolution Time
    resolved_complaints = db.query(Complaint.created_at, Complaint.resolved_at).filter(
        Complaint.school_id == tenant.school_id,
        Complaint.status == ComplaintStatus.RESOLVED,
        Complaint.resolved_at.isnot(None)
    ).all()

    total_hours = 0.0
    count = 0
    for c in resolved_complaints:
        if c.created_at and c.resolved_at:
            delta = c.resolved_at - c.created_at
            total_hours += delta.total_seconds() / 3600
            count += 1

    avg_resolution = 0.0
    if count > 0:
        avg_resolution = total_hours / count

    # 4. Reputation Index
    # (Attendance % + Fee Collection %) / 2

    # Attendance %
    total_att = db.query(func.count(Attendance.id)).filter(
        Attendance.school_id == tenant.school_id
    ).scalar() or 0

    present_att = db.query(func.count(Attendance.id)).filter(
        Attendance.school_id == tenant.school_id,
        Attendance.status == AttendanceStatus.PRESENT
    ).scalar() or 0

    att_rate = 0.0
    if total_att > 0:
        att_rate = (present_att / total_att) * 100

    reputation = (att_rate + velocity) / 2

    return BoardAnalytics(
        total_enrollment=enrollment,
        revenue_velocity=round(velocity, 2),
        avg_complaint_resolution_hours=round(avg_resolution, 2),
        reputation_index=round(reputation, 2)
    )
