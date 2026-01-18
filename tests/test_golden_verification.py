from schools.models import User, School
from schools.constants import SubscriptionTier
from finance.models import Payment, Invoice, PaymentIntent, PaymentStatus
from students.models import Student, ParentStudentLink, SecurityBlock
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
import datetime
from datetime import timezone, timedelta
import uuid
import pytest
from fastapi.testclient import TestClient
from main import app
from auth.dependencies import get_current_user, Roles
from auth.subscription import require_subscription_feature

# Setup Test DB
Base.metadata.create_all(bind=engine)

client = TestClient(app)

# Use UUID objects for Models using Uuid type (School, User)
SCHOOL_UUID = uuid.uuid4()
SCHOOL_ID = str(SCHOOL_UUID) # For String columns (Payment, Student)

# Student uses String ID by default in models.py (checked earlier, wait, let's verify)
# students/models.py: id = Column(String, ...)
# schools/models.py: id = Column(Uuid, ...)
# users (parents) use Uuid in schools/models.py

STUDENT_ID = str(uuid.uuid4())

PARENT_UUID = uuid.uuid4()
PARENT_ID = str(PARENT_UUID)

@pytest.fixture
def db():
    db = SessionLocal()
    yield db
    db.close()

@pytest.fixture
def setup_golden_data(db):
    # Clean up existing data to prevent UNIQUE constraint errors
    existing_school = db.query(School).filter_by(code="SCH_GOLD").first()
    if existing_school:
        # Delete dependent data if needed, or just reuse
        # For simplicity, let's reuse if exists, but we need to ensure IDs match constants
        # Actually, best to delete and recreate to ensure clean state
        sid = existing_school.id
        # Delete dependent users/students/links/payments
        # This might be heavy due to FKs.
        # Let's try to update the constants to match found school? No, they are global.

        # Hard delete
        db.query(Payment).filter(Payment.school_id == str(sid)).delete()
        db.query(ParentStudentLink).filter(ParentStudentLink.school_id == str(sid)).delete()
        db.query(Student).filter(Student.school_id == str(sid)).delete()
        db.query(User).filter(User.school_id == sid).delete()
        db.delete(existing_school)
        db.commit()

    # School uses Uuid
    school = School(id=SCHOOL_UUID, name="Golden School", code="SCH_GOLD", is_active=True, subscription_tier=SubscriptionTier.PRO)
    db.add(school)

    # Student uses String
    student = db.query(Student).filter(Student.id == STUDENT_ID).first()
    if not student:
        student = Student(id=STUDENT_ID, first_name="Golden", last_name="Boy", roll_number="101", school_id=SCHOOL_ID, is_active=True, photo_url="http://img.com/student.jpg")
        db.add(student)

    # Parent (User) uses Uuid
    parent = db.query(User).filter(User.id == PARENT_UUID).first()
    if not parent:
        parent = User(id=PARENT_UUID, email="parent@golden.com", hashed_password="pw", first_name="Golden", last_name="Parent", role=Roles.PARENT, school_id=SCHOOL_UUID, photo_url="http://img.com/parent.jpg")
        db.add(parent)

    link = db.query(ParentStudentLink).filter_by(student_id=STUDENT_ID, parent_id=PARENT_ID).first()
    if not link:
        link = ParentStudentLink(student_id=STUDENT_ID, parent_id=PARENT_ID, school_id=SCHOOL_ID, is_authorized_pickup=True)
        db.add(link)

    # Clear payments
    db.query(Payment).filter(Payment.school_id == SCHOOL_ID).delete()

    db.commit()
    return

# Override Subscription
app.dependency_overrides[require_subscription_feature("pro_analytics")] = lambda: True
app.dependency_overrides[require_subscription_feature("QR_GATE")] = lambda: True

