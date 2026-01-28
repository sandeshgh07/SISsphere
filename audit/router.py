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

    query = db.query(AuditLog)
    
    if current_user.role != Roles.SUPER_USER:
        query = query.filter(AuditLog.school_id == school_id)
    
    total = query.count()
    
    offset = (page - 1) * limit
    logs = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": logs
    }
