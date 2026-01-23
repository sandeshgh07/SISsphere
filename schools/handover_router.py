from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from auth.dependencies import get_db, require_roles, Roles, get_current_user
from schools.models import User, School
from academics.models import Grade
from passlib.context import CryptContext
from audit.models import AuditLog
from typing import Optional, List
from datetime import datetime, timezone
import json
import uuid

router = APIRouter(prefix="/api/schools", tags=["school-governance"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class NewPrincipalData(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(min_length=8)
    phone: Optional[str] = None

class HandoverRequest(BaseModel):
    # If promoting an existing user
    new_principal_id: Optional[str] = None
    
    # If creating a new user
    create_new_principal: bool = False
    new_principal_data: Optional[NewPrincipalData] = None

    # Fate of the old principal
    old_principal_id: Optional[str] = None
    old_principal_fate: str = Field(..., description="demote_teacher, demote_admin, remove_role")
    old_principal_grades: List[int] = Field(default_factory=list) # IDs of grades if becoming teacher

@router.post("/{school_id}/handover-principal")
def handover_principal(
    school_id: str,
    request: HandoverRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Authority Check
    # Only SuperAdmin or the School Owner/Principal (if self-handing over?)
    # Requirement: "SuperAdmin or Principal can initiate"
    # But usually SuperAdmin initiates for any school, Principal only for their own.
    
    if current_user.role != Roles.SUPER_ADMIN:
        # If not super admin, must be principal of THIS school
        if str(current_user.school_id) != str(school_id) or current_user.role != Roles.PRINCIPAL:
             raise HTTPException(status_code=403, detail="Not authorized to perform handover for this school.")

    try:
        school_uuid = uuid.UUID(school_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid school ID")

    school = db.query(School).filter(School.id == school_uuid).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    # 2. Identify Old Principal
    old_principal = None
    if request.old_principal_id:
        old_principal = db.query(User).filter(User.id == uuid.UUID(request.old_principal_id)).first()
    else:
        # Try to find current principal of the school
        old_principal = db.query(User).filter(User.school_id == school_uuid, User.role == Roles.PRINCIPAL).first()
    
    # 3. Identify/Create New Principal
    new_principal = None
    
    if request.create_new_principal and request.new_principal_data:
        # Check email
        existing = db.query(User).filter(User.email == request.new_principal_data.email).first()
        if existing:
             raise HTTPException(status_code=400, detail="Email for new principal is already in use.")
        
        new_principal = User(
            first_name=request.new_principal_data.full_name.split(" ")[0],
            last_name=" ".join(request.new_principal_data.full_name.split(" ")[1:]) or "",
            email=request.new_principal_data.email,
            hashed_password=pwd_context.hash(request.new_principal_data.password),
            phone=request.new_principal_data.phone,
            role=Roles.PRINCIPAL,
            school_id=school_uuid,
            is_active=True,
            token_version=1
        )
        db.add(new_principal)
        db.flush() # Get ID
        
        # Log creation
        audit = AuditLog(
            actor_id=str(current_user.id),
            action_type="USER_CREATE",
            table_name="users",
            record_id=str(new_principal.id),
            after_state=json.dumps({"role": Roles.PRINCIPAL, "email": new_principal.email}),
            reason="Created as New Principal during Handover",
            timestamp=datetime.now(timezone.utc)
        )
        db.add(audit)

    elif request.new_principal_id:
        new_principal = db.query(User).filter(User.id == uuid.UUID(request.new_principal_id)).first()
        if not new_principal:
            raise HTTPException(status_code=404, detail="Selected new principal user not found")
        
        # Verify school match
        if new_principal.school_id != school_uuid:
             raise HTTPException(status_code=400, detail="New principal must belong to the same school")
    else:
        raise HTTPException(status_code=400, detail="New principal information is required")

    # 4. Process Old Principal Fate
    if old_principal:
        # Prevent demoting the SAME person being promoted (unlikely but possible if ID matches)
        if str(old_principal.id) == str(new_principal.id):
             # Try to promote self? No-op effectively but safe.
             pass
        else:
            old_role_snapshot = old_principal.role
            new_role = Roles.TEACHER # Default fallback
            
            if request.old_principal_fate == "demote_teacher":
                new_role = Roles.TEACHER
            elif request.old_principal_fate == "demote_admin":
                new_role = Roles.SCHOOL_ADMIN
            elif request.old_principal_fate == "remove_role":
                 # If we remove role, what do they become? Guest? Inactive?
                 # Assuming just removing Principal privileges implies they might need a basic role or become inactive?
                 # Let's assume they become inactive or just a generic 'parent' or similar if not specified?
                 # Actually, usually 'User' has one role. If we remove it...
                 # Let's default to INACTIVE if 'remove_role' is chosen, or just strip privileges.
                 # Based on typical flows, let's set to INACTIVE.
                 new_role = "INACTIVE" # Or keep logic simple.
                 old_principal.is_active = False

            if new_role != "INACTIVE":
                 old_principal.role = new_role
            
            old_principal.token_version += 1
            
            # Log Old Principal Change
            audit_old = AuditLog(
                actor_id=str(current_user.id),
                action_type="PRINCIPAL_DEMOTION",
                table_name="users",
                record_id=str(old_principal.id),
                before_state=json.dumps({"role": old_role_snapshot}),
                after_state=json.dumps({"role": new_role, "fate": request.old_principal_fate}),
                reason="Principal Handover Demotion",
                timestamp=datetime.now(timezone.utc)
            )
            db.add(audit_old)

    # 5. Process New Principal Promotion (if existing user)
    if not request.create_new_principal and new_principal:
        old_role_snapshot = new_principal.role
        new_principal.role = Roles.PRINCIPAL
        new_principal.token_version += 1
        
        # Log New Principal Promotion
        audit_new = AuditLog(
            actor_id=str(current_user.id),
            action_type="PRINCIPAL_PROMOTION",
            table_name="users",
            record_id=str(new_principal.id),
            before_state=json.dumps({"role": old_role_snapshot}),
            after_state=json.dumps({"role": Roles.PRINCIPAL}),
            reason="Promoted to Principal via Handover",
            timestamp=datetime.now(timezone.utc)
        )
        db.add(audit_new)

    # 6. Update School Record (link to new principal if schema supports it)
    # Some schemas have a 'principal_id' on School model.
    # Check if school model has principal_id
    if hasattr(school, 'principal_id'):
        school.principal_id = new_principal.id
    
    db.commit()

    return {"message": "Principal handover completed successfully", "new_principal_id": new_principal.id}
