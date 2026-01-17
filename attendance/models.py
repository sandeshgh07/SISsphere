from sqlalchemy import Column, String, ForeignKey, Date, Enum, Index
from database import Base
import uuid
import enum

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

    __table_args__ = (
        Index("idx_attendance_school_student_date", "school_id", "student_id", "date"),
        Index("idx_attendance_school_grade_section_date", "school_id", "grade_id", "section_id", "date"),
    )
