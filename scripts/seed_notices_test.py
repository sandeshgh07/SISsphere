from sqlalchemy.orm import Session
from database import SessionLocal, engine
from communication.models import Notice, NoticePriority, NoticeRole
from auth.dependencies import Roles
from schools.models import User
import uuid
from datetime import datetime

def seed_notices():
    db = SessionLocal()
    try:
        # Get a principal to be the author
        principal = db.query(User).filter(User.role == Roles.PRINCIPAL).first()
        if not principal:
            print("No principal found to be author. Using first user.")
            principal = db.query(User).first()
            
        if not principal:
            print("No users found at all. Aborting.")
            return

        school_id = str(principal.school_id)
        author_id = str(principal.id)

        print(f"Seeding notices for School ID: {school_id} by Author: {principal.first_name}")

        # 1. Create 2 Low Priority (Mapped to NORMAL) Notices for Security Guard
        print("Creating 2 Low Priority (NORMAL) Notices for Security Guard...")
        for i in range(1, 3):
            notice = Notice(
                school_id=school_id,
                title=f"Guard Duty Update {i} (Low Priority)",
                content=f"This is a low priority update for security guards regarding shift {i}.",
                priority=NoticePriority.NORMAL,
                author_id=author_id,
                created_at=datetime.utcnow()
            )
            db.add(notice)
            db.flush() # get ID

            # Target only Security Guard
            nr = NoticeRole(notice_id=notice.id, role=Roles.SECURITY_GUARD)
            db.add(nr)
        
        # 2. Create 3 Critical Notices for ALL users
        print("Creating 3 Critical Notices for ALL users...")
        all_roles = [
            Roles.PRINCIPAL, Roles.TEACHER, Roles.STUDENT, Roles.PARENT, 
            Roles.SECURITY_GUARD, Roles.ACCOUNTANT, Roles.SCHOOL_ADMIN
        ]

        for i in range(1, 4):
            notice = Notice(
                school_id=school_id,
                title=f"EMERGENCY ALERT {i}: Severe Weather",
                content=f"CRITICAL: This is an emergency broadcast to all school members. Please follow safety protocols {i}.",
                priority=NoticePriority.CRITICAL,
                author_id=author_id,
                created_at=datetime.utcnow()
            )
            db.add(notice)
            db.flush()

            # Add for all roles
            for role in all_roles:
                nr = NoticeRole(notice_id=notice.id, role=role)
                db.add(nr)

        db.commit()
        print("Successfully seeded notices.")

    except Exception as e:
        print(f"Error seeding notices: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_notices()
