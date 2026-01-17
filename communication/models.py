from sqlalchemy import Column, String, ForeignKey, DateTime, Text, Enum, Index, UniqueConstraint, Boolean
from database import Base
from datetime import datetime, timezone
import uuid
import enum

def generate_uuid():
    return str(uuid.uuid4())

class ComplaintStatus(str, enum.Enum):
    OPEN = "OPEN"
    RESOLVED = "RESOLVED"

class NoticePriority(str, enum.Enum):
    NORMAL = "NORMAL"
    HIGH = "HIGH"

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

    __table_args__ = (
        Index("idx_notices_school_id", "school_id"),
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

class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    title = Column(String, nullable=False)
    status = Column(Enum(ComplaintStatus), default=ComplaintStatus.OPEN)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_by_id = Column(String, ForeignKey("users.id"), nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("idx_complaints_school_id", "school_id"),
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
