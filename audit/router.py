from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from database import get_db
from typing import List, Optional
from audit.models import AuditLog
from audit.schemas import PaginatedAuditLogResponse, AuditLogResponse
from auth.dependencies import get_current_active_user, Roles
from schools.models import User

router = APIRouter()

@router.get("/logs", response_model=PaginatedAuditLogResponse)
def get_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # RBAC: Only Principals/Admins can view logs for their school
    if current_user.role not in [Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.SUPER_ADMIN, Roles.SUPER_USER]:
         raise HTTPException(status_code=403, detail="Not authorized to view audit logs")

    school_id = str(current_user.school_id) if current_user.school_id else None
    
    # SuperUser/SuperAdmin cross-tenant logic if needed, but per requirements "backend enforces school_id"
    # Assuming school_id is present on user for typical tenant access
    if not school_id and current_user.role != Roles.SUPER_USER:
        raise HTTPException(status_code=403, detail="School context missing")

    # Join with User table to get actor details
    # Handle mismatch: AuditLog.actor_id (uuid string with hyphens) vs User.id (uuid string hex/no-hyphens)
    # We strip hyphens from AuditLog.actor_id for the join condition
    from sqlalchemy.sql.expression import cast
    from sqlalchemy import String, or_

    query = db.query(AuditLog, User).outerjoin(
        User, 
        func.replace(AuditLog.actor_id, '-', '') == User.id
    )
    
    if current_user.role != Roles.SUPER_USER:
        query = query.filter(AuditLog.school_id == school_id)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                AuditLog.action_type.ilike(search_term),
                AuditLog.table_name.ilike(search_term),
                AuditLog.reason.ilike(search_term),
                User.first_name.ilike(search_term),
                User.last_name.ilike(search_term),
                User.email.ilike(search_term)
            )
        )

    total = query.count()
    
    offset = (page - 1) * limit
    # Order by timestamp desc
    results = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit).all()
    
    # Transform results to match response schema
    items = []
    for log, user in results:
        # Pydantic model creation
        item = AuditLogResponse.from_orm(log)
        if user:
            item.actor_name = f"{user.first_name} {user.last_name}"
            item.actor_email = user.email
            item.actor_role = user.role
        items.append(item)
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": items
    }


@router.get("/platform", response_model=List[AuditLogResponse])
def get_platform_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user)
):
    """
    Get system-wide audit logs. SuperUser/SuperAdmin only.
    Focuses on actions that might not have a school_id or are critical system events.
    For now, return recent logs order by timestamp desc.
    """
    if user.role not in [Roles.SUPER_USER, Roles.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # For platform view, we might want to see everything
    logs = db.query(AuditLog).order_by(desc(AuditLog.timestamp)).limit(limit).all()
    return logs