def test_maroon_trigger(setup_golden_data, db):
    # Mock Security Guard (User uses Uuid)
    guard_uuid = uuid.uuid4()
    app.dependency_overrides[get_current_user] = lambda: User(id=guard_uuid, role=Roles.SECURITY_GUARD, school_id=SCHOOL_UUID)

    # 1. Generate Token (As Parent)
    import jwt
    from attendance.gate_router import SECRET_KEY, ALGORITHM

    token_payload = {
        "sub": STUDENT_ID,
        "parent_id": PARENT_ID,
        "school_id": SCHOOL_ID,
        "jti": str(uuid.uuid4()),
        "type": "GATE_PASS",
        "exp": datetime.datetime.now(timezone.utc) + timedelta(minutes=5),
        "iat": datetime.datetime.now(timezone.utc)
    }
    token = jwt.encode(token_payload, SECRET_KEY, algorithm=ALGORITHM)

    # 2. Initial Scan (Should Succeed)
    res = client.post("/api/attendance/gate/scan", json={"token": token})
    print(f"Initial Scan: {res.status_code} {res.text}")
    assert res.status_code == 200
    assert res.json()["status"] == "SUCCESS"
    assert res.json()["parent_photo_url"] == "http://img.com/parent.jpg"

    # 3. Block Parent (As Admin)
    # Switch to Admin
    admin_uuid = uuid.uuid4()
    app.dependency_overrides[get_current_user] = lambda: User(id=admin_uuid, role=Roles.SCHOOL_ADMIN, school_id=SCHOOL_UUID)

    block_res = client.post(f"/api/students/{STUDENT_ID}/security-blocks", json={
        "reason": "Custody Dispute - Court Order #12345",
        "parent_id": PARENT_ID
    })
    assert block_res.status_code == 200

    # 4. Scan Again (Should be BLOCKED)
    # Switch back to Guard
    app.dependency_overrides[get_current_user] = lambda: User(id=guard_uuid, role=Roles.SECURITY_GUARD, school_id=SCHOOL_UUID)

    res_blocked = client.post("/api/attendance/gate/scan", json={"token": token})
    print(f"Blocked Scan: {res_blocked.status_code} {res_blocked.text}")
    assert res_blocked.status_code == 403
    assert "BLOCKED" in res_blocked.json()["detail"]

def test_velocity_precision(setup_golden_data, db):
    # Setup payments
    today = datetime.datetime.now(timezone.utc).date()
    # 12:01 AM Today
    dt_today = datetime.datetime.combine(today, datetime.time(0, 1)).replace(tzinfo=timezone.utc)
    # 11:59 PM Yesterday
    dt_yesterday = datetime.datetime.combine(today - timedelta(days=1), datetime.time(23, 59)).replace(tzinfo=timezone.utc)

    # Create Payments directly in DB (Payment uses String school_id)
    p1 = Payment(id=str(uuid.uuid4()), school_id=SCHOOL_ID, amount=100.0, status="SUCCEEDED", created_at=dt_today, gateway="OFFICE_CASH", currency="USD")
    p2 = Payment(id=str(uuid.uuid4()), school_id=SCHOOL_ID, amount=200.0, status="SUCCEEDED", created_at=dt_yesterday, gateway="OFFICE_CASH", currency="USD")
    db.add_all([p1, p2])
    db.commit()

    # Query Velocity
    # Mock Principal
    principal_uuid = uuid.uuid4()
    app.dependency_overrides[get_current_user] = lambda: User(id=principal_uuid, role=Roles.PRINCIPAL, school_id=SCHOOL_UUID)

    res = client.get("/api/analytics/finance/velocity")
    assert res.status_code == 200
    data = res.json()

    print(data)

    # Verify
    assert data["today"]["metrics"]["total"] == 100.0
    assert data["yesterday"]["metrics"]["total"] == 200.0

def test_justification_length(setup_golden_data, db):
    # Mock Admin
    admin_uuid = uuid.uuid4()
    app.dependency_overrides[get_current_user] = lambda: User(id=admin_uuid, role=Roles.SCHOOL_ADMIN, school_id=SCHOOL_UUID)

    # Attempt short reason
    res = client.post(f"/api/students/{STUDENT_ID}/security-blocks", json={
        "reason": "Short",
        "parent_id": PARENT_ID
    })

    assert res.status_code == 422
