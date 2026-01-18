import sys
import os
import logging

# Add root to path
sys.path.append(os.getcwd())

from database import SessionLocal, Base, engine, register_listeners
from schools import models as school_models
from auth.dependencies import Roles
from passlib.context import CryptContext
from fastapi.testclient import TestClient
from main import app
import uuid

# Setup DB
register_listeners()
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = SessionLocal()
client = TestClient(app)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 1. Create School
school = school_models.School(
    name="RBAC School",
    code="RBAC01",
    subscription_tier="PRO"
)
db.add(school)
db.flush()

# 2. Create Teacher
teacher = school_models.User(
    email="teacher@rbac.com",
    hashed_password=pwd_context.hash("teach123"),
    first_name="Teacher",
    last_name="Test",
    role=Roles.TEACHER,
    school_id=school.id,
    token_version=1
)
db.add(teacher)
db.commit()

# Login Teacher
resp = client.post("/auth/login", json={"username": "teacher@rbac.com", "password": "teach123"})
assert resp.status_code == 200
token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("✅ Teacher Logged In")

# 3. Test Access to Admissions (Should Fail)
print("⏳ Testing Admission Access (Should Fail)...")
resp = client.get("/api/admissions", headers=headers)
if resp.status_code == 403:
    print("✅ Admission Access Denied (403) - Correct")
else:
    print(f"❌ FAILED: Teacher accessed admissions! Status: {resp.status_code}")
    exit(1)

# 4. Test Access to Board/Users (Should Fail)
print("⏳ Testing Governance/Board Access (Should Fail)...")
resp = client.post("/api/finance/fees", json={"student_id": "123", "amount": 100, "description": "test"}, headers=headers)
if resp.status_code == 403:
    print("✅ Finance Write Access Denied (403) - Correct")
else:
    print(f"❌ FAILED: Teacher accessed finance! Status: {resp.status_code}")
    exit(1)

print("\n🎉 RBAC CHECK PASSED")
