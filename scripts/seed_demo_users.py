
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

# Import Roles
from auth.dependencies import Roles

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def init_db():
    print("🧹 Dropping existing tables...")
    Base.metadata.drop_all(bind=engine)
    print("🏗️ Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database initialized.")

def seed_demo_users():
    db = SessionLocal()
    try:
        print("\n" + "=" * 60)
        print("🚀 SEEDING DEMO USERS FOR ST. MARY'S")
        print("=" * 60 + "\n")

        # 1. School
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
        school_id_str = str(school.id)
        school_uuid = school.id
        print(f"🏫 Created School: {school.name}")

        # Helper to create user
        def create_user(email, password, first, last, role, extra_roles=[]):
            user = school_models.User(
                email=email,
                hashed_password=pwd_context.hash(password),
                first_name=first,
                last_name=last,
                role=role,
                school_id=school_uuid,
                must_change_password=False
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # Add primary role
            db.add(school_models.UserRole(user_id=user.id, role_name=role))
            
            # Add extra roles
            for r in extra_roles:
                db.add(school_models.UserRole(user_id=user.id, role_name=r))
            
            db.commit()
            return user

        # 2. Users
        print("\n👤 Creating Users...")
        
        # Super Admin
        super_admin = create_user("super@stmarys.edu", "super123", "Super", "Admin", Roles.SUPER_ADMIN)
        print("   ✓ Super Admin created")

        # Principal
        principal = create_user("principal@stmarys.edu", "principal123", "Dr. A.", "Principal", Roles.PRINCIPAL)
        print("   ✓ Principal created")

        # School Admin
        school_admin = create_user("admin@stmarys.edu", "admin123", "School", "Admin", Roles.SCHOOL_ADMIN)
        print("   ✓ School Admin created")

        # Accountant
        accountant = create_user("accountant@stmarys.edu", "account123", "Finance", "Manager", Roles.ACCOUNTANT)
        print("   ✓ Accountant created")

        # Teacher
        teacher = create_user("teacher@stmarys.edu", "teacher123", "John", "Teacher", Roles.TEACHER)
        print("   ✓ Teacher created")
        
        # Guard
        guard = create_user("guard@stmarys.edu", "guard123", "Security", "Guard", Roles.SECURITY_GUARD)
        print("   ✓ Security Guard created")

        # Student User (For login) & Student Record
        print("\n🎓 Creating Linked Student...")
        # Academic Setup
        ay = academic_models.AcademicYear(name="2025-2026", start_date=date(2025,4,1), end_date=date(2026,3,31), school_id=school_id_str)
        db.add(ay); db.commit()
        grade = academic_models.Grade(name="Grade 10", school_id=school_id_str)
        db.add(grade); db.commit()
        section = academic_models.Section(name="A", school_id=school_id_str)
        db.add(section); db.commit()
        
        # Student Record
        student_record = student_models.Student(
            first_name="Demo",
            last_name="Student",
            roll_number="1001",
            email="student@stmarys.edu", # Email in student record
            school_id=school_id_str,
            grade_id=grade.id,
            section_id=section.id,
            academic_year_id=ay.id,
            is_active=True
        )
        db.add(student_record)
        db.commit()

        # Student User (Login) - NOTE: In some systems students don't have user accounts, but prompt asks for login
        # Assuming Student Role exists in User table logic
        student_user = create_user("student@stmarys.edu", "student123", "Demo", "Student", Roles.STUDENT)
        print("   ✓ Student created")

        # Parent
        print("\n👨‍👩‍👧 Creating Parent and Linking...")
        parent = create_user("parent@stmarys.edu", "parent123", "Demo", "Parent", Roles.PARENT)
        
        # Link Parent to Student
        link = student_models.ParentStudentLink(
            parent_id=str(parent.id),
            student_id=student_record.id,
            school_id=school_id_str,
            is_authorized_pickup=True
        )
        db.add(link)
        db.commit()
        print("   ✓ Parent created and linked")

        # Dual Role
        print("\n🎭 Creating Dual Role User...")
        # Teacher + Parent
        dual = create_user("dual@stmarys.edu", "dual123", "Dual", "User", Roles.TEACHER, extra_roles=[Roles.PARENT])
        # Link to student as parent
        link_dual = student_models.ParentStudentLink(
            parent_id=str(dual.id),
            student_id=student_record.id,
            school_id=school_id_str
        )
        db.add(link_dual)
        db.commit()
        print("   ✓ Dual Role User (Teacher + Parent) created")

        print("\n" + "=" * 60)
        print("✅ COMPLETED")
        print("=" * 60)
        print("Credentials for St. Mary's High School:")
        print(f"1. Super Admin: super@stmarys.edu / super123")
        print(f"2. Principal:   principal@stmarys.edu / principal123")
        print(f"3. School Admin: admin@stmarys.edu / admin123")
        print(f"4. Accountant:  accountant@stmarys.edu / account123")
        print(f"5. Teacher:     teacher@stmarys.edu / teacher123")
        print(f"6. Guard:       guard@stmarys.edu / guard123")
        print(f"7. Parent:      parent@stmarys.edu / parent123")
        print(f"8. Student:     student@stmarys.edu / student123")
        print(f"9. Dual Role:   dual@stmarys.edu / dual123  (Teacher + Parent)")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
    seed_demo_users()
