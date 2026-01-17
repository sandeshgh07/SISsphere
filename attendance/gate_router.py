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
from auth.subscription import require_subscription_feature
from attendance.schemas import GateScanResponse
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/attendance/gate", tags=["Safety"])

# Schemas
class QRCodeResponse(BaseModel):
    token: str
    expires_at: datetime
    student_name: str

class ScanRequest(BaseModel):
    token: str

class HistoryItem(BaseModel):
    student_name: str
    action: str
    timestamp: datetime
    scanned_by: str

class BlockRequest(BaseModel):
    student_id: str
    reason: str

class UnblockRequest(BaseModel):
    student_id: str

# Secret key for QR tokens (should use settings.SECRET_KEY)
ALGORITHM = "HS256"
# Using the same env var or default as auth for now
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "changeme")

@router.get("/qr-code", response_model=QRCodeResponse)
def generate_qr_code(
    student_id: str,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.PARENT)),
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("QR_GATE"))
):
    # Verify Parent-Student Link
    link = db.query(student_models.ParentStudentLink).filter(
        student_models.ParentStudentLink.parent_id == user.id,
        student_models.ParentStudentLink.student_id == student_id,
        student_models.ParentStudentLink.school_id == str(tenant.school_id)
    ).first()

    if not link:
        raise HTTPException(status_code=403, detail="Not authorized for this student")

    student = db.query(student_models.Student).get(student_id)

    # Generate Token
    # Valid for 5 minutes
    expiration = datetime.now(timezone.utc) + timedelta(minutes=5)
    payload = {
        "sub": student_id,
        "parent_id": str(user.id),
        "school_id": str(tenant.school_id),
        "jti": str(uuid.uuid4()),
        "type": "GATE_PASS",
        "exp": expiration,
        "iat": datetime.now(timezone.utc)
    }

    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    return QRCodeResponse(
        token=token,
        expires_at=expiration,
        student_name=f"{student.first_name} {student.last_name}"
    )

