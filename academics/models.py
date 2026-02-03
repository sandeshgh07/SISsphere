from sqlalchemy import Column, String, ForeignKey, Integer, Index, Boolean, Date, UniqueConstraint, Enum, JSON, Float, Text, DateTime
from database import Base
import uuid
import enum
from datetime import datetime, timezone

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


# --- NEW PERIOD SCHEDULING MODELS ---

class ScheduleTemplate(Base):
    __tablename__ = "schedule_templates"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False) # e.g. "Regular 8 Periods", "Good Friday 4"
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    
    # Structure remains flexible JSON but now part of a reusable template
    # Format: [ { "label": "P1", "start": "09:00", "end": "09:45", "type": "CLASS" }, ... ]
    structure = Column(JSON, nullable=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_schedule_templates_school", "school_id"),
    )

class ScheduleWeeklyRule(Base):
    __tablename__ = "schedule_weekly_rules"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    
    # One row per school (or per academic year if we want to version it, keeping it simple per school for now)
    # Mapping: { "Sunday": template_id, "Monday": template_id, ... }
    day_rules = Column(JSON, nullable=False) 
    
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_schedule_weekly_rules_school", "school_id"),
    )

class ScheduleGradeMapping(Base):
    __tablename__ = "schedule_grade_mappings"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    grade_id = Column(String, ForeignKey("grades.id"), nullable=False)
    
    # Strategy: "INHERIT" (use weekly rules) or "CUSTOM" (use specific template for regular days)
    # If CUSTOM, which template is the "default" for this grade? 
    # Or maybe it needs its own weekly map? 
    # Plan said: "Default template dropdown" + "Inherit weekly pattern checkbox"
    
    inherit_weekly = Column(Boolean, default=True)
    default_template_id = Column(String, ForeignKey("schedule_templates.id"), nullable=True) # Used if inherit_weekly is False (OR as base override)
    
    __table_args__ = (
        Index("idx_schedule_grade_mappings_school_grade", "school_id", "grade_id"),
        UniqueConstraint('school_id', 'grade_id', name='uq_schedule_grade_mapping')
    )

class ScheduleOverride(Base):
    __tablename__ = "schedule_overrides"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    
    name = Column(String, nullable=False) # "Exam Week"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    
    # Scope: specific grades or whole school?
    # If null, applies to whole school
    target_grade_ids = Column(JSON, nullable=True) # List of grade_ids ["g1", "g2"]
    
    # The Rule:
    # { "days": ["Friday"], "template_id": "..." } -> On Fridays in this range, use this template
    # OR simple mapping { "Monday": "tpl_id", ... } 
    # Plan says: "Day-of-week selector", "Choose replacement template"
    # We can store a rule object: { "affected_days": ["Friday"], "template_id": "xyz" }
    rule_config = Column(JSON, nullable=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_schedule_overrides_dates", "school_id", "start_date", "end_date"),
    )

# Deprecated but kept for safe migration if needed
class PeriodStructure(Base):
    __tablename__ = "period_structures"
    id = Column(String, primary_key=True, default=generate_uuid)
    academic_year_id = Column(String, ForeignKey("academic_years.id"), nullable=True) 
    structure = Column(JSON, nullable=False)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    __table_args__ = (
        Index("idx_period_structures_school", "school_id"),
    )

# --- NEW SECTION SUBJECT MAPPING MODELS ---

class SectionSubjectTimetable(Base):
    __tablename__ = "section_subject_timetables"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    academic_year_id = Column(String, ForeignKey("academic_years.id"), nullable=False)
    grade_id = Column(String, ForeignKey("grades.id"), nullable=False)
    section_id = Column(String, ForeignKey("sections.id"), nullable=False)
    
    day_pattern_key = Column(String, nullable=False) # e.g. "REGULAR", "FRIDAY"
    period_index = Column(Integer, nullable=False) # 1..N
    
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=True) 
    grade_subject_id = Column(String, ForeignKey("grade_subjects.id"), nullable=True) # New scoped link 
    
    created_by_user_id = Column(String, nullable=True)
    updated_by_user_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        Index("idx_timetable_lookup", "school_id", "academic_year_id", "grade_id", "section_id"),
        UniqueConstraint('school_id', 'academic_year_id', 'grade_id', 'section_id', 'day_pattern_key', 'period_index', name='uq_timetable_slot')
    )

class ClassTeacherAssignment(Base):
    __tablename__ = "class_teacher_assignments"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    academic_year_id = Column(String, ForeignKey("academic_years.id"), nullable=False)
    grade_id = Column(String, ForeignKey("grades.id"), nullable=False)
    section_id = Column(String, ForeignKey("sections.id"), nullable=False)
    
    teacher_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    source = Column(String, default="AUTO_FROM_P1") # AUTO_FROM_P1, MANUAL_OVERRIDE
    derived_from_day_pattern_key = Column(String, nullable=True, default="REGULAR")
    
    created_by_user_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        Index("idx_class_teacher_lookup", "school_id", "academic_year_id", "grade_id", "section_id"),
        UniqueConstraint('school_id', 'academic_year_id', 'grade_id', 'section_id', name='uq_class_teacher_assignment')
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

# --- NEW SUBJECT SCOPING & BOOK MODELS ---

class GradeSubject(Base):
    __tablename__ = "grade_subjects"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    academic_year_id = Column(String, ForeignKey("academic_years.id"), nullable=False)
    grade_id = Column(String, ForeignKey("grades.id"), nullable=False)
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=False)
    
    type = Column(String, default="CORE") # CORE, ELECTIVE, OPTIONAL
    is_active = Column(Boolean, default=True)
    
    __table_args__ = (
        Index("idx_grade_subjects_lookup", "school_id", "academic_year_id", "grade_id"),
        UniqueConstraint('school_id', 'academic_year_id', 'grade_id', 'subject_id', name='uq_grade_subject_scoped')
    )

class GradeSubjectBookVersion(Base):
    __tablename__ = "grade_subject_book_versions"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    grade_subject_id = Column(String, ForeignKey("grade_subjects.id"), nullable=False)
    
    title = Column(String, nullable=False)
    publisher = Column(String, nullable=True)
    edition = Column(String, nullable=True)
    
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        Index("idx_book_versions_grade_subject", "school_id", "grade_subject_id"),
    )

class TeachingAssignment(Base):
    __tablename__ = "teaching_assignments"
    id = Column(String, primary_key=True, default=generate_uuid)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    academic_year_id = Column(String, ForeignKey("academic_years.id"), nullable=False)
    
    teacher_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    grade_id = Column(String, ForeignKey("grades.id"), nullable=False)
    section_id = Column(String, ForeignKey("sections.id"), nullable=False) # Made required as per plan A3 "Section (dropdown) — required (for now)"
    
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=False) # New required field
    is_class_teacher = Column(Boolean, default=False) # New field

    grade_subject_id = Column(String, ForeignKey("grade_subjects.id"), nullable=True) # Kept for compatibility but nullable
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        Index("idx_teaching_assignments_teacher", "school_id", "academic_year_id", "teacher_user_id"),
        UniqueConstraint('school_id', 'academic_year_id', 'teacher_user_id', 'grade_id', 'section_id', 'subject_id', name='uq_teaching_assignment_v2')
    )

class BaseModel(Base):
    __abstract__ = True

