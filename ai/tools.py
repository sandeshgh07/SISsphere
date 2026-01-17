from sqlalchemy.orm import Session
from sqlalchemy import func
from attendance.models import Attendance, AttendanceStatus
from academics.models import MarksEntry, Subject, ExamTerm
from finance.models import Fee
from students.models import Student

def get_student_attendance(student_id: str, school_id: str, db: Session):
    """
    Returns attendance summary for a student.
    Ensures data is scoped to the given school_id.
    """
    total_days = db.query(func.count(Attendance.id)).filter(
        Attendance.student_id == student_id,
        Attendance.school_id == school_id
    ).scalar()

    present_days = db.query(func.count(Attendance.id)).filter(
        Attendance.student_id == student_id,
        Attendance.school_id == school_id,
        Attendance.status == AttendanceStatus.PRESENT
    ).scalar()

    absent_days = db.query(func.count(Attendance.id)).filter(
        Attendance.student_id == student_id,
        Attendance.school_id == school_id,
        Attendance.status == AttendanceStatus.ABSENT
    ).scalar()

    return {
        "total_days": total_days,
        "present": present_days,
        "absent": absent_days,
        "attendance_percentage": (present_days / total_days * 100) if total_days and total_days > 0 else 0
    }

def get_student_grades(student_id: str, school_id: str, db: Session):
    """
    Returns list of grades for a student.
    Ensures data is scoped to the given school_id.
    """
    results = db.query(MarksEntry, Subject.name, ExamTerm.name).join(
        Subject, MarksEntry.subject_id == Subject.id
    ).join(
        ExamTerm, MarksEntry.exam_term_id == ExamTerm.id
    ).filter(
        MarksEntry.student_id == student_id,
        MarksEntry.school_id == school_id
    ).all()

    grades = []
    for mark, subject_name, term_name in results:
        grades.append({
            "subject": subject_name,
            "term": term_name,
            "marks_obtained": mark.marks_obtained,
            "total_marks": mark.total_marks,
            "published": mark.is_published
        })
    return grades

def get_fee_balance(student_id: str, school_id: str, db: Session):
    """
    Returns pending fee balance for a student.
    Ensures data is scoped to the given school_id.
    """
    pending_fees = db.query(Fee).filter(
        Fee.student_id == student_id,
        Fee.school_id == school_id,
        Fee.status == "pending"
    ).all()

    total_due = sum(fee.amount for fee in pending_fees)

    return {
        "total_due": total_due,
        "details": [{"description": f.description, "amount": f.amount, "due_date": str(f.due_date)} for f in pending_fees]
    }
