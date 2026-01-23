from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from auth.dependencies import get_db, require_roles, Roles
from schools import models as school_models
from schools.schemas import SchoolOut, SchoolCreate
from schools.store import school_store
from pydantic import BaseModel
from schools.constants import SubscriptionTier
from audit.listeners import set_reason
from audit.models import AuditLog
from students.models import Student
from typing import Dict
from datetime import datetime, timedelta

router = APIRouter(prefix="/superadmin", tags=["admin"])

class AuditLogOut(BaseModel):
    id: str
    actor_id: str | None
    action_type: str
    table_name: str
    record_id: str | None
    before_state: str | None
    after_state: str | None
    trace_id: str | None
    timestamp: datetime
    reason: str | None

    class Config:
        from_attributes = True

class SchoolTierUpdate(BaseModel):
    tier: SubscriptionTier

class ExtendSubscriptionRequest(BaseModel):
    days: int

class StatsResponse(BaseModel):
    total_schools: int
    active_schools: int
    total_users: int
    total_students: int
    total_teachers: int
    tier_distribution: Dict[str, int]

@router.get("/schools", response_model=List[SchoolOut])
def admin_list_schools(
    db: Session = Depends(get_db),
    user = Depends(require_roles(Roles.SUPER_ADMIN))
):
    """
    List all schools for SuperAdmin.
    """
    return db.query(school_models.School).all()

