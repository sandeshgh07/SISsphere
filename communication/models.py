from sqlalchemy import Column, String, ForeignKey, DateTime, Text, Enum, Index, UniqueConstraint, Boolean
from database import Base
from datetime import datetime, timezone
import uuid
import enum

def generate_uuid():
    return str(uuid.uuid4())

class ComplaintStatus(str, enum.Enum):
    NEW = "NEW"
    UNDER_REVIEW = "UNDER_REVIEW"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"
    OPEN = "OPEN" # Kept for backward compatibility during migration, treat as NEW

class NoticePriority(str, enum.Enum):
    CRITICAL = "CRITICAL"  # Triggers email immediately
    IMPORTANT = "IMPORTANT"  # No email, but shows in sidebar as priority
    NORMAL = "NORMAL"  # Standard notice

# ... (skipping unchanged classes) ...

class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(ComplaintStatus), default=ComplaintStatus.NEW)
    priority = Column(Enum(NoticePriority), default=NoticePriority.NORMAL)
    severity = Column(String, default="low") 
    
    # Context
    category = Column(String, default="student") # 'student' or 'staff'
    target_user_ids = Column(Text, nullable=True) # JSON list of user IDs being complained about (for staff)
    student_id = Column(String, ForeignKey("students.id"), nullable=True)
    class_or_course_context = Column(String, nullable=True)

    # Visibility Flags
    visible_to_principal = Column(Boolean, default=True)
    visible_to_school_admin = Column(Boolean, default=False)
    visible_to_board = Column(Boolean, default=False)
    visible_to_admin = Column(Boolean, default=False) # Deprecated
    visible_to_parents = Column(Boolean, default=False)
    visible_to_student = Column(Boolean, default=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, onupdate=lambda: datetime.now(timezone.utc))
    created_by_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    # Workflow Fields
    assigned_to_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    assigned_at = Column(DateTime, nullable=True)
    
    status_changed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    status_changed_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("idx_complaints_school_id", "school_id"),
        Index("idx_complaints_school_status", "school_id", "status"),
        Index("idx_complaints_school_created", "school_id", "created_at"),
        Index("idx_complaints_school_assigned", "school_id", "assigned_to_user_id"),
    )


class NoticeDeliveryStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"

class Notice(Base):
    __tablename__ = "notices"

    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    priority = Column(Enum(NoticePriority), default=NoticePriority.NORMAL)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    author_id = Column(String, ForeignKey("users.id"), nullable=False)

    # Scheduling & Expiry
    scheduled_at = Column(DateTime, nullable=True) # If null, posted immediately
    expires_at = Column(DateTime, nullable=True)   # If null, never expires
    
    # Acknowledgment
    require_ack = Column(Boolean, default=False)

    __table_args__ = (
        Index("idx_notices_school_id", "school_id"),
        Index("idx_notices_scheduled", "scheduled_at"),
    )

class NoticeAck(Base):
    __tablename__ = "notice_acks"
    id = Column(String, primary_key=True, default=generate_uuid)
    notice_id = Column(String, ForeignKey("notices.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    seen_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    ack_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint('notice_id', 'user_id', name='uq_notice_ack_user'),
        Index("idx_notice_acks_notice", "notice_id"),
    )

class NoticeRole(Base):
    __tablename__ = "notice_roles"
    id = Column(String, primary_key=True, default=generate_uuid)
    notice_id = Column(String, ForeignKey("notices.id"), nullable=False)
    role = Column(String, nullable=False)

class NoticeGrade(Base):
    __tablename__ = "notice_grades"
    id = Column(String, primary_key=True, default=generate_uuid)
    notice_id = Column(String, ForeignKey("notices.id"), nullable=False)
    grade_id = Column(String, ForeignKey("grades.id"), nullable=False)

class NoticeSection(Base):
    __tablename__ = "notice_sections"
    id = Column(String, primary_key=True, default=generate_uuid)
    notice_id = Column(String, ForeignKey("notices.id"), nullable=False)
    section_id = Column(String, ForeignKey("sections.id"), nullable=False)

class NoticeStudent(Base):
    __tablename__ = "notice_students"
    id = Column(String, primary_key=True, default=generate_uuid)
    notice_id = Column(String, ForeignKey("notices.id"), nullable=False)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)

class NoticeDelivery(Base):
    __tablename__ = "notice_deliveries"
    id = Column(String, primary_key=True, default=generate_uuid)
    notice_id = Column(String, ForeignKey("notices.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    channel = Column(String, default="EMAIL") # EMAIL, SMS, PUSH
    status = Column(Enum(NoticeDeliveryStatus), default=NoticeDeliveryStatus.PENDING)
    sent_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint('notice_id', 'user_id', 'channel', name='uq_notice_user_channel'),
        Index("idx_notice_deliveries_status", "status"),
    )


class ComplaintParticipant(Base):
    __tablename__ = "complaint_participants"
    id = Column(String, primary_key=True, default=generate_uuid)
    complaint_id = Column(String, ForeignKey("complaints.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)

    __table_args__ = (
        Index("idx_cp_complaint_user", "complaint_id", "user_id"),
    )

class ComplaintMessage(Base):
    __tablename__ = "complaint_messages"
    id = Column(String, primary_key=True, default=generate_uuid)
    complaint_id = Column(String, ForeignKey("complaints.id"), nullable=False)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False) # True = Only visible to staff
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_cm_complaint_id", "complaint_id"),
    )

class Agreement(Base):
    __tablename__ = "agreements"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_agreements_school_id", "school_id"),
    )

class AgreementAcknowledgement(Base):
    __tablename__ = "agreement_acknowledgements"
    id = Column(String, primary_key=True, default=generate_uuid)
    agreement_id = Column(String, ForeignKey("agreements.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    signed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    ip_address = Column(String, nullable=True)

    __table_args__ = (
        UniqueConstraint('agreement_id', 'user_id', name='uq_agreement_user'),
        Index("idx_agreement_acks_agreement", "agreement_id"),
    )


class ContactRequestStatus(str, enum.Enum):
    NEW = "NEW"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"


class ContactRequest(Base):
    """Corporate contact form submissions for Classa platform inquiries."""
    __tablename__ = "contact_requests"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    school_name = Column(String, nullable=True)  # Optional
    message = Column(Text, nullable=False)
    status = Column(Enum(ContactRequestStatus), default=ContactRequestStatus.NEW)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime, nullable=True)
    resolved_by_id = Column(String, ForeignKey("users.id"), nullable=True)
    admin_notes = Column(Text, nullable=True)

    __table_args__ = (
        Index("idx_contact_requests_status", "status"),
        Index("idx_contact_requests_created", "created_at"),
    )
