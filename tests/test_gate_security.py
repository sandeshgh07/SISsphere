from schools.models import User, School
from students.models import Student, ParentStudentLink, SecurityBlock
from schools.constants import SubscriptionTier
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
import datetime
import jwt
import os
import uuid
import pytest
from fastapi.testclient import TestClient
from main import app
from auth.dependencies import get_current_user, TenantAccess, Roles
from auth.subscription import require_subscription_feature

# Setup Test DB
Base.metadata.create_all(bind=engine)

client = TestClient(app)

# Mock Data
# We use constant code to find existing
SCHOOL_CODE = "SCHA_TEST_SEC"
SCHOOL_B_CODE = "SCHB_TEST_SEC"

# Globals to be populated by setup
SCHOOL_ID_UUID = None
SCHOOL_ID = None
SCHOOL_B_ID_UUID = None
SCHOOL_B_ID = None

STUDENT_ID = str(uuid.uuid4())
PARENT_ID_UUID = uuid.uuid4()
PARENT_ID = str(PARENT_ID_UUID)
GUARD_ID_UUID = uuid.uuid4()
GUARD_ID = str(GUARD_ID_UUID)
ADMIN_ID_UUID = uuid.uuid4()
ADMIN_ID = str(ADMIN_ID_UUID)

@pytest.fixture
def db():
    db = SessionLocal()
    yield db
    db.close()

@pytest.fixture
def setup_data(db):
    global SCHOOL_ID_UUID, SCHOOL_ID, SCHOOL_B_ID_UUID, SCHOOL_B_ID, PARENT_ID, PARENT_ID_UUID, GUARD_ID, GUARD_ID_UUID, ADMIN_ID, ADMIN_ID_UUID

    # Create School (Find by Code)
    school = db.query(School).filter_by(code=SCHOOL_CODE).first()
    if not school:
        school = School(id=uuid.uuid4(), name="School A", code=SCHOOL_CODE, is_active=True, subscription_tier=SubscriptionTier.PRO)
        db.add(school)
        db.flush()
    else:
        # Ensure tier is PRO
        school.subscription_tier = SubscriptionTier.PRO
        db.add(school)

    SCHOOL_ID_UUID = school.id
    SCHOOL_ID = str(school.id)

    school_b = db.query(School).filter_by(code=SCHOOL_B_CODE).first()
    if not school_b:
        school_b = School(id=uuid.uuid4(), name="School B", code=SCHOOL_B_CODE, is_active=True, subscription_tier=SubscriptionTier.PRO)
        db.add(school_b)
        db.flush()

    SCHOOL_B_ID_UUID = school_b.id
    SCHOOL_B_ID = str(school_b.id)

    # Student
    student = db.query(Student).filter_by(id=STUDENT_ID).first()
    if not student:
        student = Student(id=STUDENT_ID, first_name="John", last_name="Doe", school_id=SCHOOL_ID, roll_number="1")
        db.add(student)
    else:
        student.school_id = SCHOOL_ID
        student.pickup_blocked = False # Reset
        db.add(student)

    # Parent
    parent = db.query(User).filter_by(email="parent_sec@test.com").first()
    if not parent:
        parent = User(id=PARENT_ID_UUID, email="parent_sec@test.com", role=Roles.PARENT, school_id=SCHOOL_ID_UUID, is_active=True, hashed_password="pw", first_name="P", last_name="T")
        db.add(parent)
    else:
        parent.school_id = SCHOOL_ID_UUID
        db.add(parent)

    PARENT_ID_UUID = parent.id
    PARENT_ID = str(parent.id)

    # Guard
    guard = db.query(User).filter_by(email="guard_sec@test.com").first()
    if not guard:
        guard = User(id=GUARD_ID_UUID, email="guard_sec@test.com", role=Roles.SECURITY_GUARD, school_id=SCHOOL_ID_UUID, is_active=True, hashed_password="pw", first_name="G", last_name="T")
        db.add(guard)
    else:
        guard.school_id = SCHOOL_ID_UUID
        db.add(guard)

    GUARD_ID_UUID = guard.id
    GUARD_ID = str(guard.id)

    # Admin (Need for block tests)
    admin = db.query(User).filter_by(email="admin_sec@test.com").first()
    if not admin:
        admin = User(id=ADMIN_ID_UUID, email="admin_sec@test.com", role=Roles.SCHOOL_ADMIN, school_id=SCHOOL_ID_UUID, is_active=True, hashed_password="pw", first_name="Admin", last_name="User")
        db.add(admin)
    else:
        admin.school_id = SCHOOL_ID_UUID
        db.add(admin)

    ADMIN_ID_UUID = admin.id
    ADMIN_ID = str(admin.id)

    # Link
    db.flush()
    link = db.query(ParentStudentLink).filter_by(parent_id=str(parent.id), student_id=STUDENT_ID).first()
    if not link:
        link = ParentStudentLink(parent_id=str(parent.id), student_id=STUDENT_ID, school_id=SCHOOL_ID, is_authorized_pickup=True)
        db.add(link)
    else:
        link.is_authorized_pickup = True # Reset
        db.add(link)

    # Clear Blocks
    db.query(SecurityBlock).filter_by(school_id=SCHOOL_ID).delete()

    db.commit()
    return

