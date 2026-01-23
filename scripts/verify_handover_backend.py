import sys
import os
import uuid
from datetime import datetime
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

# Add root to sys.path
sys.path.append(os.getcwd())

from main import app
from database import SessionLocal
from schools.models import User, School, SubscriptionTier
from auth.dependencies import Roles
from passlib.context import CryptContext
from audit.models import AuditLog

client = TestClient(app)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def run_verification():
    print("Starting Principal Handover Verification...")
    db = SessionLocal()
    
    try:
        # 1. Setup Data
        suffix = uuid.uuid4().hex[:6]
        
        # Create School
        school = School(
            name=f"Handover Test School {suffix}",
            code=f"HTS{suffix}",
            country="Nepal",
            subscription_tier=SubscriptionTier.PRO,
            is_active=True,
            subscription_expiry=datetime.utcnow()
        )
        db.add(school)
        db.commit()
        db.refresh(school)
        print(f"Created School: {school.name} ({school.id})")

        # Create Old Principal
        old_principal = User(
            email=f"old_principal_{suffix}@test.com",
            hashed_password=pwd_context.hash("password"),
            first_name="Old",
            last_name="Principal",
            role=Roles.PRINCIPAL,
            school_id=school.id,
            is_active=True
        )
        db.add(old_principal)
        
        # Create SuperAdmin (Actor)
        super_admin = User(
            email=f"super_admin_{suffix}@test.com",
            hashed_password=pwd_context.hash("password"),
            first_name="Super",
            last_name="Admin",
            role=Roles.SUPER_ADMIN,
            school_id=school.id, # Superadmin might belong to a school or be null? In this system usually distinct.
            # Assuming SuperAdmin role bypasses school check in require_roles or has its own logic.
            is_active=True
        )
        # Note: In this codebase, SuperAdmin usually needs to be logged in to get a token.
        # But with TestClient we can simulate dependency override OR just login.
        # Let's try to just login.
        db.add(super_admin)
        
        db.commit()
        db.refresh(old_principal)
        db.refresh(super_admin)
        
        print(f"Created Old Principal: {old_principal.email}")
        print(f"Created Super Admin: {super_admin.email}")

        # Login as SuperAdmin
        login_res = client.post("/api/auth/login", json={
            "username": super_admin.email,
            "password": "password",
            "school_id": str(school.id)
        })
        if login_res.status_code != 200:
            print(f"Login failed: {login_res.text}")
            return
        
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Test Handover (Create New Principal, Demote Old to Teacher)
        print("\nTesting: Create New Principal & Demote Old to Teacher...")
        
        payload = {
            "create_new_principal": True,
            "new_principal_data": {
                "full_name": "New Principal User",
                "email": f"new_principal_{suffix}@test.com",
                "password": "password123",
                "phone": "9800000000"
            },
            "old_principal_id": str(old_principal.id),
            "old_principal_fate": "demote_teacher",
            "old_principal_grades": [] # Valid for teacher? Maybe need grades if logic enforces it? 
            # The backend logic I wrote didn't strictly enforce grade assignment in the router itself, 
            # checks were in frontend or simpler. 
            # Looking at my code: 
            # if request.old_principal_fate == "demote_teacher": new_role = Roles.TEACHER
            # It didn't assign grades in the DB.
        }

        res = client.post(
            f"/api/schools/{school.id}/handover-principal",
            json=payload,
            headers=headers
        )

        if res.status_code != 200:
            print(f"Handover failed: {res.status_code} - {res.text}")
            return # Exit if failed
        
        print("Handover API Response: Success")

        # 3. Verify DB State
        db.refresh(old_principal)
        new_principal_email = payload["new_principal_data"]["email"]
        new_principal = db.query(User).filter(User.email == new_principal_email).first()

        # Check Old Principal Role
        if old_principal.role == Roles.TEACHER:
            print("✅ Old Principal role updated to TEACHER")
        else:
            print(f"❌ Old Principal role mismatch: {old_principal.role}")

        # Check New Principal Role
        if new_principal and new_principal.role == Roles.PRINCIPAL:
            print("✅ New Principal created with role PRINCIPAL")
        else:
            print(f"❌ New Principal not found or wrong role")

        # Check Audit Log
        # We expect at least 3 logs: User Create, Old Principal Demotion, New Principal Promotion (wait, promotion log logic?)
        # My code: 
        # 1. New Principal Create -> Log "USER_CREATE"
        # 2. Demote Old -> Log "PRINCIPAL_DEMOTION"
        # 3. Promote New -> wait, if create_new=True, I created with role=Principal.
        #    Did I add a "PRINCIPAL_PROMOTION" log in that branch?
        #    Looking at code: 
        #       if create_new: ... create with role=PRINCIPAL ... log USER_CREATE
        #       elif new_principal_id: ... update role ... log PRINCIPAL_PROMOTION
        #    So for create, only USER_CREATE log is expected.
        
        logs = db.query(AuditLog).filter(AuditLog.actor_id == str(super_admin.id)).order_by(AuditLog.timestamp.desc()).all()
        print(f"\nFound {len(logs)} audit logs for this actor.")
        
        has_demotion = any(l.action_type == "PRINCIPAL_DEMOTION" for l in logs)
        has_creation = any(l.action_type == "USER_CREATE" for l in logs)
        
        if has_demotion:
            print("✅ Audit Log found for Principal Demotion")
        else:
            print("❌ Audit Log MISSING for Principal Demotion")
            
        if has_creation:
            print("✅ Audit Log found for User Creation")
        else:
            print("❌ Audit Log MISSING for User Creation")

    except Exception as e:
        print(f"❌ Verification Exception: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run_verification()
