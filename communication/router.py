from fastapi import APIRouter, Depends, HTTPException, Body, BackgroundTasks, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from auth.dependencies import get_db, require_roles, TenantAccess, get_current_user, Roles
from schools.models import User
from students import models as student_models
from academics import models as academic_models
from communication import models as comm_models
from communication.models import Agreement, AgreementAcknowledgement
from communication.service import CommunicationService, process_high_priority_notice
from audit.listeners import set_reason
from pydantic import BaseModel
from datetime import datetime
import enum

router = APIRouter(prefix="/api", tags=["communication"])

# --- SCHEMAS ---
class AgreementOut(BaseModel):
    id: str
    title: str
    content: str
    created_at: datetime
    is_active: bool

class NoticeType(str, enum.Enum):
    ACADEMIC = "ACADEMIC"
    FINANCE = "FINANCE"
    URGENT = "URGENT"
    GENERAL = "GENERAL"

class NoticeOut(BaseModel):
    id: str
    title: str
    content: str
    priority: str
    created_at: datetime
    author_id: str

class NoticeCreate(BaseModel):
    title: str
    content: str
    priority: str = "NORMAL"
    target_roles: List[str] = []
    target_grade_ids: List[str] = []
    target_section_ids: List[str] = []
    target_student_ids: List[str] = []

class ComplaintOut(BaseModel):
    id: str
    title: str
    status: str
    created_at: datetime
    created_by_id: str

class ComplaintCreate(BaseModel):
    title: str
    initial_message: str

class MessageOut(BaseModel):
    id: str
    sender_id: str
    content: str
    created_at: datetime

class MessageCreate(BaseModel):
    content: str

class StatusUpdate(BaseModel):
    status: comm_models.ComplaintStatus

# --- NOTICES ---

@router.get("/notices/feed", response_model=List[NoticeOut])
def get_notice_feed(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant: TenantAccess = Depends(TenantAccess)
):
    service = CommunicationService()
    notices = service.get_user_notices(db, user, user.school_id)
    # Service returns dicts or objects? Usually objects.
    # We need to ensure 'type' is present.
    return notices

@router.post("/notices", response_model=NoticeOut)
def create_notice(
    notice_in: NoticeCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.SCHOOL_ADMIN, Roles.PRINCIPAL, Roles.TEACHER))
):
    # Teacher RBAC Security Check
    if user.role == Roles.TEACHER:
        assignments = db.query(academic_models.TeacherAssignment).filter(
            academic_models.TeacherAssignment.teacher_id == user.id
        ).all()

        # Allowed Grades: where section_id is NULL (assumes full grade assignment)
        allowed_grade_ids = {a.grade_id for a in assignments if a.grade_id and a.section_id is None}

        # Allowed Sections: where section_id is set
        allowed_section_ids = {a.section_id for a in assignments if a.section_id}

        # Verify Grades
        for gid in notice_in.target_grade_ids:
            if gid not in allowed_grade_ids:
                raise HTTPException(status_code=403, detail=f"Access Denied: You are not assigned to Grade {gid} (Entire Grade)")

        # Verify Sections
        for sid in notice_in.target_section_ids:
            if sid not in allowed_section_ids:
                raise HTTPException(status_code=403, detail=f"Access Denied: You are not assigned to Section {sid}")

    # Audit for High Priority
    if notice_in.priority == "HIGH":
        set_reason("CRITICAL_COMMUNICATION")

    notice = comm_models.Notice(
        title=notice_in.title,
        content=notice_in.content,
        type=notice_in.type,
        school_id=user.school_id,
        author_id=user.id,
        priority=notice_in.priority
    )
    db.add(notice)
    db.flush() # Generate ID

    # Create mappings with Validation
    for role in notice_in.target_roles:
        db.add(comm_models.NoticeRole(notice_id=notice.id, role=role))

    # Validate and add Grades
    if notice_in.target_grade_ids:
        valid_grades = db.query(academic_models.Grade.id).filter(
            academic_models.Grade.id.in_(notice_in.target_grade_ids),
            academic_models.Grade.school_id == user.school_id
        ).all()
        valid_grade_ids = {g[0] for g in valid_grades}

        if len(valid_grade_ids) != len(set(notice_in.target_grade_ids)):
            raise HTTPException(status_code=400, detail="One or more grade IDs are invalid")

        for grade_id in notice_in.target_grade_ids:
            db.add(comm_models.NoticeGrade(notice_id=notice.id, grade_id=grade_id))

    # Validate and add Sections
    if notice_in.target_section_ids:
        valid_sections = db.query(academic_models.Section.id).filter(
            academic_models.Section.id.in_(notice_in.target_section_ids),
            academic_models.Section.school_id == user.school_id
        ).all()
        valid_section_ids = {s[0] for s in valid_sections}

        if len(valid_section_ids) != len(set(notice_in.target_section_ids)):
             raise HTTPException(status_code=400, detail="One or more section IDs are invalid")

        for section_id in notice_in.target_section_ids:
            db.add(comm_models.NoticeSection(notice_id=notice.id, section_id=section_id))

    # Validate and add Students
    if notice_in.target_student_ids:
        valid_students = db.query(student_models.Student.id).filter(
            student_models.Student.id.in_(notice_in.target_student_ids),
            student_models.Student.school_id == user.school_id
        ).all()
        valid_student_ids = {s[0] for s in valid_students}

        if len(valid_student_ids) != len(set(notice_in.target_student_ids)):
             raise HTTPException(status_code=400, detail="One or more student IDs are invalid")

        for student_id in notice_in.target_student_ids:
            db.add(comm_models.NoticeStudent(notice_id=notice.id, student_id=student_id))

    db.commit()
    db.refresh(notice)

    # Trigger Background Task
    if notice.priority == comm_models.NoticePriority.HIGH:
        background_tasks.add_task(process_high_priority_notice, notice.id)

    return notice

