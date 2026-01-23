"""
Seed Script for Principal Dashboard Analytics
Creates comprehensive data for weekly, monthly, and yearly verification.

Usage:
    python scripts/seed_principal_dashboard.py

This script seeds:
- 52 weeks of attendance data (realistic patterns)
- 12 months of payment data (with trends)
- 2+ years of academic performance data
- Teacher assignments and workload
- Various risk alerts (HIGH, MEDIUM, LOW)
"""

import sys
import os
import random
from datetime import datetime, timedelta, timezone, date
import uuid

# Add project root to path
sys.path.append(os.getcwd())

from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
from passlib.context import CryptContext

# Import Models
import schools.models as school_models
from schools.constants import SubscriptionTier
import students.models as student_models
import academics.models as academic_models
import attendance.models as attendance_models
import communication.models as communication_models
import finance.models as finance_models

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_uuid():
    return str(uuid.uuid4())


def init_db():
    """Initialize database tables."""
    print("🧹 Dropping existing tables...")
    Base.metadata.drop_all(bind=engine)
    print("🏗️ Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database initialized.")


def seed_principal_dashboard():
    """Create comprehensive demo data for principal dashboard."""
    db = SessionLocal()
    
    try:
        print("\n" + "=" * 60)
        print("🚀 PRINCIPAL DASHBOARD SEED SCRIPT")
        print("=" * 60 + "\n")
        
        today = datetime.now(timezone.utc).date()
        
        # =====================================================
        # 1. SCHOOL SETUP
        # =====================================================
        print("🏫 Creating School: St. Mary's High School...")
        
        school = school_models.School(
            name="St. Mary's High School",
            country="Nepal",
            subscription_tier=SubscriptionTier.PRO,
            logo_url="/static/logos/st_marys.png",
            code="SMHS001",
            subscription_expiry=datetime.utcnow() + timedelta(days=365)
        )
        db.add(school)
        db.commit()
        db.refresh(school)
        school_id = str(school.id)
        school_uuid = uuid.UUID(school_id)
        
        print(f"   ✓ School ID: {school_id}")
        
        # =====================================================
        # 2. USERS (Principal, Teachers, Staff)
        # =====================================================
        print("\n👤 Creating Users...")
        
        # Principal
        principal = school_models.User(
            email="dr.smith@stmarys.edu",
            hashed_password=pwd_context.hash("principal123"),
            first_name="Dr. A.",
            last_name="Smith",
            role="principal",
            school_id=school_uuid,
            must_change_password=False
        )
        db.add(principal)
        db.commit()
        db.refresh(principal)
        
        principal_role = school_models.UserRole(user_id=principal.id, role_name="principal")
        db.add(principal_role)
        print(f"   ✓ Principal: {principal.email}")
        
        # Teachers (by department)
        departments = ["Mathematics", "Science", "English", "History", "Physical Education"]
        teachers = []
        
        for i, dept in enumerate(departments):
            for j in range(random.randint(3, 6)):  # 3-6 teachers per department
                teacher = school_models.User(
                    email=f"{dept.lower().replace(' ', '_')}.teacher{j+1}@stmarys.edu",
                    hashed_password=pwd_context.hash("teacher123"),
                    first_name=f"{dept[:3]}",
                    last_name=f"Teacher {j+1}",
                    role="teacher",
                    school_id=school_uuid,
                    must_change_password=False
                )
                db.add(teacher)
                teachers.append((teacher, dept))
        
        db.commit()
        print(f"   ✓ Created {len(teachers)} teachers across {len(departments)} departments")
        
        # Accountant
        accountant = school_models.User(
            email="accounts@stmarys.edu",
            hashed_password=pwd_context.hash("account123"),
            first_name="Finance",
            last_name="Manager",
            role="accountant",
            school_id=school_uuid,
            must_change_password=False
        )
        db.add(accountant)
        db.commit()
        print("   ✓ Accountant created")
        
        # =====================================================
        # 3. ACADEMIC STRUCTURE
        # =====================================================
        print("\n📚 Creating Academic Structure...")
        
        # Academic Years (2 years for trend data)
        academic_years = []
        for year_offset in range(2):
            ay_year = 2025 - year_offset
            ay = academic_models.AcademicYear(
                name=f"{ay_year}-{ay_year + 1}",
                start_date=date(ay_year, 4, 1),
                end_date=date(ay_year + 1, 3, 31),
                school_id=school_id
            )
            db.add(ay)
            academic_years.append(ay)
        
        db.commit()
        current_ay = academic_years[0]
        print(f"   ✓ Created {len(academic_years)} academic years")
        
        # Grades (9-12)
        grades = []
        grade_names = ["Grade 9", "Grade 10", "Grade 11", "Grade 12"]
        for name in grade_names:
            g = academic_models.Grade(name=name, school_id=school_id)
            db.add(g)
            grades.append(g)
        db.commit()
        print(f"   ✓ Created {len(grades)} grades")
        
        # Sections (A, B, C per grade)
        sections = []
        section_names = ["A", "B", "C"]
        for name in section_names:
            s = academic_models.Section(name=name, school_id=school_id)
            db.add(s)
            sections.append(s)
        db.commit()
        
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
        print(f"   ✓ Created {len(sections)} sections and linked to grades")
        
        # Subjects
        subjects = []
        for name in departments:
            sub = academic_models.Subject(name=name, school_id=school_id)
            db.add(sub)
            subjects.append(sub)
        db.commit()
        print(f"   ✓ Created {len(subjects)} subjects")
        
        # Exam Terms (3 per year)
        exam_terms = []
        term_configs = [
            ("Term 1", date(2025, 6, 1)),
            ("Term 2", date(2025, 10, 1)),
            ("Term 3", date(2026, 2, 1)),
            # Previous year
            ("Term 1 (Prev)", date(2024, 6, 1)),
            ("Term 2 (Prev)", date(2024, 10, 1)),
            ("Term 3 (Prev)", date(2025, 2, 1)),
        ]
        for term_name, start_date in term_configs:
            term = academic_models.ExamTerm(
                name=term_name,
                start_date=start_date,
                school_id=school_id
            )
            db.add(term)
            exam_terms.append(term)
        db.commit()
        print(f"   ✓ Created {len(exam_terms)} exam terms")
        
        # =====================================================
        # 4. STUDENTS (310 per the dashboard image)
        # =====================================================
        print("\n🎓 Creating Students...")
        
        students = []
        target_total = 1240  # Match the dashboard image
        students_per_grade = target_total // len(grades)
        
        first_names = ["Aarav", "Vivaan", "Aditya", "Arjun", "Sai", "Ayaan", "Ishaan", "Reyansh",
                       "Aadhya", "Diya", "Ananya", "Aanya", "Isha", "Myra", "Sara", "Priya",
                       "Krishna", "Ravi", "Amit", "Sunil", "Pooja", "Neha", "Meera", "Lakshmi"]
        last_names = ["Sharma", "Patel", "Kumar", "Singh", "Thapa", "Gurung", "Rai", "Shrestha",
                      "Adhikari", "Bhandari", "Joshi", "Acharya", "Pandey", "Koirala", "Basnet"]
        
        for grade in grades:
            section_idx = 0
            for i in range(students_per_grade):
                # Distribute across sections
                section = sections[section_idx % len(sections)]
                section_idx += 1
                
                student = student_models.Student(
                    first_name=random.choice(first_names),
                    last_name=random.choice(last_names),
                    roll_number=f"{grade.name[-2:]}{i+1:03d}",
                    email=f"student{len(students)+1}@stmarys.edu",
                    school_id=school_id,
                    grade_id=grade.id,
                    section_id=section.id,
                    academic_year_id=current_ay.id,
                    is_active=True
                )
                db.add(student)
                students.append(student)
        
        db.commit()
        print(f"   ✓ Created {len(students)} students")
        
        # =====================================================
        # 5. TEACHER ASSIGNMENTS (Workload Distribution)
        # =====================================================
        print("\n👨‍🏫 Creating Teacher Assignments...")
        
        assignments_created = 0
        for teacher, dept in teachers:
            db.refresh(teacher)
            # Find matching subject
            subject = next((s for s in subjects if s.name == dept), subjects[0])
            
            # Assign to random grades/sections (varying workload)
            num_assignments = random.randint(2, 8)  # Creates workload variance
            assigned_combos = set()
            
            for _ in range(num_assignments):
                grade = random.choice(grades)
                section = random.choice(sections)
                combo = (grade.id, section.id)
                
                if combo not in assigned_combos:
                    assigned_combos.add(combo)
                    assignment = academic_models.TeacherAssignment(
                        teacher_id=str(teacher.id),
                        grade_id=grade.id,
                        section_id=section.id,
                        subject_id=subject.id,
                        school_id=school_id
                    )
                    db.add(assignment)
                    assignments_created += 1
        
        db.commit()
        print(f"   ✓ Created {assignments_created} teacher assignments")
        
        # =====================================================
        # 6. ATTENDANCE DATA (52 weeks)
        # =====================================================
        print("\n📊 Generating Attendance Data (52 weeks)...")
        
        # Identify at-risk students (5%)
        at_risk_students = random.sample(students, len(students) // 20)
        at_risk_ids = set(s.id for s in at_risk_students)
        
        attendance_count = 0
        week_count = 52
        
        for week in range(week_count):
            week_start = today - timedelta(weeks=week_count - week)
            
            for day_offset in range(5):  # Mon-Fri
                current_date = week_start + timedelta(days=day_offset)
                
                if current_date > today:
                    continue
                
                for student in students:
                    # Determine attendance status
                    if student.id in at_risk_ids:
                        # At-risk: 60-75% attendance
                        if random.random() < 0.35:
                            status = random.choice([
                                attendance_models.AttendanceStatus.ABSENT,
                                attendance_models.AttendanceStatus.LATE
                            ])
                        else:
                            status = attendance_models.AttendanceStatus.PRESENT
                    else:
                        # Normal: 92-98% attendance
                        if random.random() < 0.05:
                            status = random.choice([
                                attendance_models.AttendanceStatus.ABSENT,
                                attendance_models.AttendanceStatus.LATE
                            ])
                        else:
                            status = attendance_models.AttendanceStatus.PRESENT
                    
                    att = attendance_models.Attendance(
                        student_id=student.id,
                        grade_id=student.grade_id,
                        section_id=student.section_id,
                        status=status,
                        date=current_date,
                        school_id=school_id
                    )
                    db.add(att)
                    attendance_count += 1
            
            # Commit per week for performance
            if week % 4 == 0:
                db.commit()
                print(f"   ... Week {week + 1}/{week_count} processed")
        
        db.commit()
        print(f"   ✓ Created {attendance_count:,} attendance records")
        
        # =====================================================
        # 7. FINANCIAL DATA (12+ months)
        # =====================================================
        print("\n💰 Generating Financial Data (12 months)...")
        
        # Create invoices and payments
        invoice_count = 0
        payment_count = 0
        total_invoiced = 0.0
        total_collected = 0.0
        
        for student in students:
            # Annual fee invoice
            annual_fee = random.uniform(45000, 55000)
            total_invoiced += annual_fee
            
            invoice = finance_models.Invoice(
                school_id=school_id,
                student_id=student.id,
                total_amount=annual_fee,
                amount_paid=0.0,
                currency="NPR",
                status=finance_models.InvoiceStatus.PENDING
            )
            db.add(invoice)
            db.commit()
            db.refresh(invoice)
            invoice_count += 1
            
            # Payment history (varying collection patterns)
            collection_rate = random.uniform(0.6, 1.0)  # 60-100% paid
            amount_to_pay = annual_fee * collection_rate
            
            # Spread payments over months
            months_paid = random.randint(1, min(10, int(collection_rate * 12)))
            payment_per_month = amount_to_pay / months_paid
            
            for month_offset in range(months_paid):
                payment_date = today - timedelta(days=random.randint(1, 30) + (month_offset * 30))
                
                # Add some variance
                actual_payment = payment_per_month * random.uniform(0.9, 1.1)
                
                payment = finance_models.Payment(
                    school_id=school_id,
                    invoice_id=invoice.id,
                    amount=actual_payment,
                    currency="NPR",
                    status=finance_models.PaymentStatus.SUCCEEDED,
                    entry_source=random.choice([
                        finance_models.EntrySource.OFFICE_CASH,
                        finance_models.EntrySource.REMOTE,
                        finance_models.EntrySource.AUTOMATED
                    ]),
                    gateway=random.choice(["ESEWA", "KHALTI", "OFFICE_CASH"]),
                    created_at=datetime.combine(payment_date, datetime.min.time()).replace(tzinfo=timezone.utc)
                )
                db.add(payment)
                payment_count += 1
                total_collected += actual_payment
                invoice.amount_paid += actual_payment
            
            # Update invoice status
            if invoice.amount_paid >= invoice.total_amount * 0.99:
                invoice.status = finance_models.InvoiceStatus.PAID
            elif invoice.amount_paid > 0:
                invoice.status = finance_models.InvoiceStatus.PARTIALLY_PAID
            
            # Legacy Fee records
            fee = finance_models.Fee(
                school_id=school_id,
                student_id=student.id,
                amount=annual_fee - invoice.amount_paid,
                description="Annual Tuition Fee Balance",
                status="paid" if invoice.status == finance_models.InvoiceStatus.PAID else "pending",
                due_date=datetime.now(timezone.utc) + timedelta(days=30)
            )
            db.add(fee)
        
        db.commit()
        collection_percent = (total_collected / total_invoiced * 100) if total_invoiced > 0 else 0
        print(f"   ✓ Created {invoice_count} invoices")
        print(f"   ✓ Created {payment_count} payments")
        print(f"   ✓ Collection rate: {collection_percent:.1f}%")
        
        # =====================================================
        # 8. ACADEMIC PERFORMANCE (Marks Entries)
        # =====================================================
        print("\n📈 Generating Academic Performance Data...")
        
        marks_count = 0
        for term in exam_terms[:3]:  # Current year terms
            for student in students:
                # Base GPA varies by student
                base_gpa = random.uniform(2.5, 3.9)
                
                for subject in subjects:
                    # Add subject variation
                    subject_factor = random.uniform(0.85, 1.15)
                    marks = min(100, max(30, base_gpa / 4.0 * 100 * subject_factor))
                    
                    entry = academic_models.MarksEntry(
                        student_id=student.id,
                        subject_id=subject.id,
                        exam_term_id=term.id,
                        marks_obtained=round(marks, 1),
                        total_marks=100,
                        school_id=school_id,
                        is_published=True
                    )
                    db.add(entry)
                    marks_count += 1
            
            db.commit()
            print(f"   ... {term.name} marks added")
        
        print(f"   ✓ Created {marks_count:,} marks entries")
        
        # =====================================================
        # 9. RISK ALERTS
        # =====================================================
        print("\n🚨 Creating Risk Alerts...")
        
        alert_count = 0
        
        # Academic/Attendance alerts for at-risk students
        for student in at_risk_students[:10]:  # Top 10 at-risk
            alert = student_models.StudentRiskAlert(
                school_id=school_id,
                student_id=student.id,
                type="ATTENDANCE,ACADEMIC",
                severity=random.choice([
                    student_models.RiskSeverity.HIGH,
                    student_models.RiskSeverity.MEDIUM
                ]),
                description=f"Attendance dropped significantly; grades declining over 3 terms.",
                is_resolved=False
            )
            db.add(alert)
            alert_count += 1
        
        db.commit()
        print(f"   ✓ Created {alert_count} risk alerts")
        
        # =====================================================
        # 10. NOTICES & COMPLAINTS
        # =====================================================
        print("\n📢 Creating Notices...")
        
        notice_titles = [
            ("IMPORTANT: School Closure - Weather Advisory", communication_models.NoticePriority.CRITICAL),
            ("Grade 12 Board Exam Schedule", communication_models.NoticePriority.NORMAL),
            ("Science Fair Registration Open", communication_models.NoticePriority.NORMAL),
            ("PTM Scheduled for Next Week", communication_models.NoticePriority.IMPORTANT),
            ("Annual Sports Day Announcement", communication_models.NoticePriority.NORMAL),
        ]
        
        for title, priority in notice_titles:
            notice = communication_models.Notice(
                school_id=str(school_uuid).replace('-', ''),  # Use non-hyphenated UUID to match user.school_id format
                title=title,
                content=f"Details about {title}...",
                priority=priority,
                author_id=str(principal.id)
            )
            db.add(notice)
        
        db.commit()
        print(f"   ✓ Created {len(notice_titles)} notices")
        
        # Complaints (for resolution time metrics)
        print("\n📝 Creating Complaints...")
        complaint_count = 0
        
        for hours in [2, 5, 12, 24, 48, 72, 1, 8]:
            created = datetime.now(timezone.utc) - timedelta(days=random.randint(5, 30))
            resolved = created + timedelta(hours=hours)
            
            complaint = communication_models.Complaint(
                school_id=str(school_uuid).replace('-', ''),  # Use non-hyphenated UUID to match user.school_id format
                title=f"Test Complaint (resolved in {hours}h)",
                status=communication_models.ComplaintStatus.RESOLVED,
                created_by_id=str(principal.id),
                created_at=created,
                resolved_at=resolved
            )
            db.add(complaint)
            db.flush()  # Get the complaint ID
            
            # Add principal as participant so they can see the complaint
            participant = communication_models.ComplaintParticipant(
                complaint_id=complaint.id,
                user_id=principal.id
            )
            db.add(participant)
            complaint_count += 1
        
        # Some open complaints
        for i in range(3):
            complaint = communication_models.Complaint(
                school_id=str(school_uuid).replace('-', ''),  # Use non-hyphenated UUID to match user.school_id format
                title=f"Open Complaint #{i+1}",
                status=communication_models.ComplaintStatus.OPEN,
                created_by_id=str(principal.id)
            )
            db.add(complaint)
            db.flush()  # Get the complaint ID
            
            # Add principal as participant so they can see the complaint
            participant = communication_models.ComplaintParticipant(
                complaint_id=complaint.id,
                user_id=principal.id
            )
            db.add(participant)
            complaint_count += 1
        
        db.commit()
        print(f"   ✓ Created {complaint_count} complaints")
        
        # =====================================================
        # SUMMARY
        # =====================================================
        print("\n" + "=" * 60)
        print("✅ SEED COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print(f"""
📊 Summary:
   • School: {school.name} ({school_id})
   • Students: {len(students):,}
   • Teachers: {len(teachers)}
   • Grades: {len(grades)} × Sections: {len(sections)}
   • Attendance Records: {attendance_count:,}
   • Invoices: {invoice_count:,}
   • Payments: {payment_count:,} (Collection: {collection_percent:.1f}%)
   • Marks Entries: {marks_count:,}
   • Risk Alerts: {alert_count}

🔐 Login Credentials:
   Principal: dr.smith@stmarys.edu / principal123
   Accountant: accounts@stmarys.edu / account123
        """)
        
    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("🔄 Starting Principal Dashboard Seed...")
    print("⚠️  This will RESET the database and create fresh demo data.\n")
    
    confirm = input("Continue? (y/N): ").strip().lower()
    if confirm != 'y':
        print("Aborted.")
        sys.exit(0)
    
    init_db()
    seed_principal_dashboard()
