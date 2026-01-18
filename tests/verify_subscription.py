import sys
import os
from datetime import datetime, timedelta
sys.path.append(os.getcwd())

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from schools.models import School, User

client = TestClient(app)
db = SessionLocal()

def get_principal_creds():
    return {"username": "principal@nepsis.com", "password": "nepsis123"}

def login():
    creds = get_principal_creds()
    response = client.post("/api/auth/login", json=creds)
    if response.status_code != 200:
        print(f"Login failed: {response.status_code} {response.text}")
    assert response.status_code == 200
    return response.json()["access_token"]

def verify_access(token, expect_success=True):
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/schools", headers=headers)

    if expect_success:
        if response.status_code != 200:
            print(f"Expected 200, got {response.status_code}: {response.text}")
        assert response.status_code == 200
    else:
        if response.status_code != 403:
             print(f"Expected 403, got {response.status_code}: {response.text}")
        assert response.status_code == 403

def set_school_expiry(days_offset):
    school = db.query(School).filter(School.code == "NIA001").first()
    school.subscription_expiry = datetime.utcnow() + timedelta(days=days_offset)
    school.is_active = True
    db.commit()
    print(f"Set expiry to {days_offset} days from now.")

def set_school_active(is_active):
    school = db.query(School).filter(School.code == "NIA001").first()
    school.is_active = is_active
    db.commit()
    print(f"Set is_active to {is_active}.")

try:
    print("--- Test 1: Active Subscription ---")
    set_school_expiry(300)
    token = login()
    verify_access(token, expect_success=True)
    print("Test 1 Passed.")

    print("\n--- Test 2: Warning Phase (Future but close) ---")
    set_school_expiry(10)
    token = login()
    verify_access(token, expect_success=True)
    print("Test 2 Passed.")

    print("\n--- Test 3: Grace Phase (Expired 15 days ago) ---")
    set_school_expiry(-15)
    token = login()
    verify_access(token, expect_success=True)
    print("Test 3 Passed.")

    print("\n--- Test 4: Locked Phase (Expired 35 days ago) ---")
    set_school_expiry(-35)
    token = login()
    verify_access(token, expect_success=False)
    print("Test 4 Passed.")

    print("\n--- Test 5: Freeze (Manual Deactivation) ---")
    set_school_expiry(300)
    set_school_active(False)
    token = login()
    verify_access(token, expect_success=False)
    print("Test 5 Passed.")

    print("\nAll Tests Passed!")

finally:
    try:
        set_school_expiry(365)
        set_school_active(True)
    except:
        pass
    db.close()