@router.patch("/schools/{school_id}/tier")
def update_school_tier(
    school_id: str,
    tier_update: SchoolTierUpdate,
    db: Session = Depends(get_db),
    user = Depends(require_roles(Roles.SUPER_ADMIN))
):
    school = db.query(school_models.School).filter(school_models.School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    set_reason(f"System Override: Tier Update to {tier_update.tier}")
    school.subscription_tier = tier_update.tier
    db.commit()
    db.refresh(school)
    return {"message": "School tier updated", "id": school.id, "new_tier": school.subscription_tier}

@router.patch("/schools/{school_id}/activate")
def activate_school(
    school_id: str,
    db: Session = Depends(get_db),
    user = Depends(require_roles(Roles.SUPER_ADMIN))
):
    school = db.query(school_models.School).filter(school_models.School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    set_reason("System Override: School Activation")
    school.is_active = True
    db.commit()
    db.refresh(school)
    return {"message": "School activated", "id": school.id}

@router.patch("/schools/{school_id}/deactivate")
def deactivate_school(
    school_id: str,
    db: Session = Depends(get_db),
    user = Depends(require_roles(Roles.SUPER_ADMIN))
):
    school = db.query(school_models.School).filter(school_models.School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    set_reason("System Override: School Deactivation")
    school.is_active = False
    db.commit()
    db.refresh(school)
    return {"message": "School deactivated", "id": school.id}

@router.post("/schools/{school_id}/toggle-active")
def toggle_school_active(
    school_id: str,
    db: Session = Depends(get_db),
    user = Depends(require_roles(Roles.SUPER_ADMIN))
):
    """
    Manual Toggle: Freeze/Unfreeze a school without changing subscription.
    """
    try:
        school_uuid = uuid.UUID(school_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid school ID format")

    school = db.query(school_models.School).filter(school_models.School.id == school_uuid).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    new_status = not school.is_active
    action = "Activation" if new_status else "Deactivation"
    set_reason(f"System Override: Manual {action}")

    school.is_active = new_status
    db.commit()
    db.refresh(school)

    return {
        "message": f"School {action} Successful",
        "id": school.id,
        "is_active": school.is_active
    }

import uuid

@router.post("/schools/{school_id}/trial")
def start_free_trial(
    school_id: str,
    db: Session = Depends(get_db),
    user = Depends(require_roles(Roles.SUPER_ADMIN))
):
    """
    Start 14-Day Free Trial: Sets tier to PRO and expiry to now + 14 days.
    """
    # Convert string to UUID for query
    try:
        school_uuid = uuid.UUID(school_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid school ID format")

    school = db.query(school_models.School).filter(school_models.School.id == school_uuid).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    set_reason("System Override: Started 14-Day Free Trial")
    school.subscription_tier = SubscriptionTier.PRO
    school.subscription_expiry = datetime.utcnow() + timedelta(days=14)
    # Ensure active if it was inactive
    school.is_active = True

    db.commit()
    db.refresh(school)
    return {
        "message": "14-Day Free Trial Started",
        "school_id": school.id,
        "new_tier": school.subscription_tier,
        "expiry": school.subscription_expiry
    }

@router.post("/schools/{school_id}/extend")
def extend_subscription(
    school_id: str,
    request: ExtendSubscriptionRequest,
    db: Session = Depends(get_db),
    user = Depends(require_roles(Roles.SUPER_ADMIN))
):
    """
    Extend Expiry: Push the current expiry date forward by N days.
    """
    try:
        school_uuid = uuid.UUID(school_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid school ID format")

    school = db.query(school_models.School).filter(school_models.School.id == school_uuid).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    if not school.subscription_expiry:
        # If no expiry set, start from now
        base_date = datetime.utcnow()
    else:
        # If already expired, extend from now? Or from expiry?
        # Prompt says "push the current expiry date forward".
        # If expired long ago, extending by 1 day from old date might still be expired.
        # "Extend" usually means add to existing if valid, or add to NOW if expired.
        # "Nepal-Ready": "lets you update a school's status the second you receive a phone call".
        # If they pay for a month, they expect 1 month of access.
        # If they were locked out yesterday, and pay for 30 days, they get 30 days from now ideally.
        # But simplistic logic: new_expiry = max(current_expiry, now) + days
        base_date = max(school.subscription_expiry, datetime.utcnow())

    new_expiry = base_date + timedelta(days=request.days)

    set_reason(f"System Override: Extended Subscription by {request.days} days")
    school.subscription_expiry = new_expiry
    # Re-activate if frozen? Not explicitly asked but logical.
    # Prompt says "Manual Toggle: Allow SuperUsers to toggle is_active".
    # So we might leave is_active alone, but usually payment implies activation.
    # I'll enable it for convenience, or leave it.
    # "Persistence: By freezing rather than deleting... regain access once they pay."
    # Regain access implies unfreezing. I'll unfreeze.
    school.is_active = True

    db.commit()
    db.refresh(school)

    return {
        "message": f"Subscription extended by {request.days} days",
        "school_id": school.id,
        "new_expiry": school.subscription_expiry
    }

@router.get("/audit-logs", response_model=List[AuditLogOut])
def list_audit_logs(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    user = Depends(require_roles(Roles.SUPER_ADMIN))
):
    """
    Global Audit Log Viewer.
    """
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).offset(offset).all()
    # Convert datetime to string for response
    return logs

@router.get("/stats", response_model=StatsResponse)
def get_meta_stats(
    db: Session = Depends(get_db),
    user = Depends(require_roles(Roles.SUPER_ADMIN))
):
    total_schools = db.query(func.count(school_models.School.id)).scalar()
    active_schools = db.query(func.count(school_models.School.id)).filter(school_models.School.is_active == True).scalar()
    total_users = db.query(func.count(school_models.User.id)).scalar()

    total_students = db.query(func.count(Student.id)).scalar()
    total_teachers = db.query(func.count(school_models.User.id)).filter(school_models.User.role == Roles.TEACHER).scalar()

    tier_counts = db.query(
        school_models.School.subscription_tier,
        func.count(school_models.School.id)
    ).group_by(school_models.School.subscription_tier).all()

    tier_distribution = {tier.value: count for tier, count in tier_counts}

    return {
        "total_schools": total_schools,
        "active_schools": active_schools,
        "total_users": total_users,
        "total_students": total_students,
        "total_teachers": total_teachers,
        "tier_distribution": tier_distribution
    }


# ============================================
# GOD VIEW - Platform Overview (SuperUser Only)
# ============================================

from admin.analytics_service import get_platform_overview, get_revenue_trend

@router.get("/platform-overview")
def platform_overview(
    db: Session = Depends(get_db),
    user = Depends(require_roles(Roles.SUPER_USER))
):
    """
    God View: Complete platform metrics for SuperUser dashboard.
    Includes ARR, MRR, MAU, Churn Risk, and System Health.
    """
    return get_platform_overview(db)


@router.get("/revenue-trend")
def revenue_trend(
    months: int = 6,
    db: Session = Depends(get_db),
    user = Depends(require_roles(Roles.SUPER_USER))
):
    """
    Revenue Growth Trajectory for Recharts visualization.
    """
    return get_revenue_trend(db, months)

