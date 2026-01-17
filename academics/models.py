from sqlalchemy import Column, String, ForeignKey, Integer, Index, Boolean, Date, UniqueConstraint, Enum, JSON
from database import Base
import uuid
import enum

def generate_uuid():
    return str(uuid.uuid4())

class AcademicYear(Base):
    __tablename__ = "academic_years"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False) # e.g. "2023-2024"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    __table_args__ = (Index("idx_academic_years_school_id", "school_id"),)

class Section(Base):
    __tablename__ = "sections"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False) # e.g. "Red", "A", "Morning"
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    __table_args__ = (Index("idx_sections_school_id", "school_id"),)

class Grade(Base):
    __tablename__ = "grades"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False) # e.g. "Grade 10"
    sequence = Column(Integer, nullable=False, default=0) # For ordering/promotion
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)

    __table_args__ = (
        Index("idx_grades_school_id_id", "school_id", "id"),
    )

class GradeSection(Base):
    __tablename__ = "grade_sections"
    id = Column(String, primary_key=True, default=generate_uuid)
    grade_id = Column(String, ForeignKey("grades.id"), nullable=False)
    section_id = Column(String, ForeignKey("sections.id"), nullable=False)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    __table_args__ = (Index("idx_grade_sections_school_id", "school_id"),)

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    code = Column(String, nullable=True)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)

    __table_args__ = (
        Index("idx_subjects_school_id_id", "school_id", "id"),
    )

class TeacherAssignment(Base):
    __tablename__ = "teacher_assignments"
    id = Column(String, primary_key=True, default=generate_uuid)
    teacher_id = Column(String, ForeignKey("users.id"), nullable=False)
    grade_id = Column(String, ForeignKey("grades.id"), nullable=True)
    section_id = Column(String, ForeignKey("sections.id"), nullable=True)
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=True)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)

    __table_args__ = (
        Index("idx_teacher_assignments_school_id_id", "school_id", "id"),
    )

class ExamTerm(Base):
    __tablename__ = "exam_terms"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False) # e.g., "Mid-Term", "Finals"
    start_date = Column(Date, nullable=True) # Added for ordering
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    is_active = Column(Boolean, default=True)

    __table_args__ = (
        Index("idx_exam_terms_school_id", "school_id"),
    )

class MarksEntry(Base):
    __tablename__ = "marks_entries"
    id = Column(String, primary_key=True, default=generate_uuid)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=False)
    exam_term_id = Column(String, ForeignKey("exam_terms.id"), nullable=False)
    marks_obtained = Column(Integer, nullable=False)
    total_marks = Column(Integer, nullable=False)
    is_published = Column(Boolean, default=False)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)

    __table_args__ = (
        Index("idx_marks_entries_school_id_student", "school_id", "student_id"),
        Index("idx_marks_entries_school_id_subject", "school_id", "subject_id"),
        UniqueConstraint('student_id', 'subject_id', 'exam_term_id', name='uq_student_subject_term')
    )

class LessonPlanStatus(str, enum.Enum):
    PLANNED = "PLANNED"
    COMPLETED = "COMPLETED"

class LessonPlan(Base):
    __tablename__ = "lesson_plans"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    teacher_id = Column(String, ForeignKey("users.id"), nullable=False)
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=False)
    content = Column(JSON, nullable=False) # JSONB in Postgres, JSON in SQLite/others
    date = Column(Date, nullable=False)
    status = Column(Enum(LessonPlanStatus), default=LessonPlanStatus.PLANNED)