# Helper to create token
def create_token(student_id, school_id, parent_id=None, type="GATE_PASS", expired=False):
    exp = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5)
    if expired:
        exp = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=5)

    payload = {
        "sub": student_id,
        "parent_id": parent_id,
        "school_id": school_id,
        "jti": str(uuid.uuid4()),
        "type": type,
        "exp": exp,
        "iat": datetime.datetime.now(datetime.timezone.utc)
    }
    return jwt.encode(payload, os.getenv("JWT_SECRET_KEY", "changeme"), algorithm="HS256")

def test_scan_success(setup_data):
    # Mock Guard
    app.dependency_overrides[get_current_user] = lambda: User(id=GUARD_ID_UUID, role=Roles.SECURITY_GUARD, school_id=SCHOOL_ID_UUID)

    token = create_token(STUDENT_ID, SCHOOL_ID, parent_id=PARENT_ID)
    response = client.post("/api/attendance/gate/scan", json={"token": token})
    print(response.json())
    assert response.status_code == 200
    assert response.json()["status"] == "Success"
    assert response.json()["parent_name"] is not None

def test_unauthorized_pickup_flag(setup_data, db):
    app.dependency_overrides[get_current_user] = lambda: User(id=GUARD_ID_UUID, role=Roles.SECURITY_GUARD, school_id=SCHOOL_ID_UUID)

    # Unauthorize Link
    link = db.query(ParentStudentLink).filter_by(parent_id=PARENT_ID, student_id=STUDENT_ID).first()
    link.is_authorized_pickup = False
    db.commit()

    token = create_token(STUDENT_ID, SCHOOL_ID, parent_id=PARENT_ID)
    response = client.post("/api/attendance/gate/scan", json={"token": token})
    assert response.status_code == 403
    assert "not authorized" in response.json()["detail"]

def test_block_parent_only(setup_data, db):
    app.dependency_overrides[get_current_user] = lambda: User(id=GUARD_ID_UUID, role=Roles.SECURITY_GUARD, school_id=SCHOOL_ID_UUID)

    # Block Parent
    block = SecurityBlock(school_id=SCHOOL_ID, parent_id=PARENT_ID, reason="Fees Due")
    db.add(block)
    db.commit()

    token = create_token(STUDENT_ID, SCHOOL_ID, parent_id=PARENT_ID)
    response = client.post("/api/attendance/gate/scan", json={"token": token})
    assert response.status_code == 403
    assert "Fees Due" in response.json()["detail"]

def test_block_pair_only(setup_data, db):
    app.dependency_overrides[get_current_user] = lambda: User(id=GUARD_ID_UUID, role=Roles.SECURITY_GUARD, school_id=SCHOOL_ID_UUID)

    # Block Pair (Custody)
    block = SecurityBlock(school_id=SCHOOL_ID, parent_id=PARENT_ID, student_id=STUDENT_ID, reason="Custody Order")
    db.add(block)
    db.commit()

    token = create_token(STUDENT_ID, SCHOOL_ID, parent_id=PARENT_ID)
    response = client.post("/api/attendance/gate/scan", json={"token": token})
    assert response.status_code == 403
    assert "Custody Order" in response.json()["detail"]

def test_block_student_only(setup_data, db):
    app.dependency_overrides[get_current_user] = lambda: User(id=GUARD_ID_UUID, role=Roles.SECURITY_GUARD, school_id=SCHOOL_ID_UUID)

    # Block Student (e.g. sick bay)
    block = SecurityBlock(school_id=SCHOOL_ID, student_id=STUDENT_ID, reason="Medical Hold")
    db.add(block)
    db.commit()

    token = create_token(STUDENT_ID, SCHOOL_ID, parent_id=PARENT_ID)
    response = client.post("/api/attendance/gate/scan", json={"token": token})
    assert response.status_code == 403
    assert "Medical Hold" in response.json()["detail"]
