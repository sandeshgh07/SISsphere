import sys
import os
import uuid
sys.path.append(os.getcwd())

from fastapi.testclient import TestClient
from main import app
from schools.models import User, School
from auth.dependencies import get_db
from auth.jwt import create_access_token
from database import SessionLocal
from passlib.context import CryptContext

client = TestClient(app)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def test_governance_flow():
    db = SessionLocal()

    # 1. Setup School and Creator
    # Create unique school to avoid conflicts
    unique_suffix = str(uuid.uuid4())[:8]
    school = School(name=f"Gov School Test {unique_suffix}", code=f"gov-{unique_suffix}")
    db.add(school)
    db.commit()
    db.refresh(school)

    creator = User(
        first_name="Creator",
        last_name="Admin",
        email=f"creator.{unique_suffix}@gov.com",
        hashed_password=pwd_context.hash("password123"),
        role="super_admin",
        school_id=school.id,
        token_version=1
    )
    db.add(creator)
    db.commit()
    db.refresh(creator)

    # Login as Creator
    creator_token = create_access_token(
        data={"sub": creator.email, "role": creator.role, "school_id": str(school.id), "token_version": creator.token_version}
    )
    headers = {"Authorization": f"Bearer {creator_token}"}

    print("Step 1: Setup Complete")

    # 2. Create Target SuperAdmin
    target_data = {
        "first_name": "Target",
        "last_name": "Admin",
        "email": f"target.{unique_suffix}@gov.com",
        "password": "password123",
        "role": "super_admin"
    }

    resp = client.post("/api/governance/users", json=target_data, headers=headers)
    assert resp.status_code == 200, f"Creation failed: {resp.text}"
    target_id = resp.json()["id"]

    target_user = db.query(User).filter(User.id == uuid.UUID(target_id)).first()
    assert target_user.school_id == school.id
    assert target_user.role == "super_admin"
    print("Step 2: Creation Verified")

    # 3. Demote Target
    demote_data = {
        "new_role": "school_admin",
        "justification": "Performance issues observed over last quarter."
    }

    # Get a token for Target BEFORE demotion to test invalidation later
    target_old_token = create_access_token(
        data={"sub": target_user.email, "role": target_user.role, "school_id": str(school.id), "token_version": target_user.token_version}
    )

    resp = client.patch(f"/api/governance/users/{target_id}/role", json=demote_data, headers=headers)
    assert resp.status_code == 200, f"Demotion failed: {resp.text}"

    db.refresh(target_user)
    assert target_user.role == "school_admin"
    assert target_user.token_version == 2 # Started at 1, incremented to 2
    print("Step 3: Demotion Verified")

    # 4. Token Invalidation
    # Try using target_old_token (version 1)
    target_headers = {"Authorization": f"Bearer {target_old_token}"}
    # Try to access a protected route. Using update_school_logo as it is protected.
    resp = client.patch(f"/api/schools/{school.id}/logo", headers=target_headers)

    # Expect 401 because token_version mismatch (1 vs 2)
    assert resp.status_code == 401, f"Old token should be rejected. Got {resp.status_code}. Response: {resp.text}"
    print("Step 4: Token Invalidation Verified")

    # 5. Guardrail: Try to demote Creator (Last Man Standing)
    # Creator is super_admin. Target is now school_admin. Creator is the ONLY super_admin.
    demote_self_data = {
        "new_role": "school_admin",
        "justification": "I want to retire. " + "x"*10
    }
    resp = client.patch(f"/api/governance/users/{creator.id}/role", json=demote_self_data, headers=headers)
    assert resp.status_code == 400, f"Guardrail failed. Got {resp.status_code}"
    assert "Cannot demote the last SuperAdmin" in resp.text
    print("Step 5: Guardrail Verified")

    # 6. Audit Log
    # Check manual audit log entry
    from audit.models import AuditLog
    log = db.query(AuditLog).filter(AuditLog.action_type == "EXECUTIVE_ROLE_CHANGE", AuditLog.record_id == str(target_id)).first()
    assert log is not None, "Audit log not found"
    assert log.reason == demote_data["justification"]
    print("Step 6: Audit Log Verified")

    db.close()

if __name__ == "__main__":
    test_governance_flow()
