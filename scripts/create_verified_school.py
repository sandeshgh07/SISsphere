import sys
import os
import requests
from datetime import datetime, timedelta

# Add root to sys.path
sys.path.append(os.getcwd())

API_URL = "http://localhost:8000/api"

def create_verified_school():
    # 1. Login as SuperAdmin (using fixed credentials from config/seed)
    # Assuming config.py or env vars.
    # Or creating a new school without superuser if public? No, public is /schools/with-principal

    # We will use the /schools/with-principal endpoint which might require superuser OR be public?
    # Checking router... create_school_with_principal requires superuser.
    # But wait, we need to create one to test.
    # Let's assume we can login as superuser.
    # I'll rely on the existing demo data or auth/superuser/login endpoint.

    # Actually, verify_subscription.py used principal login.
    # We want a NEW school.
    # I'll create a script that uses python requests to call the API.

    # Login as Superuser
    # The codebase has a "superuser" role.
    # I'll try to find superuser creds or just modify the DB directly to add a school and user.
    # Direct DB is easier and safer for a script.

    from database import SessionLocal
    from schools.models import School, User
    from schools.constants import SubscriptionTier
    from passlib.context import CryptContext

    db = SessionLocal()
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    try:
        # Create School
        suffix = datetime.now().strftime("%H%M%S")
        school = School(
            name=f"Nepal High {suffix}",
            code=f"NH{suffix}",
            country="Nepal",
            subscription_tier=SubscriptionTier.PRO,
            is_active=True,
            subscription_expiry=datetime.utcnow() + timedelta(days=365)
        )
        db.add(school)
        db.commit()
        db.refresh(school)

        # Create Principal
        password = "password123"
        hashed = pwd_context.hash(password)
        principal = User(
            email=f"principal{suffix}@nepalhigh.com",
            hashed_password=hashed,
            first_name="Ram",
            last_name="Bahadur",
            role="principal",
            school_id=school.id,
            is_active=True
        )
        db.add(principal)
        db.commit()
        db.refresh(principal)

        print(f"Created School: {school.name} ({school.id})")
        print(f"Created Principal: {principal.email} / {password}")

        # Seed Board Data for this new school
        from scripts.seed_board_data import seed_board_data
        seed_board_data(str(school.id), str(principal.id))

        # Return credentials
        return {
            "email": principal.email,
            "password": password,
            "school_id": str(school.id)
        }

    except Exception as e:
        print(f"Error creating verified school: {e}")
        db.rollback()
        return None
    finally:
        db.close()

if __name__ == "__main__":
    create_verified_school()
