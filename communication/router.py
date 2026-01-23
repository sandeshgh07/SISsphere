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

from audit.listeners import set_reason, set_actor_id, set_hidden_users
from pydantic import BaseModel
from datetime import datetime, timezone
import enum
from sqlalchemy import or_
import uuid

router = APIRouter(tags=["communication"])

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
    scheduled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    require_ack: bool = False

    class Config:
        from_attributes = True
        orm_mode = True

class NoticeCreate(BaseModel):
    title: str
    content: str
    priority: str = "NORMAL"
    target_roles: List[str] = []
    target_grade_ids: List[str] = []
    target_section_ids: List[str] = []
    target_student_ids: List[str] = []
    scheduled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    require_ack: bool = False

class ComplaintCreate(BaseModel):
    title: str
    description: str
    category: Optional[str] = "student" # 'student', 'staff'
    target_user_ids: Optional[List[str]] = None # For Staff complaints
    student_id: Optional[str] = None
    severity: Optional[str] = "low"
    visible_to_principal: bool = True
    visible_to_school_admin: bool = False
    visible_to_board: bool = False
    visible_to_admin: bool = False # Deprecated
    visible_to_parents: bool = False
    visible_to_student: bool = False
    class_or_course_context: Optional[str] = None

class ComplaintOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    created_by_id: str
    severity: Optional[str] = None
    category: Optional[str] = "student"
    target_user_ids: Optional[str] = None 
    student_id: Optional[str] = None
    class_or_course_context: Optional[str] = None
    visible_to_principal: bool = True
    visible_to_school_admin: bool = False
    visible_to_board: bool = False
    visible_to_admin: bool = False
    visible_to_parents: bool = False
    visible_to_student: bool = False
    assigned_to_user_id: Optional[str] = None

    class Config:
        from_attributes = True
        orm_mode = True

class MessageOut(BaseModel):
    id: str
    sender_id: str
    content: str
    is_internal: bool
    created_at: datetime

    class Config:
        from_attributes = True
        orm_mode = True

class MessageCreate(BaseModel):
    content: str
    is_internal: bool = False

class StatusUpdate(BaseModel):
    status: comm_models.ComplaintStatus

class AssignmentUpdate(BaseModel):
    assigned_to_user_id: Optional[str]

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

