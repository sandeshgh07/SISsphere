import pytest
from fastapi.testclient import TestClient
from main import app
from schools.models import User, UserRole, School
from database import SessionLocal
import uuid
from auth.jwt import create_access_token

client = TestClient(app)

@pytest.fixture
def db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def principal_token(db):
    # Ensure a school and principal user exists
    school = db.query(School).first()
    if not school:
        school = School(name="Test School", code=f"test{uuid.uuid4()}", is_active=True)
        db.add(school)
        db.commit()

    email = f"principal_test_{uuid.uuid4()}@example.com"
    user = User(
        email=email,
        hashed_password="hashed_password",
        first_name="Principal",
        last_name="Test",
        role="principal",
        school_id=school.id,
        is_active=True,
        phone="1234567890"
    )
    db.add(user)
    db.commit()

    return create_access_token(data={"sub": user.email, "role": user.role, "school_id": str(user.school_id), "token_version": 1})

def test_list_users(principal_token):
    response = client.get("/api/users", headers={"Authorization": f"Bearer {principal_token}"})
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_user(principal_token):
    # Need to fetch school_id from token or assume context.
    # The payload requires school_id (UserCreate schema), even if backend ignores it for logic (using current_user.school_id)
    # Let's see schema validation.

    payload = {
        "full_name": "New User",
        "email": f"newuser_{uuid.uuid4()}@example.com",
        "password": "password123",
        "role": "teacher",
        "phone": "9876543210",
        "school_id": str(uuid.uuid4()) # Dummy UUID
    }
    response = client.post("/api/users", json=payload, headers={"Authorization": f"Bearer {principal_token}"})
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["phone"] == "9876543210"
    assert data["full_name"] == "New User"

    # Verify search
    search_res = client.get(f"/api/users?q={data['phone']}", headers={"Authorization": f"Bearer {principal_token}"})
    assert search_res.status_code == 200
    assert len(search_res.json()) >= 1
    found_emails = [u["email"] for u in search_res.json()]
    assert payload["email"] in found_emails

def test_management_endpoints(principal_token):
    # Create user first
    payload = {
        "full_name": "Manage User",
        "email": f"manage_{uuid.uuid4()}@example.com",
        "password": "password123",
        "role": "teacher",
        "school_id": str(uuid.uuid4())
    }
    create_res = client.post("/api/users", json=payload, headers={"Authorization": f"Bearer {principal_token}"})
    user_id = create_res.json()["id"]

    # Disable
    res = client.post(f"/api/users/{user_id}/disable", headers={"Authorization": f"Bearer {principal_token}"})
    assert res.status_code == 200

    # List inactive
    res = client.get("/api/users?status=inactive", headers={"Authorization": f"Bearer {principal_token}"})
    assert res.status_code == 200
    ids = [u["id"] for u in res.json()]
    assert user_id in ids

    # Enable
    res = client.post(f"/api/users/{user_id}/enable", headers={"Authorization": f"Bearer {principal_token}"})
    assert res.status_code == 200

    # Add role
    res = client.patch(f"/api/users/{user_id}/roles", json={"roles": ["teacher", "parent"]}, headers={"Authorization": f"Bearer {principal_token}"})
    assert res.status_code == 200
    assert "parent" in res.json()["roles"]
    assert "teacher" in res.json()["roles"]
