import pytest
from fastapi.testclient import TestClient
from main import app
from database import SessionLocal, Base, engine
from schools.models import School, User
from students.models import AdmissionApplication, AdmissionStatus
from schools.constants import SubscriptionTier
from auth.jwt import create_access_token
import uuid
import time

# Use a separate DB session for verify/setup but TestClient uses the app's dependency.
# Overriding dependency might be cleaner, but using real DB (sqlite file) is fine for this env.
# We just need to make sure we don't conflict.

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_db():
    # Ensure tables exist
    # Base.metadata.create_all(bind=engine) # Already done by init_db or main
    db = SessionLocal()

    # Create a clean school for this test module
    school_uuid_obj = uuid.uuid4()
    school_id = str(school_uuid_obj)
    school = School(id=school_uuid_obj, name="Security Test School", code=f"SEC{uuid.uuid4().hex[:4]}", subscription_tier=SubscriptionTier.PRO)
    db.add(school)
    db.commit()

    yield db, school_id

    # Cleanup
    db.query(School).filter(School.id == school_uuid_obj).delete()
    db.commit()
    db.close()

def test_sql_injection(setup_db):
    db, school_id = setup_db
    malicious_name = "'; DROP TABLE users; --"
    file_content = b"%PDF-1.4 header"

    response = client.post(
        f"/api/public/admissions/{school_id}",
        data={
            "first_name": malicious_name,
            "last_name": "Doe",
            "parent_phone": "1234567890",
            "age": 10,
            "target_grade": "5",
            "terms": "true"
        },
        files={"transcript": ("test.pdf", file_content, "application/pdf")}
    )
    assert response.status_code == 200, response.text

    application = db.query(AdmissionApplication).filter(AdmissionApplication.first_name == malicious_name).first()
    assert application is not None
    assert application.first_name == malicious_name

def test_file_validation_fail(setup_db):
    db, school_id = setup_db
    file_content = b"This is text content."

    response = client.post(
        f"/api/public/admissions/{school_id}",
        data={
            "first_name": "Bad",
            "last_name": "File",
            "parent_phone": "123",
            "age": 10,
            "target_grade": "5",
            "terms": "true"
        },
        files={"transcript": ("test.png", file_content, "image/png")}
    )
    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]

def test_enrollment_flow(setup_db):
    db, school_id = setup_db

    # 1. Submit Valid App
    file_content = b"\xFF\xD8\xFF\xE0\x00\x10JFIF" # JPEG Header
    response = client.post(
        f"/api/public/admissions/{school_id}",
        data={
            "first_name": "John",
            "last_name": "Doe",
            "parent_phone": "555-0100",
            "email": f"john.doe.{uuid.uuid4().hex[:4]}@example.com",
            "age": 10,
            "target_grade": "5",
            "terms": "true"
        },
        files={"transcript": ("valid.jpg", file_content, "image/jpeg")}
    )
    assert response.status_code == 200
    app_id = response.json()["application_id"]

    # 2. Setup Principal
    principal_email = f"principal.{uuid.uuid4().hex[:4]}@test.com"
    principal = User(
        email=principal_email,
        hashed_password="hash",
        first_name="Admin",
        last_name="User",
        role="principal",
        school_id=uuid.UUID(school_id)
    )
    db.add(principal)
    db.commit()

    token = create_access_token(data={"sub": principal.email, "role": "principal", "school_id": str(school_id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Mark Eligible
    res = client.post(f"/api/admissions/{app_id}/eligibility", data={"status": "ELIGIBLE"}, headers=headers)
    assert res.status_code == 200

    # 4. Enroll
    res = client.post(f"/api/admissions/{app_id}/enroll", headers=headers)
    assert res.status_code == 200
    data = res.json()
    pin = data["pin"]
    user_email = data["user_email"]

    # 5. Verify User
    student_user = db.query(User).filter(User.email == user_email).first()
    assert student_user is not None
    assert student_user.force_password_change is True

    # 6. Login with PIN
    login_res = client.post("/api/auth/login", json={"username": user_email, "password": pin})
    assert login_res.status_code == 200
    assert login_res.json()["require_password_change"] is True

    # 7. Finalize Setup (Change Password)
    token = login_res.json()["access_token"]
    setup_headers = {"Authorization": f"Bearer {token}"}

    new_password = "NewStrongPassword123!"
    setup_res = client.post("/api/auth/finalize-setup", json={
        "current_password": pin,
        "new_password": new_password,
        "confirm_password": new_password
    }, headers=setup_headers)
    assert setup_res.status_code == 200

    # 8. Verify Flag Updated
    db.rollback() # End current transaction to see changes from other connections

    # Re-fetch user by ID
    login_res_2 = client.post("/api/auth/login", json={"username": user_email, "password": new_password})
    assert login_res_2.status_code == 200
    assert login_res_2.json()["require_password_change"] is False

def test_rate_limiting(setup_db):
    db, school_id = setup_db
    file_content = b"\xFF\xD8\xFF\xE0\x00\x10JFIF"

    # We already made requests in previous tests.
    # The limiter is 5/hour.
    # Previous tests:
    # 1. test_sql_injection (1 req)
    # 2. test_file_validation_fail (1 req)
    # 3. test_enrollment_flow (1 req)
    # Total 3 requests so far from 'testclient' IP.
    # We need 2 more to hit 5. 6th should fail.

    for i in range(2):
        client.post(
            f"/api/public/admissions/{school_id}",
            data={"first_name": "Rate", "last_name": "Test", "parent_phone": "111", "age": 10, "target_grade": "1", "terms": "true"},
            files={"transcript": ("test.jpg", file_content, "image/jpeg")}
        )

    # Now next request should fail
    res = client.post(
        f"/api/public/admissions/{school_id}",
        data={"first_name": "Rate", "last_name": "Test", "parent_phone": "111", "age": 10, "target_grade": "1", "terms": "true"},
        files={"transcript": ("test.jpg", file_content, "image/jpeg")}
    )
    assert res.status_code == 429
