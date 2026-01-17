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
from datetime import datetime

router = APIRouter(prefix="/api/superadmin", tags=["admin"])

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
