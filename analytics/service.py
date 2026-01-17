from sqlalchemy.orm import Session
from sqlalchemy import func, desc, case, and_
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any

from schools import models as school_models
from students import models as student_models
from attendance import models as attendance_models
from academics import models as academic_models
from finance import models as finance_models

class FinanceAnalyticsService:
    def __init__(self, db: Session, school_id: str):
        self.db = db
        # Ensure school_id is string for Payment queries
        self.school_id = str(school_id)

    def get_three_day_rolling_revenue(self) -> Dict[str, Any]:
        """
        Returns total collected revenue for: Today, Yesterday, and the Day Before Yesterday.
        Calculates Percentage Trend (up/down).
        Distinguishes between OFFICE_CASH and REMOTE sources.
        """
        today = datetime.now(timezone.utc).date()
        yesterday = today - timedelta(days=1)
        day_before = today - timedelta(days=2)

        target_dates = [today, yesterday, day_before]

        # Query
        results = self.db.query(
            func.date(finance_models.Payment.created_at).label('payment_date'),
            func.sum(finance_models.Payment.amount).label('total_amount'),
            func.sum(case((finance_models.Payment.gateway == 'OFFICE_CASH', finance_models.Payment.amount), else_=0)).label('cash_amount'),
            func.sum(case((finance_models.Payment.gateway != 'OFFICE_CASH', finance_models.Payment.amount), else_=0)).label('remote_amount')
        ).filter(
            finance_models.Payment.school_id == self.school_id,
            finance_models.Payment.status == 'SUCCEEDED',
            func.date(finance_models.Payment.created_at).in_(target_dates)
        ).group_by(
            func.date(finance_models.Payment.created_at)
        ).all()

        # Format Data
        data_map = {r.payment_date: r for r in results}

        # Helper to safely get data
        def get_day_data(date_obj):
            # SQLAlchemy returns date objects or strings depending on backend/driver.
            # SQLite `func.date` returns string 'YYYY-MM-DD'. Postgres might return date object.
            # We'll try string lookup first.
            date_str = date_obj.isoformat()

            # Look for exact match (string) or date object match
            row = None
            for key, val in data_map.items():
                if str(key) == date_str:
                    row = val
                    break

            if not row:
                return {"total": 0.0, "cash": 0.0, "remote": 0.0}

            return {
                "total": row.total_amount or 0.0,
                "cash": row.cash_amount or 0.0,
                "remote": row.remote_amount or 0.0
            }

        today_data = get_day_data(today)
        yesterday_data = get_day_data(yesterday)
        day_before_data = get_day_data(day_before)

        # Calculate Trends
        def calc_trend(current, previous):
            if previous == 0:
                return 100.0 if current > 0 else 0.0
            return ((current - previous) / previous) * 100.0

        trend_today = calc_trend(today_data["total"], yesterday_data["total"])
        trend_yesterday = calc_trend(yesterday_data["total"], day_before_data["total"])

        return {
            "today": {
                "date": today.isoformat(),
                "metrics": today_data,
                "trend_vs_yesterday": round(trend_today, 1)
            },
            "yesterday": {
                "date": yesterday.isoformat(),
                "metrics": yesterday_data,
                "trend_vs_day_before": round(trend_yesterday, 1)
            },
            "day_before": {
                "date": day_before.isoformat(),
                "metrics": day_before_data
            }
        }

class AnalyticsService:
    """
    Legacy Service for Reports Module compatibility.
    Wraps the new StudentHealthService or implements direct logic.
    """
    def get_student_academic_trend(self, db: Session, student_id: str) -> List[Dict[str, Any]]:
        # Map to new service method logic
        # But wait, new service requires db in init.
        # Reports service passes db in method.
        # I'll just adapt the code here to avoid changing reports module too much.

        # Copied from StudentHealthService.get_academic_trend but taking db as arg
        # And keeping return format compatible with Reports if needed (check reports/service.py usage)
        # Reports/service uses: t['term'], t['average']

        # Actually I can just reuse the code
        school_id = db.query(student_models.Student.school_id).filter(student_models.Student.id == student_id).scalar()
        if not school_id: return []

        one_year_ago = datetime.now(timezone.utc).date() - timedelta(days=365)
        terms = db.query(academic_models.ExamTerm).filter(
            academic_models.ExamTerm.school_id == school_id,
            academic_models.ExamTerm.start_date >= one_year_ago
        ).order_by(academic_models.ExamTerm.start_date).all()

        trend = []
        for term in terms:
            avg = db.query(func.avg(academic_models.MarksEntry.marks_obtained)).filter(
                academic_models.MarksEntry.student_id == student_id,
                academic_models.MarksEntry.exam_term_id == term.id
            ).scalar()

            if avg is not None:
                trend.append({
                    "term": term.name,
                    "average": round(avg, 2),
                    "date": term.start_date
                })
        return trend

    def get_student_attendance_heatmap(self, db: Session, student_id: str) -> List[Dict[str, Any]]:
        # Compatible with ReportService._generate_heatmap_graph which expects:
        # d['date'], d['status']

        today = datetime.now(timezone.utc).date()
        cutoff = today - timedelta(days=90) # Report says 90 days in title

        records = db.query(attendance_models.Attendance).filter(
            attendance_models.Attendance.student_id == student_id,
            attendance_models.Attendance.date >= cutoff
        ).all()

        return [{"date": r.date, "status": r.status} for r in records]


