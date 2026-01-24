from sqlalchemy import Column, String, ForeignKey, Integer, Index, Boolean, Date, UniqueConstraint, Enum, JSON, Float, Text, DateTime
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
    is_closed = Column(Boolean, default=False) # New: Lock year
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    __table_args__ = (
        Index("idx_academic_years_school_id", "school_id"),
        Index("idx_academic_years_dates", "start_date", "end_date"),
    )

class Term(Base):
    __tablename__ = "terms"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False) # e.g. "First Term"
    academic_year_id = Column(String, ForeignKey("academic_years.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    weightage = Column(Float, default=0.0) # e.g. 30.0 for 30%
    is_locked = Column(Boolean, default=False)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    
    __table_args__ = (
        Index("idx_terms_school_year", "school_id", "academic_year_id"),
        UniqueConstraint('school_id', 'academic_year_id', 'name', name='uq_terms_school_year_name')
    )

class ExamPeriod(Base):
    __tablename__ = "exam_periods"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False) # e.g. "Mid-Term Exams"
    term_id = Column(String, ForeignKey("terms.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    
    __table_args__ = (
        Index("idx_exam_periods_school_term", "school_id", "term_id"),
    )

class GradingPolicy(Base):
    __tablename__ = "grading_policies"
    id = Column(String, primary_key=True, default=generate_uuid)
    academic_year_id = Column(String, ForeignKey("academic_years.id"), nullable=False)
    
    gpa_scale = Column(String, default="4.0") # "4.0" or "5.0"
    grading_structure = Column(JSON, nullable=True) # List of {label: "A", min: 90, max: 100, gpa: 4.0}
    
    pass_mark = Column(Float, default=40.0)
    full_mark = Column(Float, default=100.0)
    
    weight_rules = Column(JSON, nullable=True) # { "classwork": 20, "exam": 80 }
    
    is_locked = Column(Boolean, default=False)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    
    __table_args__ = (
        Index("idx_grading_policies_school_year", "school_id", "academic_year_id"),
    )

class PromotionRule(Base):
    __tablename__ = "promotion_rules"
    id = Column(String, primary_key=True, default=generate_uuid)
    academic_year_id = Column(String, ForeignKey("academic_years.id"), nullable=False)
    
    rules = Column(JSON, nullable=False) 
    # { "auto_promote": false, "fail_subject_count": 2, "finance_clearance": true }
    
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    
    __table_args__ = (
        Index("idx_promotion_rules_school_year", "school_id", "academic_year_id"),
    )

class PeriodStructure(Base):
    __tablename__ = "period_structures"
    id = Column(String, primary_key=True, default=generate_uuid)
    academic_year_id = Column(String, ForeignKey("academic_years.id"), nullable=True) # Optional, can be global
    
    structure = Column(JSON, nullable=False)
    # { "periods_per_day": 8, "slots": [ { "start": "09:00", "end": "09:45", "type": "class" } ] }
    
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)

    __table_args__ = (
        Index("idx_period_structures_school", "school_id"),
    )

# --- Existing Models below (Updated where needed) ---

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
    
    # New fields
    grade_id = Column(String, ForeignKey("grades.id"), nullable=True) # Made nullable to avoid breaking existing data immediately, but plan says foreignkey
    # Ideally nullable=False for new approach, but legacy data might not have it. 
    # Spec says: subjects (school_id, grade_id, name, ...). 
    
    is_elective = Column(Boolean, default=False)
    assigned_teacher_id = Column(String, ForeignKey("users.id"), nullable=True)
    
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)

    __table_args__ = (
        Index("idx_subjects_school_id_id", "school_id", "id"),
        Index("idx_subjects_grade", "school_id", "grade_id"),
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

# Legacy / Existing ExamTerm (Kept for compatibility)
class ExamTerm(Base):
    __tablename__ = "exam_terms"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False) # e.g., "Mid-Term", "Finals"
    start_date = Column(Date, nullable=True) 
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
    content = Column(JSON, nullable=False) 
    date = Column(Date, nullable=False)
    status = Column(Enum(LessonPlanStatus), default=LessonPlanStatus.PLANNED)


class AssessmentType(Base):
    __tablename__ = "assessment_types"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False) # e.g. "Practical", "Oral", "Assignment"
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    
    __table_args__ = (Index("idx_assessment_types_school_id", "school_id"),)

class Assessment(Base):
    __tablename__ = "assessments"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False) # e.g. "Biology Lab 1"
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=False)
    exam_term_id = Column(String, ForeignKey("exam_terms.id"), nullable=False)
    assessment_type_id = Column(String, ForeignKey("assessment_types.id"), nullable=True) 
    
    max_marks = Column(Integer, nullable=False)
    
    # Enhanced Fields for Assignments/Homework
    description = Column(Text, nullable=True)
    due_date = Column(DateTime, nullable=True)
    
    # Scoping
    grade_id = Column(String, ForeignKey("grades.id"), nullable=True) # If null, implies subject scope (all sections)
    section_id = Column(String, ForeignKey("sections.id"), nullable=True) # If set, specific to this section
    
    created_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        Index("idx_assessments_school_term_subject", "school_id", "exam_term_id", "subject_id"),
    )

class StudentAssessmentScore(Base):
    __tablename__ = "student_assessment_scores"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    
    assessment_id = Column(String, ForeignKey("assessments.id"), nullable=False)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    
    score = Column(Float, nullable=False) 
    
    __table_args__ = (
        Index("idx_student_assessment_scores_perf", "school_id", "assessment_id", "student_id"),
        UniqueConstraint('assessment_id', 'student_id', name='uq_assessment_student')
    )
