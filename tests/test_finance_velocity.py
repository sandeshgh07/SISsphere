from schools.models import User, School
from schools.constants import SubscriptionTier
from finance.models import Payment, Invoice, PaymentIntent, PaymentStatus
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
import datetime
from datetime import timezone, timedelta
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
SCHOOL_ID = str(uuid.uuid4())

@pytest.fixture
def db():
    db = SessionLocal()
    yield db
    db.close()

@pytest.fixture
def setup_data(db):
    # Create School
    try:
        school_uuid = uuid.UUID(SCHOOL_ID)
    except:
        school_uuid = SCHOOL_ID

    # Check by code first to avoid unique constraint error
    school = db.query(School).filter_by(code="SCH_FIN").first()
    if school:
        school_uuid = school.id
    else:
        school = School(id=str(school_uuid), name="School Finance", code="SCH_FIN", is_active=True, subscription_tier=SubscriptionTier.PRO)
        db.add(school)
        db.commit()

    # Clear Previous Data for this School (Cascade usually handles but manual here for safety)
    sid_str = str(school_uuid)
    db.query(Payment).filter(Payment.school_id == sid_str).delete()
    db.query(PaymentIntent).filter(PaymentIntent.school_id == sid_str).delete()
    db.query(Invoice).filter(Invoice.school_id == sid_str).delete()
    db.commit()

    # Create dummy invoice/intent for reference
    invoice_id = str(uuid.uuid4())
    intent_id = str(uuid.uuid4())

    # Cast UUID to string for finance models
    # sid_str defined above

    invoice = Invoice(id=invoice_id, school_id=sid_str, student_id="dummy", total_amount=10000, status="ISSUED")
    db.add(invoice)
    intent = PaymentIntent(id=intent_id, school_id=sid_str, invoice_id=invoice_id, amount=10000, currency="USD", idempotency_key=str(uuid.uuid4()))
    db.add(intent)
    db.commit()

    today = datetime.datetime.now(timezone.utc)
    yesterday = today - timedelta(days=1)
    day_before = today - timedelta(days=2)

    def create_payment(date_obj, amount, gateway):
        p = Payment(
            id=str(uuid.uuid4()),
            school_id=sid_str,
            invoice_id=invoice_id,
            payment_intent_id=intent_id,
            gateway=gateway,
            gateway_txn_id=str(uuid.uuid4()),
            amount=amount,
            currency="USD",
            status=PaymentStatus.SUCCEEDED,
            raw_event={},
            created_at=date_obj
        )
        db.add(p)

    # Today: 1000 Cash, 500 Remote
    create_payment(today, 1000.0, "OFFICE_CASH")
    create_payment(today, 500.0, "STRIPE")

    # Yesterday: 800 Cash, 400 Remote
    create_payment(yesterday, 800.0, "OFFICE_CASH")
    create_payment(yesterday, 400.0, "STRIPE")

    # Day Before: 600 Cash, 300 Remote
    create_payment(day_before, 600.0, "OFFICE_CASH")
    create_payment(day_before, 300.0, "STRIPE")

    db.commit()
    print(f"DEBUG: Setup created payments for school {sid_str}")
    return

# Override Subscription
app.dependency_overrides[require_subscription_feature("pro_analytics")] = lambda: True

def test_financial_velocity(setup_data, db):
    # Get actual school ID from DB in case it changed
    school = db.query(School).filter_by(code="SCH_FIN").first()
    school_id = str(school.id) # Ensure string

    # Mock Principal
    principal_id = uuid.uuid4()
    app.dependency_overrides[get_current_user] = lambda: User(id=str(principal_id), role=Roles.PRINCIPAL, school_id=school_id)

    response = client.get("/api/analytics/finance/velocity")
    assert response.status_code == 200
    data = response.json()

    print(data)

    # Verify Today (1500)
    assert data["today"]["metrics"]["total"] == 1500.0
    assert data["today"]["metrics"]["cash"] == 1000.0
    assert data["today"]["metrics"]["remote"] == 500.0

    # Verify Yesterday (1200)
    assert data["yesterday"]["metrics"]["total"] == 1200.0

    # Verify Day Before (900)
    assert data["day_before"]["metrics"]["total"] == 900.0

    # Verify Trends
    # Today vs Yesterday: (1500 - 1200) / 1200 = 0.25 -> 25.0%
    assert data["today"]["trend_vs_yesterday"] == 25.0

    # Yesterday vs Day Before: (1200 - 900) / 900 = 0.333 -> 33.3%
    assert data["yesterday"]["trend_vs_day_before"] == 33.3
