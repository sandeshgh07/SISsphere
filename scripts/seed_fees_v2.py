
import sys
import os
from datetime import datetime, timezone

# Add project root to path
sys.path.append(os.getcwd())

from sqlalchemy.orm import Session
from database import SessionLocal, register_listeners
import finance.models as finance_models
import schools.models
import students.models
import academics.models
import audit.models

def seed_mandatory_fees():
    db = SessionLocal()
    try:
        school_id = "1aa34625-ae99-4427-ad7f-5d365fd0a1b0" # St. Mary's
        
        # Check if already exists
        exists = db.query(finance_models.FeeItemTemplate).filter(
            finance_models.FeeItemTemplate.school_id == school_id,
            finance_models.FeeItemTemplate.title == "Monthly Tuition Fee"
        ).first()
        
        if not exists:
            fee = finance_models.FeeItemTemplate(
                school_id=school_id,
                title="Monthly Tuition Fee",
                amount=5500.0,
                currency="NPR",
                billing_type=finance_models.BillingType.RECURRING,
                recurrence=finance_models.RecurrenceType.MONTHLY,
                is_optional_addon="false", # MANDATORY
                is_active="true"
            )
            db.add(fee)
            db.commit()
            print("✅ Created Monthly Tuition Fee (Mandatory)")
        else:
            # Update to mandatory if it was optional
            exists.is_optional_addon = "false"
            db.commit()
            print("✅ Updated existing fee to Mandatory")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_mandatory_fees()
