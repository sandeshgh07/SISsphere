import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from main import app
from finance import models as fin_models
from students import models as stu_models
from schools import models as school_models
from academics import models as acad_models
import uuid
from datetime import datetime

# Setup Test DB
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_finance_flow.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def setup_data(db):
    # Create School
    school_id = str(uuid.uuid4())
    school = school_models.School(id=uuid.UUID(school_id), name="Test School", code="TEST", country="Nepal")
    db.add(school)
    
    # Create User (Admin)
    user_id = str(uuid.uuid4())
    user = school_models.User(
        id=uuid.UUID(user_id), 
        email="admin@test.com", 
        first_name="Admin",
        last_name="User",
        hashed_password="hash", 
        school_id=uuid.UUID(school_id),
        role="principal",
        is_active=True
    )
    db.add(user)
    
    # Create Grade
    grade_id = str(uuid.uuid4())
    grade = acad_models.Grade(id=grade_id, school_id=school_id, name="Grade 10")
    db.add(grade)
    
    # Create Student
    student_id = str(uuid.uuid4())
    student = stu_models.Student(
        id=student_id, 
        school_id=school_id, 
        first_name="John", 
        last_name="Doe", 
        roll_number="101",
        grade_id=grade_id,
        is_active=True
    )
    db.add(student)
    
    # Create Fee Template
    template_id = str(uuid.uuid4())
    template = fin_models.FeeItemTemplate(
        id=template_id,
        school_id=school_id,
        title="Monthly Tuition",
        amount=1000.0,
        grade_id=grade_id,
        billing_type="RECURRING",
        recurrence="MONTHLY",
        is_active="true"
    )
    db.add(template)
    
    # Create Discount Rule
    discount_id = str(uuid.uuid4())
    discount = fin_models.DiscountRule(
        id=discount_id,
        school_id=school_id,
        title="Merit Scholarship",
        discount_type="PERCENT",
        value=10.0, # 10%
        scope_type="ALL_STUDENTS",
        is_active="true",
        eligibility_type="MANUAL_APPROVAL"
    )
    db.add(discount)
    
    db.commit()
    return school_id, user, student_id, template_id, discount_id

def test_finance_flow():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    school_id, user_orm, student_id, template_id, discount_id = setup_data(db)
    # Convert ORM user to Mock Object to avoid DetachedInstanceError
    class MockUser:
        def __init__(self, u):
            self.id = str(u.id) # Should be string or UUID? TenantAccess expects str(user.school_id). 
            # PaymentRouter expects user.id as well.
            # User model id is UUID.
            self.id = u.id # Keep as UUID
            self.email = u.email
            self.role = u.role
            self.school_id = u.school_id # UUID
            self.is_active = u.is_active
            self.roles = [] # No extra roles
            # For TenantAccess
            # user.role is checked.
            # user.school_id is checked.
    
    mock_user = MockUser(user_orm)
    db.close() # Now safe to close
    
    # Mock Auth
    from auth.dependencies import get_current_active_user
    app.dependency_overrides[get_current_active_user] = lambda: mock_user
    
    # 1. Check Ledger (Preview)
    
    res = client.get(f"/api/fees/ledger?student_id={student_id}&period=2024-01")
    assert res.status_code == 200
    data = res.json()
    
    print("Ledger Preview:", data)
    assert data['totals']['base_total'] == 1000.0
    assert data['totals']['discount_total'] == 100.0 # 10% of 1000
    assert data['totals']['net_total'] == 900.0
    assert len(data['breakdown_lines']) == 1
    assert data['invoice_id'] is None
    
    # 2. Generate Invoice
    # POST /api/fees/invoices/generator/run
    gen_req = {
        "period": "2024-01",
        "conflict_rule": "SKIP"
    }
    res = client.post("/api/fees/invoices/generator/run", json=gen_req)
    assert res.status_code == 200
    print("Generation Result:", res.json())
    
    # 3. Check Ledger Again (Should have invoice_id)
    res = client.get(f"/api/fees/ledger?student_id={student_id}&period=2024-01")
    data = res.json()
    assert data['invoice_id'] is not None
    invoice_id = data['invoice_id']
    assert data['totals']['net_total'] == 900.0
    
    # 4. Record Payment (Cash)
    # POST /api/payments/record
    # Form data
    pay_data = {
        "invoice_id": invoice_id,
        "amount": 500.0,
        "entry_source": "OFFICE_CASH",
        "notes": "Partial Payment"
    }
    res = client.post("/api/payments/record", data=pay_data) # Form data
    if res.status_code != 200:
        print("Record Payment FAILED:", res.text)
    assert res.status_code == 200
    pay_res = res.json()
    assert pay_res['status'] == "success"
    assert pay_res['payment_status'] == "CONFIRMED" # Was SUCCEEDED
    
    # 5. Check Ledger Balance
    res = client.get(f"/api/fees/ledger?student_id={student_id}&period=2024-01")
    data = res.json()
    assert data['totals']['paid_total'] == 500.0
    assert data['totals']['balance'] == 400.0
    
    # 6. Record Payment (Remote/Verify)
    # Needs file
    files = {'file': ('receipt.txt', b'receipt content', 'text/plain')}
    pay_data_remote = {
        "invoice_id": invoice_id,
        "amount": 400.0,
        "entry_source": "REMOTE", # REMOTE
        "notes": "Balance Payment"
    }
    res = client.post("/api/payments/record", data=pay_data_remote, files=files)
    assert res.status_code == 200
    remote_res = res.json()
    assert remote_res['payment_status'] == "PENDING_VERIFICATION"
    payment_id = remote_res['payment_id']
    
    # 7. Check Ledger (Balance should NOT decrease yet?)
    # Ledger paid_total usually counts only successful payments.
    res = client.get(f"/api/fees/ledger?student_id={student_id}&period=2024-01")
    data = res.json()
    assert data['totals']['paid_total'] == 500.0 # Unchanged
    
    # 8. Verify Payment
    # POST /api/payments/{id}/verify
    res = client.post(f"/api/payments/{payment_id}/verify", json={"status": "verified", "notes": "LGTM"})
    assert res.status_code == 200
    assert res.json()['payment_status'] == "CONFIRMED"
    
    # 9. Check Ledger (Balance should be 0 now)
    res = client.get(f"/api/fees/ledger?student_id={student_id}&period=2024-01")
    data = res.json()
    assert data['totals']['paid_total'] == 900.0
    assert data['totals']['balance'] == 0.0
    
    print("E2E Test Passed!")

if __name__ == "__main__":
    test_finance_flow()
