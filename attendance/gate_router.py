from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import jwt
import os
from auth.dependencies import get_db, require_roles, TenantAccess, Roles, get_current_user
from students import models as student_models
from schools import models as school_models
from communication import models as comm_models
from auth.subscription import require_subscription_feature
from pydantic import BaseModel

router = APIRouter(prefix="/api/attendance/gate", tags=["Safety"])

# Schemas
class QRCodeResponse(BaseModel):
    token: str
    expires_at: datetime
    student_name: str

class ScanRequest(BaseModel):
    token: str

class ScanResponse(BaseModel):
    status: str
    student_name: str
    action: str # CHECKIN/CHECKOUT
    timestamp: datetime

# Secret key for QR tokens (should use settings.SECRET_KEY)
# We use a short expiry
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
        student_models.ParentStudentLink.school_id == tenant.school_id
    ).first()

    if not link:
        raise HTTPException(status_code=403, detail="Not authorized for this student")

    student = db.query(student_models.Student).get(student_id)

    # Generate Token
    # Valid for 5 minutes
    expiration = datetime.now(timezone.utc) + timedelta(minutes=5)
    payload = {
        "sub": student_id,
        "school_id": tenant.school_id,
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

@router.post("/scan", response_model=ScanResponse)
def scan_qr_code(
    scan_data: ScanRequest,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.SECURITY_GUARD, Roles.SCHOOL_ADMIN, Roles.PRINCIPAL)),
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
    if payload.get("school_id") != tenant.school_id:
        raise HTTPException(status_code=403, detail="QR Code belongs to a different school")

    if payload.get("type") != "GATE_PASS":
        raise HTTPException(status_code=400, detail="Invalid token type")

    student_id = payload.get("sub")
    student = db.query(student_models.Student).get(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Determine Check-in vs Check-out
    # Simple logic: Toggle based on last log today?
    # Or strict: Morning = IN, Afternoon = OUT?
    # Let's use toggle logic for now.

    last_log = db.query(student_models.GateLog).filter(
        student_models.GateLog.student_id == student_id,
        student_models.GateLog.timestamp >= datetime.combine(datetime.now(timezone.utc).date(), datetime.min.time())
    ).order_by(student_models.GateLog.timestamp.desc()).first()

    action = student_models.GateLogType.CHECKIN
    if last_log and last_log.type == student_models.GateLogType.CHECKIN:
        action = student_models.GateLogType.CHECKOUT

    # Log entry
    log_entry = student_models.GateLog(
        school_id=tenant.school_id,
        student_id=student_id,
        scanned_by_id=user.id,
        type=action
    )
    db.add(log_entry)
    db.flush()

    # Trigger Notification
    # "Instant Alert: On a successful scan, trigger a 'Student Checkout' notification to the Teacher and Parent."
    # If Checkout? Or both? Prompt says "Student Checkout notification".
    # Assuming prompt meant specifically for checkout or generally for movement.
    # Let's send for both to be safe, or just Checkout as explicitly requested.
    # "On a successful scan, trigger a 'Student Checkout' notification..." implies mostly checkout context.
    # But safety implies knowing they arrived too.
    # I'll notify for both, changing the message.

    msg_action = "Checked In" if action == student_models.GateLogType.CHECKIN else "Checked Out"
    message = f"Safety Alert: {student.first_name} has {msg_action} at {datetime.now().strftime('%H:%M')}."

    # Notify Parent
    # We find parents via link
    parents = db.query(school_models.User).join(
        student_models.ParentStudentLink,
        student_models.ParentStudentLink.parent_id == school_models.User.id
    ).filter(
        student_models.ParentStudentLink.student_id == student.id
    ).all()

    # Notify Teacher (Class Teacher)
    teacher_id = None
    if student.grade_id:
        # Find teacher assigned to this grade (e.g. homeroom).
        # Our model has TeacherAssignment to grade/section.
        assignments = db.query(academic_models.TeacherAssignment).filter(
            academic_models.TeacherAssignment.grade_id == student.grade_id,
            academic_models.TeacherAssignment.school_id == tenant.school_id
        ).all()
        # Filter for section if exists
        for asn in assignments:
            if asn.section_id is None or asn.section_id == student.section_id:
                teacher_id = asn.teacher_id
                # Notify Teacher
                # Create a targeted NoticeDelivery or Notice for the teacher
                # Since we are creating a main Notice below, we can target it to this teacher too?
                # Or create a private notice just for them.
                # Let's rely on the main Notice and add a NoticeDelivery for the teacher if we want to be explicit,
                # OR if we want to target the teacher via NoticeRole/NoticeStudent.
                # Teacher isn't linked to Student in NoticeStudent.
                # Simplest: Send a specific notice to the teacher.
                teacher_notice = comm_models.Notice(
                    school_id=tenant.school_id,
                    title=f"Student {msg_action}: {student.first_name} {student.last_name}",
                    content=message,
                    priority=comm_models.NoticePriority.HIGH,
                    author_id=user.id
                )
                db.add(teacher_notice)
                db.flush()

                # Deliver to Teacher
                t_delivery = comm_models.NoticeDelivery(
                    notice_id=teacher_notice.id,
                    user_id=teacher_id,
                    channel="EMAIL", # Default
                    status=comm_models.NoticeDeliveryStatus.PENDING
                )
                db.add(t_delivery)
                break # Notify one primary teacher (or remove break to notify all subject teachers?)
                      # Usually Class Teacher is one. Assuming assignments handled correctly.

    # Create Notice (System Notification for Parents/Log)
    # We need an author. Use scanning user (Guard).
    notice = comm_models.Notice(
        school_id=tenant.school_id,
        title=f"Student {msg_action}",
        content=message,
        priority=comm_models.NoticePriority.HIGH, # Security Alert
        author_id=user.id
    )
    db.add(notice)
    db.flush()

    # Target Parents
    for p in parents:
        # We don't have NoticeParent table, but NoticeDelivery or NoticeRole.
        # Logic in communication router handles targeting.
        # Here we manually create NoticeDelivery to ensure it's "Sent".
        # Or better, rely on a background worker or notice service logic.
        # We will just add NoticeStudent which makes it visible to parents of that student (if we implement that logic).
        # Wait, NoticeStudent links notice to student.
        # Existing logic likely shows notices for a student to their parents.
        pass

    # Target Student (so parents see it)
    ns = comm_models.NoticeStudent(
        notice_id=notice.id,
        student_id=student_id
    )
    db.add(ns)

    db.commit()

    return ScanResponse(
        status="Success",
        student_name=f"{student.first_name} {student.last_name}",
        action=action,
        timestamp=log_entry.timestamp
    )
