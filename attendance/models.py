import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, ForeignKey, Date, DateTime, Enum, Index, UniqueConstraint
from database import Base

def generate_uuid():
    return str(uuid.uuid4())

class AttendanceStatus(str, enum.Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LATE = "LATE"

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(String, primary_key=True, default=generate_uuid)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    grade_id = Column(String, ForeignKey("grades.id"), nullable=False)
    section_id = Column(String, ForeignKey("sections.id"), nullable=False)
    status = Column(Enum(AttendanceStatus), nullable=False)
    date = Column(Date, nullable=False)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    
    recorded_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    note = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_attendance_school_student_date", "school_id", "student_id", "date"),
        Index("idx_attendance_school_grade_section_date", "school_id", "grade_id", "section_id", "date"),
        Index("idx_attendance_recorded_by", "school_id", "recorded_by_user_id"),
        UniqueConstraint('school_id', 'date', 'section_id', 'student_id', name='uq_attendance_student_day'),
    )

class GatePassType(str, enum.Enum):
    NORMAL = "NORMAL"
    SUPER = "SUPER"

class GatePassStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    USED = "USED"
    EXPIRED = "EXPIRED"

class GatePass(Base):
    __tablename__ = "gate_passes"

    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    pass_type = Column(Enum(GatePassType), nullable=False)
    
    issuer_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    issuer_role_used = Column(String, nullable=False)
    
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    
    # SuperPass Details / Normal Pass Metadata
    sent_with_name = Column(String, nullable=True)
    sent_with_relation = Column(String, nullable=True)
    sent_with_phone = Column(String, nullable=True)
    reason = Column(String, nullable=True) # Required for SuperPass
    
    status = Column(Enum(GatePassStatus), default=GatePassStatus.ACTIVE)
    
    expires_at = Column(Date, nullable=False) # or DateTime
    # Let's use DateTime for precision
    expires_at_dt = Column(DateTime, nullable=False) # Renaming to avoid conflict if any, or just use expires_at

    used_at = Column(DateTime, nullable=True)
    used_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_gate_pass_school_status", "school_id", "status"),
        Index("idx_gate_pass_student", "school_id", "student_id"),
    )
