from sqlalchemy import Column, String, ForeignKey, DateTime, Boolean, Index, Enum, JSON, Integer
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timezone
import uuid
import enum

def generate_uuid():
    return str(uuid.uuid4())

class Student(Base):
    __tablename__ = "students"

    id = Column(String, primary_key=True, default=generate_uuid)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    roll_number = Column(String, nullable=False)
    email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)

    # Linked grade, section, academic year
    grade_id = Column(String, ForeignKey("grades.id"), nullable=True)
    grade = relationship("Grade")
    section_id = Column(String, ForeignKey("sections.id"), nullable=True)
    academic_year_id = Column(String, ForeignKey("academic_years.id"), nullable=True)

    # Link to Identity User
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=True)

    retention_flag = Column(Boolean, default=False) # Manual override for promotion

    pickup_blocked = Column(Boolean, default=False)
    pickup_block_reason = Column(String, nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_students_school_id_id", "school_id", "id"),
        Index("idx_students_school_id_created_at", "school_id", "created_at"),
    )

class ParentStudentLink(Base):
    __tablename__ = "parent_student_links"
    id = Column(String, primary_key=True, default=generate_uuid)
    parent_id = Column(String, ForeignKey("users.id"), nullable=False)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    is_authorized_pickup = Column(Boolean, default=True)
    __table_args__ = (Index("idx_ps_links_school_id", "school_id"),)

class SecurityBlock(Base):
    __tablename__ = "security_blocks"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    student_id = Column(String, ForeignKey("students.id"), nullable=True)
    parent_id = Column(String, ForeignKey("users.id"), nullable=True)
    reason = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class RiskSeverity(str, enum.Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class StudentRiskAlert(Base):
    __tablename__ = "student_risk_alerts"
    id = Column(String, primary_key=True, default=generate_uuid)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    type = Column(String, nullable=False) # 'ACADEMIC', 'ATTENDANCE'
    severity = Column(Enum(RiskSeverity), nullable=False)
    description = Column(String, nullable=True)
    action_taken = Column(String, nullable=True)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)

    __table_args__ = (
        Index("idx_risk_alerts_school_student", "school_id", "student_id"),
    )

class AdmissionStatus(str, enum.Enum):
    APPLIED = "APPLIED"
    ELIGIBLE = "ELIGIBLE"
    INELIGIBLE = "INELIGIBLE"
    ENROLLED = "ENROLLED"
    # Keep old ones if needed for backward compatibility during dev, but clean slate preferred
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class AdmissionApplication(Base):
    __tablename__ = "admission_applications"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, nullable=True)

    # New Fields
    age = Column(Integer, nullable=True)
    target_grade = Column(String, nullable=True)
    completed_grade = Column(String, nullable=True)
    previous_school = Column(String, nullable=True)
    parent_name = Column(String, nullable=True)
    transcript_url = Column(String, nullable=True)

    parent_phone = Column(String, nullable=False)
    documents = Column(JSON, nullable=True) # Legacy support
    status = Column(Enum(AdmissionStatus), default=AdmissionStatus.APPLIED)
    submission_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class GateLogType(str, enum.Enum):
    CHECKIN = "CHECKIN"
    CHECKOUT = "CHECKOUT"

class GateLog(Base):
    __tablename__ = "gate_logs"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    scanned_by_id = Column(String, ForeignKey("users.id"), nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    type = Column(Enum(GateLogType), nullable=False)

# --- Student 360 Models ---

class IncidentType(str, enum.Enum):
    DISCIPLINE = "discipline"
    BULLYING = "bullying"
    PROPERTY_DAMAGE = "property_damage"
    LATE = "late"
    OTHER = "other"

class IncidentSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class BehaviorIncident(Base):
    __tablename__ = "behavior_incidents"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    reported_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    incident_type = Column(Enum(IncidentType), nullable=False)
    severity = Column(Enum(IncidentSeverity), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    occurred_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    action_taken = Column(String, nullable=True)
    status = Column(String, default="open") # open, resolved
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_behavior_school_student", "school_id", "student_id"),
    )

class DocumentType(str, enum.Enum):
    REPORT_CARD = "report_card"
    CERTIFICATE = "certificate"
    MEDICAL = "medical"
    OTHER = "other"

class StudentDocument(Base):
    __tablename__ = "student_documents"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    uploaded_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    doc_type = Column(Enum(DocumentType), nullable=False)
    title = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    size_bytes = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_docs_school_student", "school_id", "student_id"),
    )
