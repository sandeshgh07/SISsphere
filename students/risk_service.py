from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timezone, timedelta
from students.models import Student, StudentRiskAlert, RiskSeverity
from attendance.models import Attendance, AttendanceStatus
from academics.models import MarksEntry, ExamTerm
from finance.models import Fee

def check_student_risks(db: Session):
    students = db.query(Student).filter(Student.is_active == True).all()

    for student in students:
        risks = []

        # 1. Attendance Check
        total_days = db.query(func.count(Attendance.id)).filter(
            Attendance.student_id == student.id
        ).scalar()

        present_days = db.query(func.count(Attendance.id)).filter(
            Attendance.student_id == student.id,
            Attendance.status == AttendanceStatus.PRESENT
        ).scalar()

        if total_days > 0:
            pct = (present_days / total_days) * 100
            if pct < 75.0:
                risks.append({
                    "type": "ATTENDANCE",
                    "severity": RiskSeverity.HIGH,
                    "description": f"Attendance is {pct:.1f}% (below 75% threshold)"
                })

        # 2. Grade Drop Check
        terms = db.query(ExamTerm).filter(
            ExamTerm.school_id == student.school_id,
            ExamTerm.start_date.isnot(None)
        ).order_by(desc(ExamTerm.start_date)).limit(2).all()

        if len(terms) >= 2:
            current = terms[0]
            prev = terms[1]

            avg_curr = db.query(func.avg(MarksEntry.marks_obtained)).filter(
                MarksEntry.student_id == student.id,
                MarksEntry.exam_term_id == current.id,
                MarksEntry.is_published == True
            ).scalar()

            avg_prev = db.query(func.avg(MarksEntry.marks_obtained)).filter(
                MarksEntry.student_id == student.id,
                MarksEntry.exam_term_id == prev.id,
                MarksEntry.is_published == True
            ).scalar()

            if avg_curr and avg_prev and avg_prev > 0:
                drop_pct = ((avg_prev - avg_curr) / avg_prev) * 100
                if drop_pct > 15.0:
                     risks.append({
                        "type": "ACADEMIC",
                        "severity": RiskSeverity.HIGH,
                        "description": f"Grade drop of {drop_pct:.1f}% vs last term"
                    })

        # 3. Fees Overdue Check (30 days)
        # Use datetime.now(timezone.utc) and ensure due_date is compared correctly.
        # Assuming due_date in DB is naive or UTC. Models say DateTime.

        now_utc = datetime.now(timezone.utc)
        thirty_days_ago = now_utc - timedelta(days=30)
        # Note: If due_date is naive, we might need to strip tzinfo from thirty_days_ago
        # or add it to DB field via cast. But standard practice in this codebase seems to be using aware objects.

        overdue_fees = db.query(Fee).filter(
            Fee.student_id == student.id,
            Fee.status == "pending",
            Fee.due_date < thirty_days_ago.replace(tzinfo=None) # Fallback if DB is naive
        ).all()
        # If DB stores naive, the above .replace(tzinfo=None) compares naive with naive.
        # If DB stores aware, it might complain.
        # But SQLite usually stores strings.
        # Let's try standard comparison first, if it fails we catch it.
        # Actually, let's look at how Fee is created. `datetime.now(timezone.utc)`.
        # So it should be aware if the driver supports it, or string.
        # I'll stick to naive comparison for safety with SQLite often used in dev.

        if overdue_fees:
            amount = sum(f.amount for f in overdue_fees)
            risks.append({
                "type": "FINANCIAL",
                "severity": RiskSeverity.HIGH,
                "description": f"Fees overdue by >30 days. Total: {amount}"
            })

        for risk in risks:
            existing = db.query(StudentRiskAlert).filter(
                StudentRiskAlert.student_id == student.id,
                StudentRiskAlert.type == risk["type"],
                StudentRiskAlert.is_resolved == False
            ).first()

            if not existing:
                alert = StudentRiskAlert(
                    student_id=student.id,
                    school_id=student.school_id,
                    type=risk["type"],
                    severity=risk["severity"],
                    description=risk["description"]
                )
                db.add(alert)

    db.commit()
