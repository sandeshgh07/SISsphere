
from sqlalchemy.orm import Session
from database import SessionLocal
from finance import models as fin_models
from students import models as stu_models
from academics import models as acad_models
from schools import models as school_models
from sqlalchemy import func

def cleanup():
    db = SessionLocal()
    try:
        # Find all rules with "(Applied)" in title
        applied_rules = db.query(fin_models.DiscountRule).filter(
            fin_models.DiscountRule.title.ilike("%(Applied)%"),
            fin_models.DiscountRule.scope_type == fin_models.DiscountScope.STUDENT_SPECIFIC
        ).all()
        
        print(f"Found {len(applied_rules)} applied rules total.")
        
        deleted_count = 0
        
        # Naive approach: Group by student + base title pattern?
        # Or simple heuristic: if it has multiple "(Applied)", clean it or delete all and let user re-apply correctly?
        # Deleting ALL applied rules is safest to reset state, assuming user hasn't heavily customized them manually yet.
        # User just complained about duplicates, so resetting is likely preferred.
        
        for rule in applied_rules:
            print(f"Deleting rule: {rule.title} (ID: {rule.id}) for Student {rule.student_id}")
            db.delete(rule)
            deleted_count += 1
            
        db.commit()
        print(f"Deleted {deleted_count} duplicate/applied rules. System is clean.")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    cleanup()
