from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_
from database import get_db
from schools.models import User, School
from academics.models import AcademicYear, Term
from communication.models import Complaint, Notice
from audit.models import AuditLog
from students.models import GateLog, Student
from auth.dependencies import get_current_active_user, Roles
from typing import List, Optional
import datetime

router = APIRouter()

@router.get("/me/overview")
def get_account_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    school_id = str(current_user.school_id)
    user_id = str(current_user.id)
    role = current_user.role

    # 1. User & School Identity
    user_data = {
        "id": user_id,
        "name": f"{current_user.first_name} {current_user.last_name}" if hasattr(current_user, 'first_name') else current_user.email, # Fallback if first_name/last_name missing on User model (User table usually has them or linking to Student/Employee) -> User model usually just has email/hashed_password? 
        # Checking User model... actually User usually links to a Profile. Let's assume standard User fields or fallback.
        # Ideally we fetch from linked Student/Employee/Parent profile if possible, but User table might have 'full_name' or we use email.
        # Let's stick to safe attributes.
        "role": role,
        "email": current_user.email
    }
    
    # Check if User model has first_name/last_name directly or if we need to fetch profile
    # For now, let's assume we can get a display name.
    # If the User model doesn't have it, we might return just email as name.
    display_name = current_user.email
    if hasattr(current_user, "full_name") and current_user.full_name:
        display_name = current_user.full_name
    elif hasattr(current_user, "first_name") and current_user.first_name:
         display_name = f"{current_user.first_name} {current_user.last_name}"
    
    user_data["name"] = display_name

    school_data = {}
    if current_user.school:
        school_data = {
            "id": current_user.school.id,
            "name": current_user.school.name,
            "logo_url": current_user.school.logo_url
        }

    # 2. Academics KPI (Active Year/Term)
    academics_data = {
        "active_year": None,
        "active_term": None
    }
    if school_id:
        active_year = db.query(AcademicYear).filter(
            AcademicYear.school_id == school_id,
            AcademicYear.is_active == True
        ).first()
        
        if active_year:
            academics_data["active_year"] = active_year.name
            
            # Find active term by DATE
            today = datetime.date.today()
            active_term = db.query(Term).filter(
                Term.academic_year_id == active_year.id,
                Term.start_date <= today,
                Term.end_date >= today
            ).first()
            
            if active_term:
                academics_data["active_term"] = active_term.name

    # 3. Counts (Pending Items)
    counts = {
        "assigned_complaints": 0,
        "pending_approvals": 0, # Placeholder
        "unread_notices": 0,
        "acknowledgements_required": 0
    }

    if school_id:
        # Complaints (Assignee)
        complaint_query = db.query(func.count(Complaint.id)).filter(
             Complaint.school_id == school_id,
             Complaint.status.in_(["OPEN", "IN_PROGRESS"])
        )
        if role in [Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.SUPER_ADMIN]:
             counts["assigned_complaints"] = complaint_query.scalar()
        else:
             try:
                 counts["assigned_complaints"] = complaint_query.filter(
                     Complaint.assigned_to_user_id == str(user_id)
                 ).scalar()
             except:
                 pass

        # Notices (Active)
        now = datetime.datetime.now(datetime.timezone.utc)
        notice_query = db.query(func.count(Notice.id)).filter(
            Notice.school_id == school_id,
            or_(Notice.expires_at == None, Notice.expires_at > now),
            or_(Notice.scheduled_at == None, Notice.scheduled_at <= now)
        )
        counts["unread_notices"] = notice_query.scalar()

    # 4. Recent Activity (Audit Logs)
    recent_activity = []
    if school_id:
        try:
            logs = db.query(AuditLog).filter(
                AuditLog.school_id == school_id,
                AuditLog.actor_id == str(user_id)
            ).order_by(desc(AuditLog.timestamp)).limit(10).all()
            
            for log in logs:
                summary = log.reason or "No details"
                recent_activity.append({
                    "id": log.id,
                    "action": log.action_type,
                    "entity_type": log.table_name,
                    "summary": summary,
                    "timestamp": log.timestamp,
                    "module": "System"
                })
        except Exception as e:
            print(f"Audit Log Error: {e}")

    # 5. Gate Pass (Recent Events)
    gate_pass_data = { "recent_events": [] }
    if school_id:
        try:
             # Fetch logs scanned BY this user OR FOR this user (if student) from 'students' module
             pass_logs = db.query(GateLog).filter(
                 GateLog.school_id == school_id,
                 or_(GateLog.scanned_by_id == str(user_id), GateLog.student_id == str(user_id))
             ).order_by(desc(GateLog.timestamp)).limit(3).all()

             for gl in pass_logs:
                 # Fetch student name (lazy load or explicit)
                 student_name = "Unknown"
                 student = db.query(Student).filter(Student.id == gl.student_id).first()
                 if student:
                     student_name = f"{student.first_name} {student.last_name}"

                 gate_pass_data["recent_events"].append({
                     "id": gl.id,
                     "student_name": student_name,
                     "reason": gl.type, # GateLog has 'type' (CHECKIN/CHECKOUT)
                     "status": "VALID", # Gate logs imply valid scan usually
                     "created_at": gl.timestamp
                 })
        except Exception as e:
             print(f"Gate pass fetch error: {e}")
             pass

    return {
        "user": user_data,
        "school": school_data,
        "academics": academics_data,
        "counts": counts,
        "recent_activity": recent_activity,
        "gate_pass": gate_pass_data
    }
