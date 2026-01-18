import sys
import os
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
import uuid

# Add the project root to the python path
sys.path.append(os.getcwd())

from database import engine, SessionLocal
import schools.models as school_models
import students.models as student_models
import attendance.models as attendance_models
import academics.models as academic_models
import communication.models as communication_models
import finance.models as finance_models
from datetime import datetime, timedelta, timezone

def verify_setup():
    db = SessionLocal()
    try:
        print("🔍 Verifying Demo Data Setup...")

        # 1. Verify School
        school = db.query(school_models.School).filter(school_models.School.name == "Nepsis International Academy").first()
        if not school:
            print("❌ School not found!")
            return
        print(f"✅ School found: {school.name} ({school.country}) - Tier: {school.subscription_tier}")
        school_id = str(school.id)

        # 2. Verify Principal
        principal = db.query(school_models.User).filter(school_models.User.email == "principal@nepsis.com").first()
        if not principal:
            print("❌ Principal not found!")
        else:
            print(f"✅ Principal found: {principal.first_name} {principal.last_name}")

        # 3. Verify Students
        student_count = db.query(student_models.Student).count()
        print(f"✅ Student count: {student_count} (Expected 20)")
        if student_count != 20:
             print("⚠️ Warning: Student count mismatch.")

        # 4. Verify At-Risk Logic
        print("🔍 Verifying At-Risk Logic...")
        alerts = db.query(student_models.StudentRiskAlert).filter(
            student_models.StudentRiskAlert.school_id == school_id,
            student_models.StudentRiskAlert.severity == student_models.RiskSeverity.HIGH
        ).all()

        print(f"✅ Found {len(alerts)} High Risk Alerts.")
        if len(alerts) < 2:
            print("❌ Not enough At-Risk alerts found!")

        for alert in alerts:
            stu = db.query(student_models.Student).get(alert.student_id)
            print(f"   🚩 At-Risk Student: {stu.first_name} {stu.last_name} ({stu.id})")

            # Check Attendance (Last 30 days)
            today = datetime.now(timezone.utc).date()
            cutoff = today - timedelta(days=30)

            total_att = db.query(func.count(attendance_models.Attendance.id)).filter(
                attendance_models.Attendance.student_id == stu.id,
                attendance_models.Attendance.date >= cutoff
            ).scalar()

            present_att = db.query(func.count(attendance_models.Attendance.id)).filter(
                attendance_models.Attendance.student_id == stu.id,
                attendance_models.Attendance.date >= cutoff,
                attendance_models.Attendance.status == attendance_models.AttendanceStatus.PRESENT
            ).scalar()

            pct = (present_att / total_att * 100) if total_att > 0 else 0
            print(f"      📉 Attendance (Last 30 days): {pct:.1f}% (Should be < 50% usually)")

            # Check Grades (Last Term vs Previous)
            # Find latest term marks
            terms = db.query(academic_models.ExamTerm).filter(
                academic_models.ExamTerm.school_id == school_id
            ).order_by(academic_models.ExamTerm.start_date.desc()).all()

            if len(terms) >= 2:
                t1 = terms[0] # Current
                t2 = terms[1] # Previous

                avg1 = db.query(func.avg(academic_models.MarksEntry.marks_obtained)).filter(
                    academic_models.MarksEntry.student_id == stu.id,
                    academic_models.MarksEntry.exam_term_id == t1.id
                ).scalar()

                avg2 = db.query(func.avg(academic_models.MarksEntry.marks_obtained)).filter(
                    academic_models.MarksEntry.student_id == stu.id,
                    academic_models.MarksEntry.exam_term_id == t2.id
                ).scalar()

                print(f"      📉 Grades: Term 2 Avg: {avg1:.1f}, Term 1 Avg: {avg2:.1f}")

        # 5. Verify Financials
        print("💰 Verifying Financials...")
        inv_count = db.query(finance_models.Invoice).count()
        pay_count = db.query(finance_models.Payment).count()
        print(f"✅ Invoices: {inv_count}, Payments: {pay_count}")

        # Verify Pending Verification Payment
        pending_pay = db.query(finance_models.Payment).filter(
            finance_models.Payment.status == finance_models.PaymentStatus.PENDING,
            finance_models.Payment.receipt_url.isnot(None)
        ).first()

        if pending_pay:
             print(f"✅ Found Pending Verification Payment: {pending_pay.amount} USD (Source: {pending_pay.entry_source})")
        else:
             print("❌ Pending Verification Payment not found!")

        # 6. Verify Notices
        print("📢 Verifying Notices...")
        notice_count = db.query(communication_models.Notice).count()
        print(f"✅ Notices created: {notice_count} (Expected >= 4)")

        print("🎉 Verification Complete.")

    except Exception as e:
        print(f"❌ Verification Failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    verify_setup()