@router.post("/scan", response_model=GateScanResponse)
def scan_qr_code(
    scan_data: ScanRequest,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.SECURITY_GUARD, Roles.SCHOOL_ADMIN, Roles.PRINCIPAL, Roles.ACCOUNTANT)),
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("QR_GATE"))
):
    try:
        payload = jwt.decode(scan_data.token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="QR Code expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid QR Code")

    # Verify School Isolation
    if str(payload.get("school_id")) != str(tenant.school_id):
        raise HTTPException(status_code=403, detail="QR Code belongs to a different school")

    if payload.get("type") != "GATE_PASS":
        raise HTTPException(status_code=400, detail="Invalid token type")

    student_id = payload.get("sub")
    student = db.query(student_models.Student).get(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Verify Parent Link (Security Check)
    parent_id = payload.get("parent_id")
    parent_name = "Unknown Parent"
    parent_photo = None

    if parent_id:
        link = db.query(student_models.ParentStudentLink).filter(
            student_models.ParentStudentLink.parent_id == str(parent_id),
            student_models.ParentStudentLink.student_id == student_id,
            student_models.ParentStudentLink.school_id == str(tenant.school_id)
        ).first()

        if not link:
             # Could be a stale token or attack
             raise HTTPException(status_code=403, detail="Invalid Parent-Student Link")

        parent = db.query(school_models.User).get(uuid.UUID(parent_id))
        if parent:
            parent_name = f"{parent.first_name} {parent.last_name}"
            parent_photo = parent.photo_url

    # Check 1: Authorization in Link
    if parent_id and link and not link.is_authorized_pickup:
        raise HTTPException(
            status_code=403,
            detail="BLOCKED: Parent not authorized for pickup"
        )

    # Check 2: Security Blocks (The Blocking Engine)
    # Block Hierarchy: Pair > Student > Parent

    # Check Pair Block
    pair_block = db.query(student_models.SecurityBlock).filter(
        student_models.SecurityBlock.school_id == str(tenant.school_id),
        student_models.SecurityBlock.student_id == student_id,
        student_models.SecurityBlock.parent_id == str(parent_id),
        student_models.SecurityBlock.is_active == True
    ).first()

    if pair_block:
        raise HTTPException(status_code=403, detail=f"BLOCKED: {pair_block.reason}")

    # Check Student Block (Global)
    student_block = db.query(student_models.SecurityBlock).filter(
        student_models.SecurityBlock.school_id == str(tenant.school_id),
        student_models.SecurityBlock.student_id == student_id,
        student_models.SecurityBlock.parent_id == None,
        student_models.SecurityBlock.is_active == True
    ).first()

    if student_block:
        raise HTTPException(status_code=403, detail=f"BLOCKED: {student_block.reason}")

    # Check Parent Block (Global)
    parent_block = db.query(student_models.SecurityBlock).filter(
        student_models.SecurityBlock.school_id == str(tenant.school_id),
        student_models.SecurityBlock.student_id == None,
        student_models.SecurityBlock.parent_id == str(parent_id),
        student_models.SecurityBlock.is_active == True
    ).first()

    if parent_block:
        raise HTTPException(status_code=403, detail=f"BLOCKED: {parent_block.reason}")

    # Fallback to legacy field just in case
    if student.pickup_blocked:
        raise HTTPException(
            status_code=403,
            detail=f"BLOCKED FROM PICKUP: {student.pickup_block_reason}"
        )

    # Determine Check-in vs Check-out
    last_log = db.query(student_models.GateLog).filter(
        student_models.GateLog.student_id == student_id,
        student_models.GateLog.timestamp >= datetime.combine(datetime.now(timezone.utc).date(), datetime.min.time())
    ).order_by(student_models.GateLog.timestamp.desc()).first()

    action = student_models.GateLogType.CHECKIN
    if last_log and last_log.type == student_models.GateLogType.CHECKIN:
        action = student_models.GateLogType.CHECKOUT

    # Log entry (GateLog for history)
    log_entry = student_models.GateLog(
        school_id=str(tenant.school_id),
        student_id=student_id,
        scanned_by_id=str(user.id),
        type=action
    )
    db.add(log_entry)

    # Audit Log (GATE_EXIT)
    if action == student_models.GateLogType.CHECKOUT:
        audit_entry = audit_models.AuditLog(
            actor_id=str(user.id),
            action_type="GATE_EXIT",
            table_name="students",
            record_id=student_id,
            timestamp=datetime.now(timezone.utc),
            reason="QR Scan"
        )
        db.add(audit_entry)

    db.flush()

    msg_action = "Checked In" if action == student_models.GateLogType.CHECKIN else "Checked Out"
    message = f"Safety Alert: {student.first_name} has {msg_action} at {datetime.now().strftime('%H:%M')}."

    # Notify Parent
    parents = db.query(school_models.User).join(
        student_models.ParentStudentLink,
        student_models.ParentStudentLink.parent_id == school_models.User.id
    ).filter(
        student_models.ParentStudentLink.student_id == student.id
    ).all()

    # Create Notice
    notice = comm_models.Notice(
        school_id=str(tenant.school_id),
        title=f"Student {msg_action}",
        content=message,
        priority=comm_models.NoticePriority.HIGH, # Security Alert
        author_id=str(user.id)
    )
    db.add(notice)
    db.flush()

    # Target Student
    ns = comm_models.NoticeStudent(
        notice_id=notice.id,
        student_id=student_id
    )
    db.add(ns)

    db.commit()

    return GateScanResponse(
        status="SUCCESS",
        student_name=f"{student.first_name} {student.last_name}",
        student_photo_url=student.photo_url,
        parent_name=parent_name,
        parent_photo_url=parent_photo,
        action=action,
        timestamp=log_entry.timestamp
    )

@router.get("/history", response_model=List[HistoryItem])
def get_gate_history(
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.SECURITY_GUARD, Roles.SCHOOL_ADMIN, Roles.PRINCIPAL, Roles.ACCOUNTANT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    # Fetch last 20 logs
    logs = db.query(student_models.GateLog).filter(
        student_models.GateLog.school_id == str(tenant.school_id)
    ).order_by(student_models.GateLog.timestamp.desc()).limit(20).all()

    result = []
    for log in logs:
        student = db.query(student_models.Student).get(log.student_id)
        scanned_by = None
        try:
            if log.scanned_by_id:
                scanned_by = db.query(school_models.User).get(uuid.UUID(log.scanned_by_id))
        except ValueError:
            pass

        result.append(HistoryItem(
            student_name=f"{student.first_name} {student.last_name}" if student else "Unknown",
            action=log.type,
            timestamp=log.timestamp,
            scanned_by=scanned_by.email if scanned_by else "Unknown"
        ))
    return result

@router.post("/block")
def block_pickup(
    request: BlockRequest,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.SCHOOL_ADMIN, Roles.PRINCIPAL, Roles.ACCOUNTANT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    student = db.query(student_models.Student).filter(
        student_models.Student.id == request.student_id,
        student_models.Student.school_id == str(tenant.school_id)
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student.pickup_blocked = True
    student.pickup_block_reason = request.reason

    # Audit Log
    audit_entry = audit_models.AuditLog(
        actor_id=str(user.id),
        action_type="CRITICAL_SECURITY_OVERRIDE",
        table_name="students",
        record_id=student.id,
        timestamp=datetime.now(timezone.utc),
        reason=f"Blocked: {request.reason}",
        after_state=f"pickup_blocked=True, reason={request.reason}"
    )
    db.add(audit_entry)
    db.commit()

    return {"message": "Student blocked from pickup"}

@router.post("/unblock")
def unblock_pickup(
    request: UnblockRequest,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.SCHOOL_ADMIN, Roles.PRINCIPAL, Roles.ACCOUNTANT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    student = db.query(student_models.Student).filter(
        student_models.Student.id == request.student_id,
        student_models.Student.school_id == str(tenant.school_id)
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student.pickup_blocked = False
    student.pickup_block_reason = None

    # Audit Log
    audit_entry = audit_models.AuditLog(
        actor_id=str(user.id),
        action_type="SECURITY_OVERRIDE_CLEARED", # Or similar
        table_name="students",
        record_id=student.id,
        timestamp=datetime.now(timezone.utc),
        reason="Unblocked",
        after_state="pickup_blocked=False"
    )
    db.add(audit_entry)
    db.commit()

    return {"message": "Student unblocked"}
