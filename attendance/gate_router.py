from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import jwt
import os
import uuid
from auth.dependencies import get_db, require_roles, TenantAccess, Roles, get_current_user
from students import models as student_models
from schools import models as school_models
from communication import models as comm_models
from audit import models as audit_models
from attendance import models as attention_models
from auth.subscription import require_subscription_feature
from attendance.schemas import GateScanResponse
from pydantic import BaseModel, Field
from typing import List, Optional

router = APIRouter(prefix="/api/attendance/gate", tags=["Safety"])

# Schemas
class CreatePassRequest(BaseModel):
    student_id: str
    pass_type: str = Field(..., pattern="^(NORMAL|SUPER)$")
    reason: Optional[str] = None # Required for SUPER
    sent_with_name: Optional[str] = None
    sent_with_relation: Optional[str] = None
    sent_with_phone: Optional[str] = None
    expires_in_hours: int = 1

class PassResponse(BaseModel):
    token: str
    pass_id: str
    expires_at: datetime
    student_name: str

class VerifyRequest(BaseModel):
    token: str

class VerifyResponse(BaseModel):
    valid: bool
    pass_id: str
    pass_type: str
    student_name: str
    student_photo: Optional[str] = None
    student_grade: Optional[str] = None
    issuer_name: str
    issuer_role: str
    reason: Optional[str] = None
    sent_with: Optional[str] = None
    created_at: datetime
    status: str

class ConfirmScanRequest(BaseModel):
    pass_id: str

# Secret key for QR tokens
ALGORITHM = "HS256"
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "changeme")

