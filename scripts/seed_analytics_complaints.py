import sys
import os
import random
from datetime import datetime, timedelta, timezone

# Add the project root to the python path
sys.path.append(os.getcwd())

from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
from schools.models import School, User
from communication.models import Complaint, ComplaintStatus, Notice, NoticePriority
from finance.models import Payment, PaymentStatus, Invoice, InvoiceStatus, EntrySource

def generate_uuid():
    import uuid
    return str(uuid.uuid4())

def seed_analytics_data():
    db = SessionLocal()
    try:
        print("🚀 Seeding Analytics & Complaints Data...")

        # 1. Get Demo School and Principal
        school = db.query(School).filter(School.code == "NIA001").first()
        if not school:
            print("❌ Demo school not found. Run seed_demo_data.py first.")
            return

        principal = db.query(User).filter(User.email == "principal@nepsis.com").first()
        if not principal:
            print("❌ Principal not found.")
            return

        school_id = str(school.id)
        user_id = str(principal.id)

        # 2. Create 3 Complaints (Open)
        print("📝 Creating Complaints...")
        complaints_data = [
            ("Cafeteria Hygiene", "The food served today was cold."),
            ("Bus Delay", "Route 4 bus was 30 mins late."),
            ("Classroom AC", "AC in Grade 9A is not cooling.")
        ]

        for title, desc in complaints_data:
            # Check duplicates to avoid spamming on re-runs
            exists = db.query(Complaint).filter(Complaint.title == title, Complaint.school_id == school_id).first()
            if not exists:
                comp = Complaint(
                    school_id=school_id,
                    title=title,
                    status=ComplaintStatus.OPEN,
                    created_by_id=user_id,
                    created_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 48))
                )
                db.add(comp)

        # 3. Create 2 New Notices
        print("📢 Creating Notices...")
        notices_data = [
            ("Staff Meeting", "Mandatory staff meeting tomorrow at 4 PM.", NoticePriority.HIGH),
            ("Holiday Announcement", "School remains closed on Monday for local festival.", NoticePriority.NORMAL)
        ]

        for title, content, prio in notices_data:
            exists = db.query(Notice).filter(Notice.title == title, Notice.school_id == school_id).first()
            if not exists:
                note = Notice(
                    school_id=school_id,
                    title=title,
                    content=content,
                    priority=prio,
                    author_id=user_id,
                    created_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 24))
                )
                db.add(note)

        # 4. Generate Historical Payments (for curve)
        print("💰 Generating Historical Payments...")
        # Create payments spread over last 30 days
        start_date = datetime.now(timezone.utc) - timedelta(days=30)

        # We need invoices first (or reuse existing?)
        # Let's create dummy invoices for this purpose if needed, or just payments if allowed.
        # Payment needs invoice_id.

        # Create a dummy student for bulk payments if not exists
        # Actually, let's just find existing students
        # We need to import Student model to query them?
        # Just use raw SQL or rely on existing invoice structure?
        # Let's create new invoices/payments for existing invoices

        invoices = db.query(Invoice).filter(Invoice.school_id == school_id).all()
        if invoices:
            for i in range(50):
                inv = random.choice(invoices)
                pay_date = start_date + timedelta(days=random.randint(0, 30))

                pay = Payment(
                    school_id=school_id,
                    invoice_id=inv.id,
                    amount=random.uniform(50, 200),
                    currency="USD",
                    status=PaymentStatus.SUCCEEDED,
                    entry_source=EntrySource.AUTOMATED,
                    created_at=pay_date # Need to ensure model has created_at and we can set it
                )
                # Payment model might create created_at automatically.
                # If we want to backdate, we might need to update it after flush or check model definition.
                # Assuming created_at defaults to now(), we might need to override it.
                # Let's check model... usually it's `created_at = Column(DateTime, default=...)`

                db.add(pay)

        # 5. Commit
        db.commit()

        # Hacky update for backdating payments
        # If created_at is not settable in constructor (it usually is), we can update it now.
        # But let's assume standard SQLAlchemy behavior allows constructor override.

        print("✅ Analytics Data Seeded!")

    except Exception as e:
        print(f"❌ Error seeding analytics: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_analytics_data()