class StudentHealthService:
    def __init__(self, db: Session, school_id: str):
        self.db = db
        self.school_id = school_id

    def get_academic_trend(self, student_id: str) -> List[Dict[str, Any]]:
        # Last 12 months average marks per term
        # Since terms might not be monthly, we map Term Start Date -> Avg Mark

        # Get terms in last 12 months
        one_year_ago = datetime.now(timezone.utc).date() - timedelta(days=365)
        terms = self.db.query(academic_models.ExamTerm).filter(
            academic_models.ExamTerm.school_id == self.school_id,
            academic_models.ExamTerm.start_date >= one_year_ago
        ).order_by(academic_models.ExamTerm.start_date).all()

        trend = []
        for term in terms:
            avg = self.db.query(func.avg(academic_models.MarksEntry.marks_obtained)).filter(
                academic_models.MarksEntry.student_id == student_id,
                academic_models.MarksEntry.exam_term_id == term.id
            ).scalar()

            if avg is not None:
                trend.append({
                    "term": term.name, # Changed x to term for frontend
                    "average": round(avg, 2), # Changed y to average for frontend
                    "date": term.start_date.isoformat() if term.start_date else None
                })
        return trend

    def get_attendance_heatmap(self, student_id: str) -> List[Dict[str, Any]]:
        # Last 30 days
        today = datetime.now(timezone.utc).date()
        cutoff = today - timedelta(days=30)

        records = self.db.query(attendance_models.Attendance).filter(
            attendance_models.Attendance.student_id == student_id,
            attendance_models.Attendance.date >= cutoff
        ).all()

        # Create a map for quick lookup
        attendance_map = {r.date: r.status for r in records}

        heatmap = []
        # Fill all 30 days
        for i in range(31):
            date = cutoff + timedelta(days=i)
            status = attendance_map.get(date, "NO_RECORD")
            # 1 for Present, 0 for Absent, -1 for No Record/Holiday?
            # Or just string for frontend to color
            val = 0
            if status == attendance_models.AttendanceStatus.PRESENT:
                val = 1
            elif status == attendance_models.AttendanceStatus.ABSENT:
                val = 0
            else:
                val = -1 # Late or No Record

            heatmap.append({
                "date": date.isoformat(),
                "value": val,
                "status": status.value if hasattr(status, 'value') else status
            })

        return heatmap

    def calculate_risk_score(self, student_id: str) -> int:
        score = 100
        today = datetime.now(timezone.utc).date()

        # 1. Attendance Check (Last 30 days)
        cutoff = today - timedelta(days=30)
        total = self.db.query(func.count(attendance_models.Attendance.id)).filter(
            attendance_models.Attendance.student_id == student_id,
            attendance_models.Attendance.date >= cutoff
        ).scalar()

        if total > 0:
            present = self.db.query(func.count(attendance_models.Attendance.id)).filter(
                attendance_models.Attendance.student_id == student_id,
                attendance_models.Attendance.date >= cutoff,
                attendance_models.Attendance.status == attendance_models.AttendanceStatus.PRESENT
            ).scalar()
            pct = (present / total) * 100
            if pct < 50:
                score -= 40
            elif pct < 75:
                score -= 20

        # 2. Grade Check (Trend)
        # Get last 2 terms
        terms = self.db.query(academic_models.ExamTerm).filter(
            academic_models.ExamTerm.school_id == self.school_id
        ).order_by(desc(academic_models.ExamTerm.start_date)).limit(2).all()

        # Handle naive datetime comparison in sort if needed, but db query does it.
        # But wait, start_date can be None.
        # Ideally we filtered for non-null or handled it.
        # Assuming sorted by DB correctly if date is present.

        if len(terms) >= 2:
            t1 = terms[0] # Newest
            t2 = terms[1]

            avg1 = self.db.query(func.avg(academic_models.MarksEntry.marks_obtained)).filter(
                academic_models.MarksEntry.student_id == student_id,
                academic_models.MarksEntry.exam_term_id == t1.id
            ).scalar() or 0

            avg2 = self.db.query(func.avg(academic_models.MarksEntry.marks_obtained)).filter(
                academic_models.MarksEntry.student_id == student_id,
                academic_models.MarksEntry.exam_term_id == t2.id
            ).scalar() or 0

            if avg2 > 0:
                drop = (avg2 - avg1) / avg2
                if drop > 0.2: # 20% drop
                    score -= 30
                elif drop > 0.1: # 10% drop
                    score -= 15

        # 3. Existing Alerts
        alerts = self.db.query(student_models.StudentRiskAlert).filter(
            student_models.StudentRiskAlert.student_id == student_id,
            student_models.StudentRiskAlert.is_resolved == False
        ).all()

        for alert in alerts:
            if alert.severity == student_models.RiskSeverity.HIGH:
                score -= 20
            elif alert.severity == student_models.RiskSeverity.MEDIUM:
                score -= 10

        return max(0, min(100, score))

    def get_teacher_value_add(self, student_id: str) -> List[Dict[str, Any]]:
        # Compare grade change per subject, attribute to teacher
        # Reuse logic from resource-insights but for single student

        student = self.db.query(student_models.Student).filter(student_models.Student.id == student_id).first()
        if not student or not student.grade_id or not student.section_id:
            return []

        # Get assignments for this student's section
        assignments = self.db.query(academic_models.TeacherAssignment).filter(
            academic_models.TeacherAssignment.grade_id == student.grade_id,
            academic_models.TeacherAssignment.section_id == student.section_id,
            academic_models.TeacherAssignment.school_id == self.school_id
        ).all()

        # Last 2 terms
        terms = self.db.query(academic_models.ExamTerm).filter(
            academic_models.ExamTerm.school_id == self.school_id
        ).order_by(desc(academic_models.ExamTerm.start_date)).limit(2).all()

        if len(terms) < 2:
            return []

        t1 = terms[0] # Newest
        t2 = terms[1] # Oldest (Previous)

        results = []
        for assign in assignments:
            if not assign.subject_id:
                continue

            m1 = self.db.query(academic_models.MarksEntry.marks_obtained).filter(
                academic_models.MarksEntry.student_id == student_id,
                academic_models.MarksEntry.exam_term_id == t2.id, # Previous
                academic_models.MarksEntry.subject_id == assign.subject_id
            ).scalar()

            m2 = self.db.query(academic_models.MarksEntry.marks_obtained).filter(
                academic_models.MarksEntry.student_id == student_id,
                academic_models.MarksEntry.exam_term_id == t1.id, # Current
                academic_models.MarksEntry.subject_id == assign.subject_id
            ).scalar()

            if m1 is not None and m2 is not None:
                delta = m2 - m1
                teacher = self.db.query(school_models.User).filter(school_models.User.id == assign.teacher_id).first()
                subject = self.db.query(academic_models.Subject).filter(academic_models.Subject.id == assign.subject_id).first()

                results.append({
                    "teacher_name": f"{teacher.first_name} {teacher.last_name}" if teacher else "Unknown",
                    "subject": subject.name if subject else "Unknown",
                    "value_add": delta
                })
        return results

    def get_subject_comparison(self, student_id: str) -> List[Dict[str, Any]]:
        # Average marks per subject (current/latest term)
        terms = self.db.query(academic_models.ExamTerm).filter(
            academic_models.ExamTerm.school_id == self.school_id
        ).order_by(desc(academic_models.ExamTerm.start_date)).first()

        if not terms:
            return []

        term_id = terms.id

        results = self.db.query(
            academic_models.Subject.name,
            academic_models.MarksEntry.marks_obtained
        ).join(
            academic_models.MarksEntry, academic_models.MarksEntry.subject_id == academic_models.Subject.id
        ).filter(
            academic_models.MarksEntry.student_id == student_id,
            academic_models.MarksEntry.exam_term_id == term_id
        ).all()

        return [{"subject": r.name, "marks": r.marks_obtained} for r in results]

    def get_fee_invoices(self, student_id: str) -> List[Dict[str, Any]]:
        fees = self.db.query(finance_models.Fee).filter(
            finance_models.Fee.student_id == student_id
        ).all()

        return [
            {
                "id": f.id,
                "amount": f.amount,
                "description": f.description,
                "status": f.status,
                "due_date": f.due_date.isoformat() if f.due_date else None,
                "paid_date": f.paid_date.isoformat() if f.paid_date else None,
                "receipt_url": f.receipt_url
            }
            for f in fees
        ]
