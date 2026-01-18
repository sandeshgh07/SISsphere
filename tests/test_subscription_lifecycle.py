import sys
import os
import unittest
from datetime import datetime, timedelta, timezone

# Add the project root to the python path
sys.path.append(os.getcwd())

from database import SessionLocal
import schools.models as school_models
from schools.constants import SubscriptionTier
from auth.dependencies import get_current_active_user
from fastapi import HTTPException
from admin.router import toggle_school_active, start_free_trial, extend_subscription, ExtendSubscriptionRequest

class TestSubscriptionLifecycle(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        # Ensure we have the demo school setup
        self.school = self.db.query(school_models.School).filter(school_models.School.name == "Nepsis International Academy").first()
        if not self.school:
            print("⚠️ Demo school not found. Running seed...")
            import scripts.seed_demo_data
            scripts.seed_demo_data.init_db()
            scripts.seed_demo_data.create_demo_data()
            self.school = self.db.query(school_models.School).filter(school_models.School.name == "Nepsis International Academy").first()

        self.user = self.db.query(school_models.User).filter(school_models.User.email == "principal@nepsis.com").first()

        # Reset state
        self.school.is_active = True
        self.school.subscription_expiry = datetime.now(timezone.utc) + timedelta(days=365)
        self.school.subscription_tier = SubscriptionTier.PRO
        self.db.commit()
        self.db.refresh(self.school)
        self.db.refresh(self.user)

    def tearDown(self):
        self.db.close()

    def test_healthy_subscription(self):
        """User should be able to access if active and valid expiry"""
        try:
            get_current_active_user(self.user)
            print("✅ Healthy subscription check passed")
        except HTTPException as e:
            self.fail(f"Healthy subscription failed: {e.detail}")

    def test_expired_subscription_access_denied(self):
        """User should be blocked if expiry passed grace period"""
        # Set expiry to 10 days ago (past 3 day grace)
        self.school.subscription_expiry = datetime.now(timezone.utc) - timedelta(days=10)
        self.db.commit()
        self.db.refresh(self.school)
        self.db.refresh(self.user) # Ensure relationship reloads

        print(f"🕒 Expiry set to: {self.school.subscription_expiry}")

        with self.assertRaises(HTTPException) as cm:
            get_current_active_user(self.user)

        self.assertEqual(cm.exception.status_code, 403)
        self.assertIn("Account Suspended", cm.exception.detail)
        print("✅ Expired subscription correctly blocked")

    def test_grace_period_access_allowed(self):
        """User should be allowed if within 3 day grace period"""
        # Set expiry to 1 day ago (within 3 days)
        self.school.subscription_expiry = datetime.now(timezone.utc) - timedelta(days=1)
        self.db.commit()
        self.db.refresh(self.school)
        self.db.refresh(self.user)

        try:
            get_current_active_user(self.user)
            print("✅ Grace period check passed")
        except HTTPException as e:
            self.fail(f"Grace period blocked incorrectly: {e.detail}")

    def test_frozen_school_access_denied(self):
        """User should be blocked if school is frozen (is_active=False)"""
        self.school.is_active = False
        self.db.commit()
        self.db.refresh(self.school)
        self.db.refresh(self.user)

        with self.assertRaises(HTTPException) as cm:
            get_current_active_user(self.user)

        self.assertEqual(cm.exception.status_code, 403)
        self.assertIn("Account Suspended", cm.exception.detail)
        print("✅ Frozen school correctly blocked")

    def test_admin_api_lifecycle(self):
        """Test the Admin API endpoints functionality"""
        school_id = str(self.school.id)

        # 1. Start Free Trial
        # Reset to Basic
        self.school.subscription_tier = SubscriptionTier.BASIC
        self.school.subscription_expiry = None
        self.db.commit()

        # Call API function directly (mocking dependency is harder, but function is pure enough if db provided)
        # We need to mock user dependency for admin router call if we were using FastAPi TestClient
        # But here we import the function.

        start_free_trial(school_id, self.db)

        self.db.refresh(self.school)
        self.assertEqual(self.school.subscription_tier, SubscriptionTier.PRO)
        # Handle naive/aware mismatch
        expiry = self.school.subscription_expiry
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)

        self.assertTrue(expiry > datetime.now(timezone.utc) + timedelta(days=13))
        print("✅ API: Start Free Trial works")

        # 2. Toggle Active (Freeze)
        # It is active now.
        toggle_school_active(school_id, self.db)
        self.db.refresh(self.school)
        self.assertFalse(self.school.is_active)
        print("✅ API: Toggle Freeze works")

        # 3. Toggle Active (Unfreeze)
        toggle_school_active(school_id, self.db)
        self.db.refresh(self.school)
        self.assertTrue(self.school.is_active)
        print("✅ API: Toggle Unfreeze works")

        # 4. Extend Subscription
        current_expiry = self.school.subscription_expiry
        req = ExtendSubscriptionRequest(days=30)
        extend_subscription(school_id, req, self.db)

        self.db.refresh(self.school)
        expected_expiry = current_expiry + timedelta(days=30)
        # Allow small delta
        delta = abs((self.school.subscription_expiry - expected_expiry).total_seconds())
        self.assertLess(delta, 5)
        print("✅ API: Extend Subscription works")


if __name__ == '__main__':
    unittest.main()