@router.get("/notices", response_model=List[NoticeOut])
def get_all_school_notices(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not user.school_id:
        return []
    
    school_id_str = str(user.school_id)
    # Normalize to canonical UUID string (dashed) just in case
    # This handles both hex strings and UUID objects safely
    try:
        import uuid
        school_id_str = str(uuid.UUID(str(user.school_id)))
    except:
        pass

    query = db.query(comm_models.Notice).filter(
        comm_models.Notice.school_id == school_id_str
    )

    # If NOT admin/staff, filter by visibility (implementation simplified for now)
    # AND filter by scheduled/expiry
    is_admin = user.role in [Roles.SUPER_ADMIN, Roles.PRINCIPAL, "school_admin"]
    
    # Hide expired
    now = datetime.now(timezone.utc)
    # We want notices where (expires_at IS NULL OR expires_at > now)
    # AND (scheduled_at IS NULL OR scheduled_at <= now) -- unless admin?
    
    if not is_admin:
         query = query.filter(
             or_(comm_models.Notice.expires_at == None, comm_models.Notice.expires_at > now),
             or_(comm_models.Notice.scheduled_at == None, comm_models.Notice.scheduled_at <= now)
         )
    
    # Also if admin, we might want to see all? Or maybe separate endpoint for 'All Notices' management.
    # For now, let's just apply the scheduling filter to everyone on this "feed" endpoint,
    # except maybe authors can see their own future posts?
    # Simplest: List ALL for admins, Filtered for others.
    
    return query.order_by(comm_models.Notice.created_at.desc()).all()

@router.post("/notices", response_model=NoticeOut)
def create_notice(
    notice_in: NoticeCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.SUPER_ADMIN, Roles.PRINCIPAL, Roles.TEACHER))
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

    # Audit
    set_actor_id(str(user.id))
    if notice_in.priority == "CRITICAL":
        set_reason("CRITICAL_COMMUNICATION")
    else:
        set_reason(f"Notice Creation ({notice_in.priority})")

    notice = comm_models.Notice(
        title=notice_in.title,
        content=notice_in.content,
        school_id=str(user.school_id),
        author_id=str(user.id),
        priority=notice_in.priority,
        scheduled_at=notice_in.scheduled_at,
        expires_at=notice_in.expires_at,
        require_ack=notice_in.require_ack
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

    # Trigger Background Task for CRITICAL priority notices
    if notice.priority == comm_models.NoticePriority.CRITICAL:
        background_tasks.add_task(process_high_priority_notice, notice.id)

    return notice

@router.post("/notices/{notice_id}/acknowledge")
def acknowledge_notice(
    notice_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    notice = db.query(comm_models.Notice).filter(comm_models.Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")

    # Check if already acked
    existing = db.query(comm_models.NoticeAck).filter(
        comm_models.NoticeAck.notice_id == notice_id,
        comm_models.NoticeAck.user_id == user.id
    ).first()
    
    if existing:
        return {"status": "already_acknowledged"}
    
    ack = comm_models.NoticeAck(
        notice_id=notice_id,
        user_id=user.id,
        ack_at=datetime.now(timezone.utc)
    )
    db.add(ack)
    db.commit()
    return {"status": "success"}

# --- COMPLAINTS ---

@router.post("/complaints", response_model=ComplaintOut)
def create_complaint(
    complaint_in: ComplaintCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant: TenantAccess = Depends(TenantAccess)
):
    import json
    
    # Audit Logic
    set_actor_id(str(user.id))
    set_reason("Complaint Creation")

    # Privacy: If complaining about staff, hide audit log from them
    target_uids_json = None
    if complaint_in.category == "staff" and complaint_in.target_user_ids:
        hidden_users = complaint_in.target_user_ids
        # ALSO hide from the creator? No, creator should see it.
        # But wait, audit log usually lists "Actor: Security Guard created Complaint".
        # If the target (Principal) views logs, they shouldn't see "Security Guard created Complaint about Principal".
        set_hidden_users(json.dumps(hidden_users))
        target_uids_json = json.dumps(complaint_in.target_user_ids)

    # 1. Create Complaint
    complaint = comm_models.Complaint(
        title=complaint_in.title,
        school_id=str(user.school_id),
        created_by_id=str(user.id),
        status=comm_models.ComplaintStatus.OPEN,
        
        # New Fields
        category=complaint_in.category,
        target_user_ids=target_uids_json,
        description=complaint_in.description, 
        student_id=complaint_in.student_id,
        severity=complaint_in.severity,
        class_or_course_context=complaint_in.class_or_course_context,
        visible_to_principal=complaint_in.visible_to_principal,
        visible_to_school_admin=complaint_in.visible_to_school_admin,
        visible_to_board=complaint_in.visible_to_board,
        visible_to_admin=False, # Deprecated
        visible_to_parents=complaint_in.visible_to_parents,
        visible_to_student=complaint_in.visible_to_student
    )
    db.add(complaint)
    db.flush()

    # 2. Add creator as participant
    participant = comm_models.ComplaintParticipant(
        complaint_id=complaint.id,
        user_id=str(user.id)
    )
    db.add(participant)

    # 3. Add initial message
    msg = comm_models.ComplaintMessage(
        complaint_id=complaint.id,
        sender_id=str(user.id),
        content=complaint_in.description
    )
    db.add(msg)

    # 4. Contextual Participants Addition based on Visibility Flags
    
    # A. Principal
    if complaint_in.visible_to_principal:
        principals = db.query(User).filter(
            User.school_id == user.school_id,
            User.role == Roles.PRINCIPAL
        ).all()
        for p in principals:
            # Check if this principal is a target. If so, DO NOT add as participant?
            # User said "but for other users, principle can see it."
            # "if a guard complaints about principle to board members, principle won't be able to see that log"
            # It heavily implies target should NOT see the complaint either.
            
            is_target = False
            if complaint_in.category == "staff" and complaint_in.target_user_ids:
                if str(p.id) in complaint_in.target_user_ids:
                    is_target = True
            
            if p.id != user.id and not is_target:
                db.add(comm_models.ComplaintParticipant(complaint_id=complaint.id, user_id=str(p.id)))

    # B1. School Admin
    if complaint_in.visible_to_school_admin:
        school_admins = db.query(User).filter(
            User.school_id == user.school_id,
            User.role == Roles.SCHOOL_ADMIN
        ).all()
        for sa in school_admins:
             is_target = False
             if complaint_in.category == "staff" and complaint_in.target_user_ids:
                 if str(sa.id) in complaint_in.target_user_ids:
                     is_target = True

             if sa.id != user.id and not is_target:
                db.add(comm_models.ComplaintParticipant(complaint_id=complaint.id, user_id=str(sa.id)))

    # B2. Board Members (and Super Admins)
    if complaint_in.visible_to_board:
        board_members = db.query(User).filter(
            User.school_id == user.school_id,
            User.role.in_([Roles.BOARD, Roles.SUPER_ADMIN])
        ).all()
        for bm in board_members:
             is_target = False
             if complaint_in.category == "staff" and complaint_in.target_user_ids:
                 if str(bm.id) in complaint_in.target_user_ids:
                     is_target = True

             if bm.id != user.id and not is_target:
                db.add(comm_models.ComplaintParticipant(complaint_id=complaint.id, user_id=str(bm.id)))

    # C. Parents (if student context exists)
    if complaint_in.visible_to_parents and complaint_in.student_id:
        links = db.query(student_models.ParentStudentLink).filter(
            student_models.ParentStudentLink.student_id == complaint_in.student_id
        ).all()
        for link in links:
             if link.parent_id != str(user.id):
                 db.add(comm_models.ComplaintParticipant(complaint_id=complaint.id, user_id=link.parent_id))

    # D. Student (if context exists)
    if complaint_in.visible_to_student and complaint_in.student_id:
         if complaint_in.student_id != str(user.id):
             db.add(comm_models.ComplaintParticipant(complaint_id=complaint.id, user_id=complaint_in.student_id))

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
    # Ensure school_id string matching is robust
    school_id_str = str(user.school_id)
    try:
        import uuid
        school_id_str = str(uuid.UUID(str(user.school_id)))
    except:
        pass

    complaints = db.query(comm_models.Complaint).join(comm_models.ComplaintParticipant).filter(
        comm_models.ComplaintParticipant.user_id == str(user.id),
        comm_models.Complaint.school_id == school_id_str
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
        comm_models.ComplaintParticipant.user_id == str(user.id)
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
        comm_models.ComplaintParticipant.user_id == str(user.id)
    ).first()

    if not is_participant:
        raise HTTPException(status_code=403, detail="Access denied")

    msg = comm_models.ComplaintMessage(
        complaint_id=complaint_id,
        sender_id=user.id,
        content=msg_in.content,
        is_internal=msg_in.is_internal
    )
    db.add(msg)
    
    # Mandatory Audit Log for Activity
    from audit.models import AuditLog
    import uuid
    import json
    
    # Check if target is set to hide audit log
    complaint = db.query(comm_models.Complaint).filter(comm_models.Complaint.id == complaint_id).first()
    hidden_users = complaint.target_user_ids if complaint else None

    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        school_id=str(user.school_id),
        actor_id=str(user.id),
        action_type="COMPLAINT_ACTIVITY_ADDED",
        table_name="complaint_messages",
        record_id=msg.id,
        timestamp=datetime.now(timezone.utc),
        reason=f"Message added ({'Internal' if msg_in.is_internal else 'Public'})",
        after_state=json.dumps({
            "complaint_id": complaint_id,
            "is_internal": msg_in.is_internal
        }),
        hidden_for_user_ids=hidden_users
    )
    db.add(audit_log)

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
    from audit.models import AuditLog
    import json

    # 1. Fetch Complaint & Validate Access
    complaint = db.query(comm_models.Complaint).filter(comm_models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Enforce Tenant Isolation (implicitly handled by ID if unique, but good practice to check)
    if str(complaint.school_id) != str(user.school_id):
         raise HTTPException(status_code=404, detail="Complaint not found")

    # 2. RBAC: Only Reviewers/Handlers can change status
    # Principal, School Admin, Board, Super Admin. 
    # Teachers? Only if assigned? For now strict role check as per rules.
    allowed_roles = [Roles.PRINCIPAL, Roles.SUPER_ADMIN, "school_admin", Roles.BOARD]
    if user.role not in allowed_roles:
        # Teachers might be participants/assignees but usually don't set status to CLOSED without approval?
        # Rule says: "Only reviewers/handlers can change status: principal, school_admin, board/super_admin"
        raise HTTPException(status_code=403, detail="Unauthorized to change complaint status")

    # 3. Confidentiality Check (Target cannot mutate)
    if complaint.target_user_ids:
        try:
             target_ids = json.loads(complaint.target_user_ids) if isinstance(complaint.target_user_ids, str) else complaint.target_user_ids
             if str(user.id) in target_ids:
                 raise HTTPException(status_code=403, detail="Access Denied: Conflict of Interest")
        except:
            pass

    # 4. State Machine Transition Rules
    current_status = complaint.status
    new_status = status_in.status
    
    # Handle backward compatibility for OPEN
    if current_status == "OPEN": current_status = comm_models.ComplaintStatus.NEW

    valid = False
    if current_status == comm_models.ComplaintStatus.NEW:
        if new_status == comm_models.ComplaintStatus.UNDER_REVIEW: valid = True
    elif current_status == comm_models.ComplaintStatus.UNDER_REVIEW:
        if new_status in [comm_models.ComplaintStatus.IN_PROGRESS, comm_models.ComplaintStatus.RESOLVED]: valid = True
    elif current_status == comm_models.ComplaintStatus.IN_PROGRESS:
        if new_status == comm_models.ComplaintStatus.RESOLVED: valid = True
    elif current_status == comm_models.ComplaintStatus.RESOLVED:
        if new_status in [comm_models.ComplaintStatus.CLOSED, comm_models.ComplaintStatus.IN_PROGRESS]: valid = True
    elif current_status == comm_models.ComplaintStatus.CLOSED:
        # Only Board/SuperAdmin can reopen
        if new_status == comm_models.ComplaintStatus.IN_PROGRESS:
             if user.role in [Roles.BOARD, Roles.SUPER_ADMIN]:
                 valid = True
             else:
                 raise HTTPException(status_code=403, detail="Only Board/SuperAdmin can reopen closed cases")

    if not valid and current_status != new_status:
         # Allow idempotent same-status "updates" (no-op) or fail? Fail to be strict.
         if current_status == new_status:
             return {"status": "success", "new_status": complaint.status}
         raise HTTPException(status_code=400, detail=f"Invalid state transition from {current_status} to {new_status}")

    # 5. Apply Changes
    now_ts = datetime.now(timezone.utc)
    complaint.status = new_status
    complaint.status_changed_at = now_ts
    complaint.status_changed_by_user_id = str(user.id)

    if new_status == comm_models.ComplaintStatus.RESOLVED:
        complaint.resolved_at = now_ts
    
    if new_status == comm_models.ComplaintStatus.CLOSED:
        complaint.closed_at = now_ts

    # 6. Mandatory Audit Log
    # We deliberately insert AuditLog here to ensure transaction atomicity
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        school_id=str(complaint.school_id),
        actor_id=str(user.id),
        action_type="COMPLAINT_STATUS_CHANGED",
        table_name="complaints",
        record_id=complaint.id,
        timestamp=now_ts,
        reason=f"Status change ({current_status} -> {new_status})",
        before_state=json.dumps({"status": current_status.value}),
        after_state=json.dumps({"status": new_status.value}),
        hidden_for_user_ids=complaint.target_user_ids # Maintain confidentiality
    )
    db.add(audit_log)

    db.commit()
    return {"status": "success", "new_status": complaint.status}

@router.patch("/complaints/{complaint_id}/assign")
def assign_complaint(
    complaint_id: str,
    assign_in: AssignmentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    from audit.models import AuditLog
    import json

    # 1. Fetch & Validate
    complaint = db.query(comm_models.Complaint).filter(comm_models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    if str(complaint.school_id) != str(user.school_id):
         raise HTTPException(status_code=404, detail="Complaint not found")

    # 2. RBAC
    allowed_roles = [Roles.PRINCIPAL, Roles.SUPER_ADMIN, "school_admin", Roles.BOARD]
    if user.role not in allowed_roles:
         raise HTTPException(status_code=403, detail="Unauthorized to assign complaints")

    # 3. Confidentiality Check
    if complaint.target_user_ids:
        try:
             target_ids = json.loads(complaint.target_user_ids) if isinstance(complaint.target_user_ids, str) else complaint.target_user_ids
             if str(user.id) in target_ids:
                 raise HTTPException(status_code=403, detail="Access Denied: Conflict of Interest")
        except:
            pass
            
    old_assignee = complaint.assigned_to_user_id

    # 4. Apply Changes
    complaint.assigned_to_user_id = assign_in.assigned_to_user_id
    complaint.assigned_at = datetime.now(timezone.utc)
    
    # Add as participant if new assignment
    if assign_in.assigned_to_user_id:
        exists = db.query(comm_models.ComplaintParticipant).filter(
            comm_models.ComplaintParticipant.complaint_id == complaint.id,
            comm_models.ComplaintParticipant.user_id == assign_in.assigned_to_user_id
        ).first()
        if not exists:
             db.add(comm_models.ComplaintParticipant(complaint_id=complaint.id, user_id=assign_in.assigned_to_user_id))

    # 5. Mandatory Audit Log
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        school_id=str(complaint.school_id),
        actor_id=str(user.id),
        action_type="COMPLAINT_ASSIGNED",
        table_name="complaints",
        record_id=complaint.id,
        timestamp=datetime.now(timezone.utc),
        reason=f"Assigned to {assign_in.assigned_to_user_id}",
        before_state=json.dumps({"assigned_to": old_assignee}),
        after_state=json.dumps({"assigned_to": assign_in.assigned_to_user_id}),
        hidden_for_user_ids=complaint.target_user_ids
    )
    db.add(audit_log)

    db.commit()
    return {"status": "success", "assigned_to": complaint.assigned_to_user_id}


@router.patch("/complaints/{complaint_id}/assign")
def assign_complaint(
    complaint_id: str,
    assign_in: AssignmentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Audit
    set_actor_id(str(user.id))
    set_reason(f"Complaint Assignment Update")

    # Check role
    if user.role not in [Roles.PRINCIPAL, Roles.SUPER_ADMIN, "school_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can assign complaints")

    complaint = db.query(comm_models.Complaint).filter(comm_models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Privacy Protection for Audit Log
    if complaint.target_user_ids:
        try:
            # target_user_ids is a JSON string or list? Check model.
            # In create_complaint we saved it as JSON string if populated.
            # Let's verify if it's stored as String or Text. Model says Text.
            # If it's a JSON string, we pass it directly.
            set_hidden_users(complaint.target_user_ids)
        except:
            pass

    # Update logic
    complaint.assigned_to_user_id = assign_in.assigned_to_user_id
    
    # If assigning to someone, add them as participant!
    if assign_in.assigned_to_user_id:
        # Check if already participant
        exists = db.query(comm_models.ComplaintParticipant).filter(
            comm_models.ComplaintParticipant.complaint_id == complaint.id,
            comm_models.ComplaintParticipant.user_id == assign_in.assigned_to_user_id
        ).first()
        if not exists:
             db.add(comm_models.ComplaintParticipant(complaint_id=complaint.id, user_id=assign_in.assigned_to_user_id))

    db.commit()
    return {"status": "success", "assigned_to": complaint.assigned_to_user_id}

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


# --- CONTACT REQUESTS (Corporate) ---

class ContactFormSubmission(BaseModel):
    name: str
    email: str
    subject: str
    school_name: Optional[str] = None
    message: str


class ContactRequestOut(BaseModel):
    id: str
    name: str
    email: str
    subject: str
    school_name: Optional[str]
    message: str
    status: str
    created_at: datetime
    resolved_at: Optional[datetime]
    admin_notes: Optional[str]


class ContactStatusUpdate(BaseModel):
    status: str
    admin_notes: Optional[str] = None


class ContactReplyRequest(BaseModel):
    message: str


@router.post("/public/contact")
def submit_contact_form(
    form: ContactFormSubmission,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Public endpoint for Classa corporate contact form.
    No authentication required.
    """
    from communication.models import ContactRequest, ContactRequestStatus
    
    contact = ContactRequest(
        name=form.name,
        email=form.email,
        subject=form.subject,
        school_name=form.school_name,
        message=form.message,
        status=ContactRequestStatus.NEW
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    
    # Send email notification to admin (background task)
    background_tasks.add_task(
        send_contact_notification,
        contact.id,
        form.name,
        form.email,
        form.subject,
        form.message,
        form.school_name
    )
    
    return {
        "message": "Thank you for contacting us! We'll get back to you soon.",
        "reference_id": contact.id
    }


def send_contact_notification(
    contact_id: str,
    name: str,
    email: str,
    subject: str,
    message: str,
    school_name: Optional[str]
):
    """Background task to send email notification about new contact request."""
    from core.email_service import email_service
    
    email_service.send_contact_notification(
        contact_id=contact_id,
        name=name,
        email=email,
        subject=subject,
        message=message,
        school_name=school_name
    )


@router.get("/admin/contact-requests", response_model=List[ContactRequestOut])
def list_contact_requests(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    List all contact requests. SuperUser/SuperAdmin only.
    """
    from communication.models import ContactRequest, ContactRequestStatus
    
    # Check if superuser
    if user.role not in ["superuser", "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = db.query(ContactRequest)
    
    if status_filter:
        try:
            status_enum = ContactRequestStatus(status_filter)
            query = query.filter(ContactRequest.status == status_enum)
        except ValueError:
            pass  # Invalid status, return all
    
    contacts = query.order_by(ContactRequest.created_at.desc()).all()
    
    return [
        {
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "subject": c.subject,
            "school_name": c.school_name,
            "message": c.message,
            "status": c.status.value if hasattr(c.status, 'value') else c.status,
            "created_at": c.created_at,
            "resolved_at": c.resolved_at,
            "admin_notes": c.admin_notes
        }
        for c in contacts
    ]


@router.patch("/admin/contact-requests/{request_id}")
def update_contact_request(
    request_id: str,
    update: ContactStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update contact request status and notes. SuperUser only."""
    from communication.models import ContactRequest, ContactRequestStatus
    
    if user.role not in ["superuser", "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    contact = db.query(ContactRequest).filter(ContactRequest.id == request_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact request not found")
    
    try:
        contact.status = ContactRequestStatus(update.status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status value")
    
    if update.admin_notes:
        contact.admin_notes = update.admin_notes
    
    if update.status == "RESOLVED":
        contact.resolved_at = datetime.now()
        contact.resolved_by_id = str(user.id)
    
    db.commit()
    
    return {"message": "Contact request updated", "status": contact.status.value}


@router.post("/admin/contact-requests/{request_id}/reply")
def reply_to_contact_request(
    request_id: str,
    reply: ContactReplyRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Send email reply to contact request. SuperUser only."""
    from communication.models import ContactRequest, ContactRequestStatus
    
    if user.role not in ["superuser", "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    contact = db.query(ContactRequest).filter(ContactRequest.id == request_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact request not found")
    
    # Update status to IN_PROGRESS if still NEW
    if contact.status == ContactRequestStatus.NEW:
        contact.status = ContactRequestStatus.IN_PROGRESS
        db.commit()
    
    # Send reply email in background
    background_tasks.add_task(
        send_contact_reply,
        contact.email,
        contact.name,
        contact.subject,
        reply.message
    )
    
    return {"message": f"Reply sent to {contact.email}"}


def send_contact_reply(
    to_email: str,
    name: str,
    original_subject: str,
    reply_message: str
):
    """Background task to send reply email."""
    from core.email_service import email_service
    
    email_service.send_contact_reply(
        to_email=to_email,
        name=name,
        original_subject=original_subject,
        reply_message=reply_message
    )


