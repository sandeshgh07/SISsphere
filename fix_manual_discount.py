
from sqlalchemy.orm import Session
from database import SessionLocal
from schools import models as school_models
from academics import models as acad_models
from students import models as stu_models
from finance import models as fin_models
import sys

def fix_rule():
    db = SessionLocal()
    try:
        # 1. Fix Master Rule
        master_rule = db.query(fin_models.DiscountRule).filter(
            fin_models.DiscountRule.title.ilike("manual 10%"),
            fin_models.DiscountRule.student_id == None
        ).first()
        
        if master_rule:
            print(f"Found Master Rule: {master_rule.title} (ID: {master_rule.id})")
            print(f"  Old ApplyTo: {master_rule.apply_to_fee_templates}")
            master_rule.apply_to_fee_templates = fin_models.DiscountApplyTo.ALL_TEMPLATES
            master_rule.fee_template_ids = None # Clear specific list
            print(f"  New ApplyTo: {master_rule.apply_to_fee_templates}")
        else:
            print("Master 'manual 10%' rule not found.")

        # 2. Fix 'Applied' Rules
        applied_rules = db.query(fin_models.DiscountRule).filter(
            fin_models.DiscountRule.title.ilike("%manual 10% (Applied)%")
        ).all()
        
        print(f"Found {len(applied_rules)} applied rules.")
        for rule in applied_rules:
             rule.apply_to_fee_templates = fin_models.DiscountApplyTo.ALL_TEMPLATES
             rule.fee_template_ids = None
             print(f"  Fixed rule for student {rule.student_id}")

        db.commit()
        print("Commited changes.")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_rule()