# --- COMPLAINTS ---

@router.post("/complaints", response_model=ComplaintOut)
def create_complaint(
    complaint_in: ComplaintCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant: TenantAccess = Depends(TenantAccess)
):
    # 1. Create Complaint
    complaint = comm_models.Complaint(
        title=complaint_in.title,
        school_id=user.school_id,
        created_by_id=user.id,
        status=comm_models.ComplaintStatus.OPEN
    )
    db.add(complaint)
    db.flush()

    # 2. Add creator as participant
    participant = comm_models.ComplaintParticipant(
        complaint_id=complaint.id,
        user_id=user.id
    )
    db.add(participant)

    # 3. Add initial message
    msg = comm_models.ComplaintMessage(
        complaint_id=complaint.id,
        sender_id=user.id,
        content=complaint_in.initial_message
    )
    db.add(msg)

    # Auto-add admins
    admins = db.query(User).filter(
        User.school_id == user.school_id,
        User.role.in_([Roles.PRINCIPAL, Roles.SCHOOL_ADMIN])
    ).all()

    for admin in admins:
        if admin.id != user.id: # Avoid duplicate if admin created it
            db.add(comm_models.ComplaintParticipant(complaint_id=complaint.id, user_id=admin.id))

    db.commit()
    db.refresh(complaint)
    return complaint

@router.get("/complaints", response_model=List[ComplaintOut])
def list_complaints(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant: TenantAccess = Depends(TenantAccess)
):
    # Filter by participation
    complaints = db.query(comm_models.Complaint).join(comm_models.ComplaintParticipant).filter(
        comm_models.ComplaintParticipant.user_id == user.id,
        comm_models.Complaint.school_id == user.school_id
    ).all()
    return complaints

@router.get("/complaints/{complaint_id}/messages", response_model=List[MessageOut])
def get_messages(
    complaint_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Check participation
    is_participant = db.query(comm_models.ComplaintParticipant).filter(
        comm_models.ComplaintParticipant.complaint_id == complaint_id,
        comm_models.ComplaintParticipant.user_id == user.id
    ).first()

    if not is_participant:
        raise HTTPException(status_code=403, detail="Access denied")

    messages = db.query(comm_models.ComplaintMessage).filter(
        comm_models.ComplaintMessage.complaint_id == complaint_id
    ).order_by(comm_models.ComplaintMessage.created_at).all()

    return messages

@router.post("/complaints/{complaint_id}/messages", response_model=MessageOut)
def post_message(
    complaint_id: str,
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Check participation
    is_participant = db.query(comm_models.ComplaintParticipant).filter(
        comm_models.ComplaintParticipant.complaint_id == complaint_id,
        comm_models.ComplaintParticipant.user_id == user.id
    ).first()

    if not is_participant:
        raise HTTPException(status_code=403, detail="Access denied")

    msg = comm_models.ComplaintMessage(
        complaint_id=complaint_id,
        sender_id=user.id,
        content=msg_in.content
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

@router.patch("/complaints/{complaint_id}/status")
def update_status(
    complaint_id: str,
    status_in: StatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Check role: Only Staff/Admin
    if user.role not in [Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.TEACHER, Roles.ACCOUNTANT]:
        raise HTTPException(status_code=403, detail="Only staff can change status")

    # Check participation
    is_participant = db.query(comm_models.ComplaintParticipant).filter(
        comm_models.ComplaintParticipant.complaint_id == complaint_id,
        comm_models.ComplaintParticipant.user_id == user.id
    ).first()

    if not is_participant:
        raise HTTPException(status_code=403, detail="Access denied")

    complaint = db.query(comm_models.Complaint).filter(comm_models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Audit Log Reason
    set_reason(f"Complaint Status Change: {complaint.status} -> {status_in.status}")

    complaint.status = status_in.status
    db.commit()

    return {"status": "success", "new_status": complaint.status}

# --- AGREEMENTS ---

@router.get("/agreements", response_model=List[AgreementOut])
def list_agreements(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant: TenantAccess = Depends(TenantAccess)
):
    return db.query(Agreement).filter(
        Agreement.school_id == tenant.school_id,
        Agreement.is_active == True
    ).all()

@router.post("/agreements/{agreement_id}/acknowledge")
def acknowledge_agreement(
    agreement_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant: TenantAccess = Depends(TenantAccess)
):
    # Verify agreement exists and active
    agreement = db.query(Agreement).filter(
        Agreement.id == agreement_id,
        Agreement.school_id == tenant.school_id,
        Agreement.is_active == True
    ).first()

    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")

    # Check if already acknowledged
    existing = db.query(AgreementAcknowledgement).filter(
        AgreementAcknowledgement.agreement_id == agreement_id,
        AgreementAcknowledgement.user_id == user.id
    ).first()

    if existing:
        return {"message": "Already acknowledged"}

    ack = AgreementAcknowledgement(
        agreement_id=agreement_id,
        user_id=user.id,
        ip_address=request.client.host
    )
    db.add(ack)
    db.commit()

    return {"message": "Acknowledged successfully"}
