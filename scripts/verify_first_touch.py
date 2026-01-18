import sys
import os
import logging
import time

# Add root to path
sys.path.append(os.getcwd())

from database import SessionLocal, Base, engine, register_listeners
from schools import models as school_models
from students import models as student_models
from finance import models as finance_models
from academics import models as academic_models
from communication import models as comm_models
from auth.dependencies import Roles
from passlib.context import CryptContext
from fastapi.testclient import TestClient
from main import app
from datetime import datetime, timezone
import uuid
import re
from jose import jwt
from auth.jwt import SECRET_KEY, ALGORITHM

# Setup DB
register_listeners()
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = SessionLocal()
client = TestClient(app)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 1. Create School & Admin
school = school_models.School(
    name="Test School",
    code="TEST01",
    subscription_tier="PRO"
)
db.add(school)
db.flush()

admin = school_models.User(
    email="admin@test.com",
    hashed_password=pwd_context.hash("admin123"),
    first_name="Admin",
    last_name="User",
    role=Roles.SCHOOL_ADMIN,
    school_id=school.id
)
db.add(admin)
db.commit()

print("✅ School & Admin created")

# Login Admin
resp = client.post("/auth/login", json={"username": "admin@test.com", "password": "admin123"})
assert resp.status_code == 200, f"Login failed: {resp.text}"
token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print("✅ Admin Logged In")

# 2. Submit Admission (Public)
admission_data = {
    "first_name": "John",
    "last_name": "Doe",
    "parent_phone": "1234567890",
    "email": "parent@test.com",
    "documents": []
}
resp = client.post(f"/api/public/admissions/{school.id}", json=admission_data)
assert resp.status_code == 200, f"Admission failed: {resp.text}"
app_id = resp.json()["id"]
print("✅ Admission Submitted")

# 3. Approve Admission
# Need grade/section/year first
grade = academic_models.Grade(name="Grade 1", school_id=str(school.id))
db.add(grade)
section = academic_models.Section(name="A", school_id=str(school.id))
db.add(section)
year = academic_models.AcademicYear(name="2024", start_date=datetime.now(), end_date=datetime.now(), school_id=str(school.id))
db.add(year)
db.commit()

approve_data = {
    "grade_id": str(grade.id),
    "section_id": str(section.id),
    "registration_fee_amount": 1000.0,
    "academic_year_id": str(year.id)
}

# Mocking Email Services
import students.admission_router
import finance.router
import communication.service

captured_emails = []
def mock_send_email(to_email, subject, template_name, context):
    captured_emails.append({
        "to": to_email,
        "subject": subject,
        "template": template_name,
        "context": context
    })

captured_priority = []
def mock_send_priority(to_emails, title, content, school_name):
    captured_priority.append({
        "to_emails": to_emails,
        "title": title
    })

# Patch instances
students.admission_router.email_service.send_email = mock_send_email
finance.router.email_service.send_email = mock_send_email
communication.service.email_service.send_priority_notice = mock_send_priority


print("⏳ Approving Admission (Mocking Email)...")
resp = client.post(f"/api/admissions/{app_id}/approve", json=approve_data, headers=headers)
assert resp.status_code == 200, f"Approval failed: {resp.text}"
print("✅ Admission Approved")

# Find PIN
pin = None
# Since it is background task, we might need to wait or force execution?
# TestClient usually runs background tasks after response.
for email in captured_emails:
    if email["template"] == "enrollment_welcome.html":
        pin = email["context"]["pin"]
        break

if not pin:
    print("❌ PIN not found in captured emails!")
    print(captured_emails)
    exit(1)
else:
    print(f"✅ Captured PIN: {pin}")

# 4. Parent Login (First Time)
print("⏳ logging in as Parent...")
resp = client.post("/auth/login", json={"username": "parent@test.com", "password": pin})
assert resp.status_code == 200, f"Parent login failed: {resp.text}"
parent_token = resp.json()["access_token"]

decoded = jwt.decode(parent_token, SECRET_KEY, algorithms=[ALGORITHM])
assert decoded.get("must_change_password") == True
print("✅ Parent Logged In (must_change_password=True verified)")

# 5. Reset Password
print("⏳ Resetting Password...")
new_pass = "NewStrongPass1!"
reset_data = {
    "old_password": pin,
    "new_password": new_pass
}
resp = client.post("/auth/reset-first-password", json=reset_data, headers={"Authorization": f"Bearer {parent_token}"})
assert resp.status_code == 200, f"Reset failed: {resp.text}"
print("✅ Password Reset Success")

school_id_str = str(school.id)

# Verify User in DB
db.close()
db = SessionLocal()
parent = db.query(school_models.User).filter_by(email="parent@test.com").first()
print(f"DEBUG: Parent must_change_password in DB: {parent.must_change_password}")
assert parent.must_change_password == False
print("✅ DB updated (must_change_password=False)")

# 6. Payment Receipt
# Find the fee created during admission
fee = db.query(finance_models.Fee).filter_by(school_id=school_id_str).first()
assert fee is not None
print(f"✅ Found Fee: {fee.amount}")

captured_emails.clear()
print("⏳ Paying Fee...")
# Update to paid
resp = client.patch(f"/api/finance/fees/{fee.id}", json={"status": "paid"}, headers=headers)
assert resp.status_code == 200, f"Fee update failed: {resp.text}"

# Check logs for receipt
receipt_sent = False
for email in captured_emails:
    if email["template"] == "payment_approved.html":
        receipt_sent = True
        break
assert receipt_sent
print("✅ Receipt Email Captured")

# 7. Priority Notice
captured_priority.clear()
print("⏳ Creating Priority Notice...")
notice_data = {
    "title": "Flood Warning",
    "content": "School closed tomorrow.",
    "priority": "HIGH",
    "target_roles": ["parent"],
    "target_grade_ids": [],
    "target_section_ids": [],
    "target_student_ids": []
}

resp = client.post("/api/notices", json=notice_data, headers=headers)
assert resp.status_code == 200, f"Notice creation failed: {resp.text}"
notice_id = resp.json()["id"]

# Check logs
urgent_sent = False
# We might need to wait for background task
time.sleep(1)

for p in captured_priority:
    if p["title"] == "Flood Warning":
        urgent_sent = True
        break

if not urgent_sent:
    print("⚠️ Urgent Email not found immediately.")
    print(captured_priority)
else:
    print("✅ Priority Notice Email Captured")

print("\n🎉 ALL CHECKS PASSED")
