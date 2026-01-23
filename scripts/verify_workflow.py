
import sys
import os
import uuid
from datetime import datetime
import json

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from communication.models import Complaint, ComplaintStatus, ComplaintParticipant
from schools.models import User
from audit.models import AuditLog
from fastapi.testclient import TestClient
from main import app
from auth.jwt import create_access_token

def verify_workflow():
    db = SessionLocal()
    client = TestClient(app)
    
    print("--- Starting Complaints Workflow Verification ---")

    # Manual Schema Migration (SQLite)
    # Since we don't have Alembic, we add columns if missing.
    from sqlalchemy import text
    try:
        with db.begin():
            # Check/Add columns
            # precise check via PRAGMA or just try/except ALTER
            try: db.execute(text("ALTER TABLE complaints ADD COLUMN assigned_at DATETIME"))
            except Exception: pass
            
            try: db.execute(text("ALTER TABLE complaints ADD COLUMN status_changed_at DATETIME"))
            except Exception: pass
            
            try: db.execute(text("ALTER TABLE complaints ADD COLUMN status_changed_by_user_id VARCHAR"))
            except Exception: pass
            
            try: db.execute(text("ALTER TABLE complaints ADD COLUMN resolved_at DATETIME"))
            except Exception: pass
            
            try: db.execute(text("ALTER TABLE complaints ADD COLUMN closed_at DATETIME"))
            except Exception: pass

            try: db.execute(text("ALTER TABLE complaints ADD COLUMN assigned_to_user_id VARCHAR"))
            except Exception: pass
            
            print("Schema migration attempted.")
    except Exception as e:
        print(f"Migration error: {e}")
    
    try:
        # 1. Setup Data
        school_id = uuid.UUID("c8bdc263-4d0a-4cce-8c6c-9c2dcb79f8da") # From previous seed
        principal_id = uuid.UUID("3d245f44-8f79-438f-acbc-fae2ebd1cc1f") # From previous seed
        
        # Create a "Student" user for testing unauthorized access
        student_id = uuid.uuid4()
        student_user = User(
            id=student_id,
            email=f"student_test_{uuid.uuid4()}@test.com",
            hashed_password="hash",
            role="student",
            school_id=school_id,
            first_name="Test",
            last_name="Student"
        )
        db.add(student_user)
        # Fetch Principal to get email
        principal = db.query(User).filter(User.id == principal_id).first()
        if not principal:
            print("Principal not found in DB! Creating one...")
            principal = User(
                id=principal_id,
                email="principal@test.com",
                hashed_password="hash",
                role="principal",
                school_id=school_id,
                first_name="Principal",
                last_name="User"
            )
            db.add(principal)
            db.commit()

        # Tokens (Use Email for sub as per dependencies.py)
        # MUST include token_version as per dependencies check (Kill switch)
        principal_token = create_access_token(data={"sub": principal.email, "token_version": 1})
        student_token = create_access_token(data={"sub": student_user.email, "token_version": 1})
        
        principal_headers = {"Authorization": f"Bearer {principal_token}"}
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # 2. Create Complaint (NEW)
        print("\n[Step 1] Creating Complaint...")
        payload = {
            "title": "Workflow Test Complaint",
            "description": "Testing transitions",
            "category": "student",
            "severity": "low"
        }
        res = client.post("/api/complaints", json=payload, headers=principal_headers)
        if res.status_code != 200:
            print(f"FAILED to create complaint: {res.text}")
            return
        
        complaint_data = res.json()
        complaint_id = complaint_data["id"]
        print(f"Created Complaint ID: {complaint_id} Status: {complaint_data['status']}")
        
        # Verify Audit Log for Creation (Implicitly handled in router/service if audit listener is active, but we added explicit ones for mutations)
        # Note: Creation audit log isn't explicit in my router code above, it relied on global listener or service. 
        # But Status Change IS enforced. Let's check status change logic.

        # 3. Invalid Transition: NEW -> RESOLVED (Should fail)
        print("\n[Step 2] Testing Invalid Transition (NEW -> RESOLVED)...")
        res = client.patch(f"/api/complaints/{complaint_id}/status", json={"status": "RESOLVED"}, headers=principal_headers)
        if res.status_code == 400:
            print("SUCCESS: Invalid transition blocked (400).")
        else:
            print(f"FAILED: Invalid transition allowed or wrong error: {res.status_code}")

        # 4. Valid Transition: NEW -> UNDER_REVIEW
        print("\n[Step 3] Testing Valid Transition (NEW -> UNDER_REVIEW)...")
        res = client.patch(f"/api/complaints/{complaint_id}/status", json={"status": "UNDER_REVIEW"}, headers=principal_headers)
        if res.status_code == 200:
            print("SUCCESS: Status updated to UNDER_REVIEW.")
            # Verify Timestamp
            c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
            if c.status_changed_at: 
                print("SUCCESS: status_changed_at updated.")
            else:
                print("FAILED: status_changed_at NOT updated.")
                
            # Verify Audit Log
            log = db.query(AuditLog).filter(
                AuditLog.record_id == complaint_id, 
                AuditLog.action_type == "COMPLAINT_STATUS_CHANGED"
            ).order_by(AuditLog.timestamp.desc()).first()
            
            if log:
                print(f"SUCCESS: Audit Log found: {log.action_type} - {log.reason}")
            else:
                print("FAILED: No Audit Log created for status change.")
        else:
            print(f"FAILED: Valid transition failed: {res.text}")

        # 5. RBAC Test: Student tries to update status
        print("\n[Step 4] Testing RBAC (Student update)...")
        # Add student as participant so they pass 404/403 partition check, but fail Role check
        db.add(ComplaintParticipant(complaint_id=complaint_id, user_id=str(student_user.id)))
        db.commit()
        
        res = client.patch(f"/api/complaints/{complaint_id}/status", json={"status": "IN_PROGRESS"}, headers=student_headers)
        if res.status_code == 403:
            print("SUCCESS: Student blocked from updating status (403).")
        else:
            print(f"FAILED: Student allowed to update status: {res.status_code}")

        # 6. Full Lifecycle to CLOSED
        print("\n[Step 5] Completing Lifecycle (UNDER_REVIEW -> IN_PROGRESS -> RESOLVED -> CLOSED)...")
        
        # -> IN_PROGRESS
        res = client.patch(f"/api/complaints/{complaint_id}/status", json={"status": "IN_PROGRESS"}, headers=principal_headers)
        if res.status_code != 200: print(f"Failed IN_PROGRESS: {res.text}")
        
        # -> RESOLVED
        res = client.patch(f"/api/complaints/{complaint_id}/status", json={"status": "RESOLVED"}, headers=principal_headers)
        if res.status_code != 200: print(f"Failed RESOLVED: {res.text}")
        
        # Check resolved_at
        db.refresh(c)
        if c.resolved_at: print("SUCCESS: resolved_at set.")
        else: print("FAILED: resolved_at missing.")

        # -> CLOSED
        res = client.patch(f"/api/complaints/{complaint_id}/status", json={"status": "CLOSED"}, headers=principal_headers)
        if res.status_code != 200: print(f"Failed CLOSED: {res.text}")
        
        # Check closed_at
        db.refresh(c)
        if c.closed_at: print("SUCCESS: closed_at set.")
        else: print("FAILED: closed_at missing.")

        # 7. Assignment Audit Log
        print("\n[Step 6] Testing Assignment & Audit...")
        res = client.patch(f"/api/complaints/{complaint_id}/assign", json={"assigned_to_user_id": str(principal_id)}, headers=principal_headers)
        if res.status_code == 200:
             log = db.query(AuditLog).filter(
                AuditLog.record_id == complaint_id, 
                AuditLog.action_type == "COMPLAINT_ASSIGNED"
            ).first()
             if log: print(f"SUCCESS: Assignment Audit Log found: {log.reason}")
             else: print("FAILED: Assignment Audit Log missing.")
        else:
            print(f"FAILED to assign: {res.text}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"An error occurred: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    verify_workflow()
