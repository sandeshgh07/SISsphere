import sys
import os
import random
from datetime import datetime, timedelta, timezone, date
import uuid

# Add the project root to the python path
sys.path.append(os.getcwd())

from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
from passlib.context import CryptContext

# Import Models
import schools.models as school_models
import students.models as student_models
import academics.models as academic_models
import attendance.models as attendance_models
import communication.models as communication_models
import finance.models as finance_models

# Setup Password Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def generate_uuid():
    return str(uuid.uuid4())

def init_db():
    print("🧹 Cleaning database...")
    Base.metadata.drop_all(bind=engine)
    print("🏗️ Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database initialized.")

def create_demo_data():
    db = SessionLocal()
    try:
        print("🚀 Starting Demo Data Seed...")

        # 1. School
        print("🏫 Creating Nepsis International Academy...")
        school = school_models.School(
            name="Nepsis International Academy",
            country="Nepal",
            subscription_tier="PRO", # Using String as it matches Enum in DB usually, or import Enum if needed
            logo_url="https://via.placeholder.com/150", # Professional placeholder
            code="NIA001",
            subscription_expiry=datetime.utcnow() + timedelta(days=365)
        )
        db.add(school)
        db.commit()
        db.refresh(school)
        school_id = str(school.id)
        school_uuid = uuid.UUID(school_id) # For User model which uses Uuid type

        # 2. Users (Principal & Parent)
        print("👤 Creating Users...")
        principal_pass = pwd_context.hash("nepsis123")
        principal = school_models.User(
            email="principal@nepsis.com",
            hashed_password=principal_pass,
            first_name="Principal",
            last_name="User",
            role="principal",
            school_id=school_uuid,
            must_change_password=False
        )
        db.add(principal)

        parent_pass = pwd_context.hash("nepsis123")
        parent_user = school_models.User(
            email="parent@nepsis.com",
            hashed_password=parent_pass,
            first_name="Demo",
            last_name="Parent",
            role="guardian", # Assuming role name
            school_id=school_uuid,
            must_change_password=False
        )
        db.add(parent_user)
        db.commit()
        db.refresh(parent_user)
        parent_user_id = str(parent_user.id)

        # 3. Academics
        print("📚 Creating Academics...")
        # Academic Year
        ay_start = date(2023, 1, 1)
        ay_end = date(2023, 12, 31)
        academic_year = academic_models.AcademicYear(
            name="2023",
            start_date=ay_start,
            end_date=ay_end,
            school_id=school_id
        )
        db.add(academic_year)
        db.commit()
        db.refresh(academic_year)
        ay_id = academic_year.id

        # Grades & Sections
        grades = []
        sections = []
        grade_names = ["Grade 9", "Grade 10"]
        section_names = ["A", "B"]

        for g_name in grade_names:
            g = academic_models.Grade(name=g_name, school_id=school_id)
            db.add(g)
            db.commit() # Commit to get ID
            grades.append(g)

        for s_name in section_names:
            s = academic_models.Section(name=s_name, school_id=school_id)
            db.add(s)
            db.commit()
            sections.append(s)

        # Link Grades and Sections
        for g in grades:
            for s in sections:
                gs = academic_models.GradeSection(
                    grade_id=g.id,
                    section_id=s.id,
                    school_id=school_id
                )
                db.add(gs)
        db.commit()

        # Subjects
        subjects = []
        subj_names = ["Mathematics", "Science", "English", "History"]
        for sub_name in subj_names:
            sub = academic_models.Subject(name=sub_name, school_id=school_id)
            db.add(sub)
            subjects.append(sub)
        db.commit()
        # Reload subjects to get IDs
        for s in subjects: db.refresh(s)

        # Exam Terms
        term1 = academic_models.ExamTerm(name="Term 1", start_date=date(2023, 3, 1), school_id=school_id)
        term2 = academic_models.ExamTerm(name="Term 2", start_date=date(2023, 9, 1), school_id=school_id)
        db.add(term1)
        db.add(term2)
        db.commit()
        db.refresh(term1)
        db.refresh(term2)

        # 4. Students
        print("🎓 Creating Students...")
        students = []
        at_risk_students = []

        # Create 20 students
        for i in range(20):
            g = random.choice(grades)
            s = random.choice(sections)

            student = student_models.Student(
                first_name=f"Student",
                last_name=f"{i+1}",
                roll_number=f"R{100+i}",
                school_id=school_id,
                grade_id=g.id,
                section_id=s.id,
                academic_year_id=ay_id,
                is_active=True
            )
            db.add(student)
            students.append(student)

        db.commit()
        for stu in students: db.refresh(stu)

        # Assign Parent to Student 1
        ps_link = student_models.ParentStudentLink(
            parent_id=parent_user_id,
            student_id=students[0].id,
            school_id=school_id
        )
        db.add(ps_link)

        # Pick 2 At-Risk Students (ensure different from parent's child if we want variety, or same)
        # Let's pick last 2
        at_risk_students = students[-2:]
        normal_students = students[:-2]

        print(f"⚠️ At-Risk Students: {[s.id for s in at_risk_students]}")

        # 5. Attendance & Grades (The Story)
        print("📉 Generating Attendance & Grades...")

        # Attendance: Last 6 months (approx 180 days)
        # Weekdays only
        today = datetime.now(timezone.utc).date()
        start_date = today - timedelta(days=180)

        current_date = start_date
        while current_date <= today:
            if current_date.weekday() < 5: # Mon-Fri
                for stu in students:
                    status = attendance_models.AttendanceStatus.PRESENT

                    if stu in at_risk_students:
                        # At-Risk Logic:
                        # First 5 months (approx 150 days): Good attendance
                        # Last 1 month (approx 30 days): Bad attendance (<50%)
                        days_diff = (today - current_date).days
                        if days_diff <= 30:
                            # 60% chance of being ABSENT or LATE
                            if random.random() < 0.6:
                                status = random.choice([attendance_models.AttendanceStatus.ABSENT, attendance_models.AttendanceStatus.LATE])
                        else:
                            # Generally good, 5% random absence
                            if random.random() < 0.05:
                                status = attendance_models.AttendanceStatus.ABSENT
                    else:
                        # Normal Students: 95% attendance
                        if random.random() < 0.05:
                            status = attendance_models.AttendanceStatus.ABSENT

                    att = attendance_models.Attendance(
                        student_id=stu.id,
                        grade_id=stu.grade_id,
                        section_id=stu.section_id,
                        status=status,
                        date=current_date,
                        school_id=school_id
                    )
                    db.add(att)

            current_date += timedelta(days=1)

        db.commit()

        # Grades
        # Term 1: Good for everyone (70-95)
        # Term 2: Normal -> Stable. At-Risk -> Drop (30-50)

        for stu in students:
            for sub in subjects:
                # Term 1
                marks1 = random.randint(70, 95)
                m1 = academic_models.MarksEntry(
                    student_id=stu.id,
                    subject_id=sub.id,
                    exam_term_id=term1.id,
                    marks_obtained=marks1,
                    total_marks=100,
                    school_id=school_id,
                    is_published=True
                )
                db.add(m1)

                # Term 2
                marks2 = 0
                if stu in at_risk_students:
                    # Drop to 30-50
                    marks2 = random.randint(30, 50)
                else:
                    # Stable
                    marks2 = random.randint(max(60, marks1 - 10), min(100, marks1 + 10))

                m2 = academic_models.MarksEntry(
                    student_id=stu.id,
                    subject_id=sub.id,
                    exam_term_id=term2.id,
                    marks_obtained=marks2,
                    total_marks=100,
                    school_id=school_id,
                    is_published=True
                )
                db.add(m2)
        db.commit()

        # 6. Communication
        print("📢 Creating Notices...")
        # High Priority School Wide
        notice1 = communication_models.Notice(
            school_id=school_id,
            title="IMPORTANT: School Closure due to Weather",
            content="Please be advised that the school will be closed tomorrow due to heavy rains.",
            priority=communication_models.NoticePriority.HIGH,
            author_id=str(principal.id)
        )
        db.add(notice1)

        # Grade Specific (Grade 9)
        g9 = [g for g in grades if g.name == "Grade 9"][0]
        notice2 = communication_models.Notice(
            school_id=school_id,
            title="Grade 9 Field Trip",
            content="Field trip to the Science Museum next Friday.",
            priority=communication_models.NoticePriority.NORMAL,
            author_id=str(principal.id)
        )
        db.add(notice2)
        db.commit() # to get ID

        ng = communication_models.NoticeGrade(
            notice_id=notice2.id,
            grade_id=g9.id
        )
        db.add(ng)

        # Another Grade Specific (Grade 10)
        g10 = [g for g in grades if g.name == "Grade 10"][0]
        notice3 = communication_models.Notice(
            school_id=school_id,
            title="Grade 10 Exams",
            content="Prepare for upcoming exams.",
            priority=communication_models.NoticePriority.NORMAL,
            author_id=str(principal.id)
        )
        db.add(notice3)
        db.commit()
        ng2 = communication_models.NoticeGrade(
            notice_id=notice3.id,
            grade_id=g10.id
        )
        db.add(ng2)

        # Individual Parent Notice
        # For the student linked to the parent (students[0])
        notice4 = communication_models.Notice(
            school_id=school_id,
            title="Meeting Request",
            content="Please schedule a meeting with the class teacher.",
            priority=communication_models.NoticePriority.NORMAL,
            author_id=str(principal.id)
        )
        db.add(notice4)
        db.commit()
        ns = communication_models.NoticeStudent(
            notice_id=notice4.id,
            student_id=students[0].id
        )
        db.add(ns)


        # 7. Financials
        print("💰 Creating Financials...")
        for stu in students:
            # Invoice
            inv = finance_models.Invoice(
                school_id=school_id,
                student_id=stu.id,
                total_amount=500.0,
                amount_paid=0.0,
                status=finance_models.InvoiceStatus.PENDING
            )
            db.add(inv)
            db.commit()
            db.refresh(inv)

            # Some Paid, Some Pending
            # Force Student 1 to have Pending Verification Payment
            if stu == students[1]:
                pay = finance_models.Payment(
                    school_id=school_id,
                    invoice_id=inv.id,
                    amount=500.0,
                    currency="USD",
                    status=finance_models.PaymentStatus.PENDING,
                    entry_source=finance_models.EntrySource.REMOTE,
                    receipt_url="https://via.placeholder.com/200?text=Receipt"
                )
                db.add(pay)
            elif random.random() > 0.5:
                # Paid
                inv.status = finance_models.InvoiceStatus.PAID
                inv.amount_paid = 500.0

                pay = finance_models.Payment(
                    school_id=school_id,
                    invoice_id=inv.id,
                    amount=500.0,
                    currency="USD",
                    status=finance_models.PaymentStatus.SUCCEEDED,
                    entry_source=finance_models.EntrySource.AUTOMATED
                )
                db.add(pay)

        # 8. Alerts
        print("🚨 Creating Risk Alerts...")
        for stu in at_risk_students:
            alert = student_models.StudentRiskAlert(
                school_id=school_id,
                student_id=stu.id,
                type="ACADEMIC_ATTENDANCE",
                severity=student_models.RiskSeverity.HIGH,
                description="Student shows significant drop in grades and attendance.",
                is_resolved=False
            )
            db.add(alert)

        db.commit()
        print("✅ Demo Data Seed Completed Successfully!")

    except Exception as e:
        print(f"❌ Error seeding data: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
    create_demo_data()
