
import sys
import os
import uuid
from datetime import datetime, timedelta, timezone

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine, Base
from schools.models import School, User
from academics.models import AcademicYear, Term, Grade, Section
from communication.models import Complaint, Notice, ComplaintStatus, NoticePriority
from audit.models import AuditLog
from students.models import Student, GateLog, GateLogType
from passlib.context import CryptContext
from fastapi.testclient import TestClient
from main import app

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)


def seed_profile_data():
    db = SessionLocal()
    try:
        print("Starting seed for Profile Verification...")

        # 1. Create/Get School
        school = db.query(School).filter(School.code == "profile-test-school").first()
        if not school:
            school = School(
                id=uuid.uuid4(),
                name="Saint Profile High",
                code="profile-test-school",
                country="USA",
                is_active=True
            )
            db.add(school)
            db.commit()
            print(f"Created School: {school.name}")
        else:
            print(f"Using School: {school.name}")

        # 2. Create/Get Principal User
        principal_email = "principal@profiletest.com"
        principal = db.query(User).filter(User.email == principal_email).first()
        if not principal:
            principal = User(
                id=uuid.uuid4(),
                email=principal_email,
                hashed_password=get_password_hash("password123"),
                role="principal",
                school_id=school.id,
                is_active=True,
                first_name="Dr. Profile",
                last_name="Tester"
            )
            db.add(principal)
            db.commit()
            print(f"Created Principal: {principal.email} (password123)")
        else:
            print(f"Using Principal: {principal.email}")

        # 3. Active Academic Year & Term
        # Deactivate others first
        db.query(AcademicYear).filter(AcademicYear.school_id == str(school.id)).update({"is_active": False})
        db.commit()
        
        year = AcademicYear(
            id=str(uuid.uuid4()),
            school_id=str(school.id),
            name="2025-2026",
            start_date=datetime.now(),
            end_date=datetime.now() + timedelta(days=365),
            is_active=True
        )
        db.add(year)
        db.commit()

        term = Term(
            id=str(uuid.uuid4()),
            academic_year_id=year.id,
            name="Term 1",
            start_date=datetime.now(),
            end_date=datetime.now() + timedelta(days=90),
            school_id=str(school.id)
        )
        db.add(term)
        db.commit()
        print(f"Created Active Year {year.name} and Term {term.name}")

        # 4. Students (for search)
        for i in range(5):
            s = Student(
                id=str(uuid.uuid4()),
                school_id=str(school.id),
                first_name=f"Student{i}",
                last_name="Test",
                roll_number=f"R-{i}",
                is_active=True
            )
            db.add(s)
        db.commit()
        print("Seeded 5 students")

        # 5. Complaints (Assigned to Principal)
        for i in range(3):
            c = Complaint(
                id=str(uuid.uuid4()),
                school_id=str(school.id),
                title=f"Test Complaint {i}",
                description="This is a test complaint description.",
                created_by_id=str(principal.id), # Created by principal
                status=ComplaintStatus.OPEN,
                severity="medium"
            )
            db.add(c)
            
            # Add participant (Principal) so they can see it
            from communication.models import ComplaintParticipant
            cp = ComplaintParticipant(
                complaint_id=c.id,
                user_id=str(principal.id)
            )
            db.add(cp)
        db.commit()
        print("Seeded 3 Complaints")

        # 6. Notices
        for i in range(3):
            n = Notice(
                id=str(uuid.uuid4()),
                school_id=str(school.id),
                title=f"Test Notice {i}",
                content="This is a test notice content. Important information here.",
                author_id=str(principal.id),
                priority=NoticePriority.NORMAL,
                created_at=datetime.now(timezone.utc)
            )
            db.add(n)
        db.commit()
        print("Seeded 3 Notices")

        # 7. Audit Logs for Principal
        for i in range(5):
            log = AuditLog(
                id=str(uuid.uuid4()),
                school_id=str(school.id),
                actor_id=str(principal.id),
                action_type="UPDATE",
                table_name="users",
                reason=f"Changed settings {i}",
                timestamp=datetime.now(timezone.utc) - timedelta(hours=i)
            )
            db.add(log)
        db.commit()
        print("Seeded 5 Audit Logs")

        # 8. Gate Pass Logs
        # Principal scanning a student
        student = db.query(Student).filter(Student.school_id == str(school.id)).first()
        if student:
            for i in range(3):
                gl = GateLog(
                    id=str(uuid.uuid4()),
                    school_id=str(school.id),
                    student_id=student.id,
                    scanned_by_id=str(principal.id),
                    type=GateLogType.CHECKIN,
                    timestamp=datetime.now(timezone.utc) - timedelta(minutes=i*10)
                )
                db.add(gl)
            db.commit()
            print("Seeded 3 Gate Logs")

        # DEBUG: Check DB Logs
        logs = db.query(GateLog).all()
        print(f"DEBUG DB: Found {len(logs)} GateLogs in DB")
        for l in logs:
            print(f"  ID: {l.id}, School: {l.school_id}, User: {l.scanned_by_id}")
        print(f"DEBUG DB: Principal ID: {principal.id}, School ID: {school.id}")

        print("Values for Login:")
        print(f"Email: {principal_email}")
        print("Password: password123")
        print(f"School Code: {school.code}")

        # Verify API
        print("\n--- Verifying API ---")
        client = TestClient(app)

        # 1. Login
        login_payload = {
            "username": principal_email,
            "password": "password123",
            "school_id": str(school.id)
        }
        print(f"Logging in with: {login_payload['username']}")
        res = client.post("/api/auth/login", json=login_payload)
        if res.status_code != 200:
            print(f"Login Failed: {res.status_code} {res.text}")
            return

        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("Login Successful")

        # 2. Get Overview
        print("Fetching /api/dashboard/me/overview...")
        res = client.get("/api/dashboard/me/overview", headers=headers)
        if res.status_code != 200:
            print(f"Overview Fetch Failed: {res.status_code} {res.text}")
            return
        
        data = res.json()
        
        # Checks
        print("\n--- Verification Results ---")
        
        # Check active term
        term_name = data.get("academics", {}).get("active_term")
        print(f"Active Term: {term_name} [{'OK' if term_name == 'Term 1' else 'FAIL'}]")

        # Check counts
        counts = data.get("counts", {})
        print(f"Unread Notices: {counts.get('unread_notices')} [{'OK' if counts.get('unread_notices') == 3 else 'FAIL'}]")
        print(f"Assigned Complaints: {counts.get('assigned_complaints')} [{'OK' if counts.get('assigned_complaints') == 3 else 'FAIL'}]")

        # Check Recent Activity
        activity = data.get("recent_activity", [])
        print(f"Recent Activity Items: {len(activity)} [{'OK' if len(activity) == 5 else 'FAIL (>0)'}]")

        # Check Gate Pass
        gate = data.get("gate_pass", {}).get("recent_events", [])
        print(f"Gate Pass Items: {len(gate)} [{'OK' if len(gate) == 3 else 'FAIL (>0)'}]")

        # 3. Check Audit Logs Page Endpoint
        print("Fetching /api/audit-logs...")
        res = client.get("/api/audit-logs", headers=headers)
        if res.status_code != 200:
            print(f"Audit Logs Fetch Failed: {res.status_code} {res.text}")
        else:
            logs = res.json()
            print(f"Audit Logs Page Items: {len(logs)} [{'OK' if len(logs) >= 5 else 'FAIL'}]")

        # 4. Check Complaints Page Endpoint
        print("Fetching /api/complaints...")
        res = client.get("/api/complaints", headers=headers)
        if res.status_code != 200:
            print(f"Complaints Fetch Failed: {res.status_code} {res.text}")
        else:
            complaints = res.json()
            print(f"Complaints Page Items: {len(complaints)} [{'OK' if len(complaints) >= 3 else 'FAIL'}]")

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_profile_data()