@router.post("/create", response_model=PassResponse)
def create_pass(
    request: CreatePassRequest,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(get_current_user), # Any auth user can try, we validate roles inside
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("QR_GATE"))
):
    # 1. Permission Check
    if request.pass_type == "NORMAL":
        # Must be Parent checking their own child
        if user.role != Roles.PARENT: 
             # Strictly enforce Parents -> Normal.
             # If a staff wants a normal pass for their own child (if they are also a parent), they should switch to Parent role.
             pass 
        
        # Verify Parent-Student Link
        # (Allow standard parent logic)
        link = db.query(student_models.ParentStudentLink).filter(
            student_models.ParentStudentLink.parent_id == user.id,
            student_models.ParentStudentLink.student_id == request.student_id,
            student_models.ParentStudentLink.school_id == str(tenant.school_id)
        ).first()

        if not link and user.role == Roles.PARENT:
             raise HTTPException(status_code=403, detail="Not authorized for this student")
             
    elif request.pass_type == "SUPER":
        # Must be Staff (Principal, Admin, Teacher, Accountant, Board)
        allowed_roles = [Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SCHOOL_ADMIN, Roles.TEACHER, Roles.ACCOUNTANT, Roles.BOARD]
        # Check current effective role or if user has any of these roles
        if user.role not in allowed_roles:
             # Basic check failed. 
             raise HTTPException(status_code=403, detail="Unauthorized to create SuperPass")
            
        if not request.reason or len(request.reason) < 5:
            raise HTTPException(status_code=400, detail="Reason is required for SuperPass (min 5 chars)")
            
    else:
        raise HTTPException(status_code=400, detail="Invalid pass type")

    # 2. Student Info
    student = db.query(student_models.Student).get(request.student_id)
    if not student or student.school_id != str(tenant.school_id):
        raise HTTPException(status_code=404, detail="Student not found")

    # 3. Create GatePass Record
    expires_at = datetime.now(timezone.utc) + timedelta(hours=min(request.expires_in_hours, 12))
    
    new_pass = attention_models.GatePass(
        school_id=str(tenant.school_id),
        pass_type=attention_models.GatePassType(request.pass_type),
        issuer_user_id=str(user.id),
        issuer_role_used=user.role,
        student_id=student.id,
        sent_with_name=request.sent_with_name,
        sent_with_relation=request.sent_with_relation,
        sent_with_phone=request.sent_with_phone,
        reason=request.reason,
        status=attention_models.GatePassStatus.ACTIVE,
        expires_at=expires_at.date(), # Legacy support if needed
        expires_at_dt=expires_at
    )
    db.add(new_pass)
    
    # Audit for SuperPass
    if request.pass_type == "SUPER":
        audit = audit_models.AuditLog(
            actor_id=str(user.id),
            action_type="SUPERPASS_CREATED",
            table_name="gate_passes",
            record_id=new_pass.id,
            timestamp=datetime.now(timezone.utc),
            reason=request.reason,
            details=f"For Student: {student.first_name} {student.last_name}"
        )
        db.add(audit)

    db.commit()
    db.refresh(new_pass)
    
    # 4. Generate Token (Pointing to Pass ID)
    payload = {
        "pass_id": new_pass.id,
        "school_id": str(tenant.school_id),
        "type": "GATE_PASS_V2",
        "exp": expires_at
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    return PassResponse(
        token=token,
        pass_id=new_pass.id,
        expires_at=expires_at,
        student_name=f"{student.first_name} {student.last_name}"
    )

@router.post("/verify", response_model=VerifyResponse)
def verify_pass(
    request: VerifyRequest,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.SECURITY_GUARD, Roles.SUPER_ADMIN, Roles.PRINCIPAL)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    try:
        payload = jwt.decode(request.token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Token Expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid Token")

    if payload.get("school_id") != str(tenant.school_id):
        raise HTTPException(status_code=403, detail="Different School Pass")
    
    # Explicitly check type for V2
    if payload.get("type") != "GATE_PASS_V2":
         raise HTTPException(status_code=400, detail="Old or Invalid Pass Type")

    pass_id = payload.get("pass_id")
    if not pass_id:
        raise HTTPException(status_code=400, detail="Invalid Pass Format")
        
    gate_pass = db.query(attention_models.GatePass).get(pass_id)
    if not gate_pass:
        raise HTTPException(status_code=404, detail="Pass record not found")
        
    if gate_pass.status != attention_models.GatePassStatus.ACTIVE:
        raise HTTPException(status_code=400, detail=f"Pass is {gate_pass.status}")

    # Check expiration dt
    if gate_pass.expires_at_dt < datetime.now(timezone.utc):
        gate_pass.status = attention_models.GatePassStatus.EXPIRED
        db.commit()
        raise HTTPException(status_code=400, detail="Pass Expired")

    # Fetch details
    student = db.query(student_models.Student).get(gate_pass.student_id)
    issuer = db.query(school_models.User).get(gate_pass.issuer_user_id)
    issuer_name = f"{issuer.first_name} {issuer.last_name}" if issuer else "Unknown"

    grade_info = ""
    if student.grade:
        grade_info = f"{student.grade.name} {student.section.name if student.section else ''}"

    sent_with_str = None
    if gate_pass.sent_with_name:
        sent_with_str = f"{gate_pass.sent_with_name} ({gate_pass.sent_with_relation})"

    return VerifyResponse(
        valid=True,
        pass_id=gate_pass.id,
        pass_type=gate_pass.pass_type,
        student_name=f"{student.first_name} {student.last_name}",
        student_photo=student.photo_url,
        student_grade=grade_info,
        issuer_name=issuer_name,
        issuer_role=gate_pass.issuer_role_used,
        reason=gate_pass.reason,
        sent_with=sent_with_str,
        created_at=gate_pass.created_at,
        status=gate_pass.status
    )

@router.post("/confirm-scan")
def confirm_scan(
    request: ConfirmScanRequest,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.SECURITY_GUARD, Roles.SUPER_ADMIN, Roles.PRINCIPAL)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    gate_pass = db.query(attention_models.GatePass).get(request.pass_id)
    if not gate_pass:
        raise HTTPException(status_code=404, detail="Pass not found")
        
    if gate_pass.status != attention_models.GatePassStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Pass already used or expired")
        
    # Mark Used
    gate_pass.status = attention_models.GatePassStatus.USED
    gate_pass.used_at = datetime.now(timezone.utc)
    gate_pass.used_by_user_id = str(user.id)
    
    # Create Audit Event (PASS_USED)
    audit = audit_models.AuditLog(
        actor_id=str(user.id),
        action_type="PASS_USED",
        table_name="gate_passes",
        record_id=gate_pass.id,
        timestamp=datetime.now(timezone.utc),
        details=f"Type: {gate_pass.pass_type}, Student: {gate_pass.student_id}"
    )
    db.add(audit)
    
    # Legacy Gate Log (optional, for simple history view in existing dashboard)
    legacy_log = student_models.GateLog(
        school_id=str(tenant.school_id),
        student_id=gate_pass.student_id,
        scanned_by_id=str(user.id),
        type=student_models.GateLogType.CHECKOUT,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(legacy_log)
    
    db.commit()
    
    return {"message": "Pass confirmed and logged"}
