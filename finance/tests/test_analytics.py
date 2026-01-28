import unittest
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from schools import models as school_models
from students import models as student_models
from academics import models as academic_models
from communication import models as communication_models
from finance import models as finance_models
from finance.analytics_service import FinanceAnalyticsService
from database import Base

class TestFinanceAnalytics(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        Session = sessionmaker(bind=self.engine)
        self.db = Session()
        self.school_id = "school_123"
        self.service = FinanceAnalyticsService(self.db, self.school_id)
        
        # Seed Data
        self.seed_data()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def seed_data(self):
        # Create Invoices
        # 1. Issued 5 days ago, 1000 amount, not paid
        inv1 = finance_models.StudentInvoice(
            id="inv1", school_id=self.school_id, student_id="s1",
            total_due=1000.0, balance=1000.0, status=finance_models.StudentInvoiceStatus.ISSUED,
            issued_at=datetime.now(timezone.utc) - timedelta(days=5),
            due_date=datetime.now(timezone.utc) + timedelta(days=25),
            period="2025-01"
        )
        
        # 2. Issued 35 days ago (Overdue), 2000 amount, Paid 500
        inv2 = finance_models.StudentInvoice(
            id="inv2", school_id=self.school_id, student_id="s2",
            total_due=2000.0, paid_total=500.0, balance=1500.0, status=finance_models.StudentInvoiceStatus.PARTIAL,
            issued_at=datetime.now(timezone.utc) - timedelta(days=35),
            due_date=datetime.now(timezone.utc) - timedelta(days=5), # Overdue
            period="2024-12"
        )
        
        self.db.add_all([inv1, inv2])
        
        # Create Payments
        # 1. Paid today, 500 for inv2
        pmt1 = finance_models.Payment(
            id="p1", school_id=self.school_id, student_invoice_id="inv2",
            amount=500.0, status=finance_models.PaymentStatus.SUCCEEDED,
            paid_at=datetime.now(timezone.utc),
            currency="NPR"
        )
        
        # 2. Paid last month (for reference, but verify filtering)
        pmt2 = finance_models.Payment(
            id="p2", school_id=self.school_id, student_invoice_id="invX", # irrelevant
            amount=300.0, status=finance_models.PaymentStatus.SUCCEEDED,
            paid_at=datetime.now(timezone.utc) - timedelta(days=40),
            currency="NPR"
        )
        
        self.db.add_all([pmt1, pmt2])
        self.db.commit()

    def test_get_finance_summary(self):
        start = datetime.now(timezone.utc) - timedelta(days=30)
        end = datetime.now(timezone.utc)
        
        summary = self.service.get_finance_summary(start, end)
        
        # Billed: inv1 (1000) is within last 30 days. inv2 (2000) is 35 days ago (outside range)
        # Wait, inv2 issued_at is 35 days ago. so not in billed_total for this range.
        self.assertEqual(summary["billed_total"], 1000.0)
        
        # Collected: pmt1 (500) is today. pmt2 (300) is 40 days ago.
        self.assertEqual(summary["collected_total"], 500.0)
        
        # Outstanding: Total balance of all ISSUED/PARTIAL invoices. 1000 (inv1) + 1500 (inv2) = 2500.
        self.assertEqual(summary["outstanding_total"], 2500.0)
        
        # Overdue: inv2 is overdue (due 5 days ago).
        self.assertEqual(summary["overdue_count"], 1)
        
        # Students with dues: s1 and s2 both have balance > 0.
        self.assertEqual(summary["students_with_dues_count"], 2)
        
    def test_aging_report(self):
        aging = self.service.get_aging_report()
        # inv1: due in +25 days. Delta = today - due. -25 days.
        # Logic in service: delta = (today - due_at).days.
        # If due in future, delta is negative.
        # My logic for bucket:
        # if delta <= 30: 0-30 bucket.
        # Negative delta is <= 30. So inv1 is in 0-30.
        
        # inv2: due 5 days ago. Delta = 5.
        # 5 <= 30. So inv2 also in 0-30.
        
        # Let's verify buckets logic in service. 
        # Ideally "Not Due" should be separate or in "Current" (0-30).
        # Standard aging report is "Days Past Due".
        # If not past due, delta is negative. 
        # My simple logic put everything <= 30 in 0-30.
        
        bucket_0_30 = next(x for x in aging if x["bucket"] == "0-30")
        self.assertEqual(bucket_0_30["amount"], 2500.0)

if __name__ == '__main__':
    unittest.main()
