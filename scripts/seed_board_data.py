import sys
import os
import random
from datetime import datetime, timedelta, timezone

# Add the project root to the python path
sys.path.append(os.getcwd())

from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
from schools.models import School, User
from schools.constants import SubscriptionTier
from communication.models import Complaint, ComplaintStatus
from finance.models import Payment, PaymentStatus, Invoice, InvoiceStatus, EntrySource
from attendance.models import Attendance, AttendanceStatus
from students.models import Student
import academics.models # Import to ensure relationships/FKs are known
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_board_data(school_id: str, principal_id: str):
    db = SessionLocal()
    try:
        print(f"🚀 Seeding Board Data for School {school_id}...")

        # 1. Triple Pulse Data (Revenue Today, Yesterday, Day Before)
        today = datetime.now(timezone.utc).date()
        days = [today, today - timedelta(days=1), today - timedelta(days=2)]

        # Ensure we have students/invoices
        student = db.query(Student).filter(Student.school_id == school_id).first()
        if not student:
            # Create dummy student
            student = Student(
                first_name="Demo", last_name="Student",
                school_id=school_id, roll_number="D001",
                is_active=True
            )
            db.add(student)
            db.commit()
            db.refresh(student)

        # Create Invoice
        invoice = Invoice(
            school_id=school_id,
            student_id=student.id,
            total_amount=50000.0,
            amount_paid=0.0,
            status=InvoiceStatus.PARTIALLY_PAID
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)

        # Seed Triple Pulse Payments
        amounts = [1500.0, 2300.0, 1800.0] # Today, Yesterday, DayBefore
        for i, date_obj in enumerate(days):
            # Create a datetime from the date
            dt = datetime.combine(date_obj, datetime.min.time()).replace(tzinfo=timezone.utc) + timedelta(hours=10)

            pay = Payment(
                school_id=school_id,
                invoice_id=invoice.id,
                amount=amounts[i],
                currency="NPR",
                status=PaymentStatus.SUCCEEDED,
                entry_source=EntrySource.OFFICE_CASH if i % 2 == 0 else EntrySource.REMOTE,
                created_at=dt,
                gateway="OFFICE_CASH" if i % 2 == 0 else "ESEWA"
            )
            db.add(pay)

        # 2. 30-Day Trend (Random scatter)
        start_trend = today - timedelta(days=30)
        for i in range(30):
            if random.random() > 0.3: # 70% of days have revenue
                dt = datetime.combine(start_trend + timedelta(days=i), datetime.min.time()).replace(tzinfo=timezone.utc) + timedelta(hours=12)
                pay = Payment(
                    school_id=school_id,
                    invoice_id=invoice.id,
                    amount=random.uniform(500, 5000),
                    currency="NPR",
                    status=PaymentStatus.SUCCEEDED,
                    entry_source=EntrySource.AUTOMATED,
                    created_at=dt,
                    gateway="KHALTI"
                )
                db.add(pay)

        # 3. Complaints (Resolved time)
        # Create 5 resolved complaints with varying resolution times
        for hours in [2, 5, 24, 48, 1]:
            created = datetime.now(timezone.utc) - timedelta(days=10)
            resolved = created + timedelta(hours=hours)
            comp = Complaint(
                school_id=school_id,
                title=f"Resolved Complaint {hours}h",
                status=ComplaintStatus.RESOLVED,
                created_by_id=principal_id,
                created_at=created,
                resolved_at=resolved
            )
            db.add(comp)

        # 4. Attendance (Reputation Index)
        # Create 10 students with 90% attendance
        for i in range(10):
            s = Student(
                first_name=f"S{i}",
                last_name="Demo",
                school_id=school_id,
                roll_number=f"B{100+i}",
                is_active=True
            )
            db.add(s)
            db.commit() # get ID

            # Add 5 days attendance
            # Create a dummy grade/section if needed or just pass dummy ID if no FK check (usually there is FK check)
            # Actually, attendance requires grade_id and section_id.
            # Let's just create one grade/section for the school if not exists.

            # For simplicity in seeding, we skip attendance creation if it's too complex or requires more dependency.
            # But the user wants analytics.
            # I will just set grade_id/section_id to a dummy value (created above) or fetch existing.
            # Assuming demo data created some.
            grade = db.query(academics.models.Grade).filter(academics.models.Grade.school_id == school_id).first()
            section = db.query(academics.models.Section).filter(academics.models.Section.school_id == school_id).first()

            if grade and section:
                for j in range(5):
                    att_date = today - timedelta(days=j)
                    status = AttendanceStatus.PRESENT if random.random() > 0.1 else AttendanceStatus.ABSENT
                    att = Attendance(
                        student_id=s.id,
                        school_id=school_id,
                        grade_id=grade.id,
                        section_id=section.id,
                        date=att_date,
                        status=status
                    )
                    db.add(att)

        db.commit()
        print("✅ Board Data Seeded Successfully.")

    except Exception as e:
        print(f"❌ Error seeding board data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    # If run directly, attach to demo school
    db = SessionLocal()
    school = db.query(School).filter(School.code == "NIA001").first()
    principal = db.query(User).filter(User.email == "principal@nepsis.com").first()
    if school and principal:
        seed_board_data(str(school.id), str(principal.id))
    db.close()
