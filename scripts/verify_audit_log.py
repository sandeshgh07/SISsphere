import sys
import os
import uuid
import json

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, register_listeners
from communication.models import Notice, Complaint, NoticePriority
from audit.models import AuditLog
from audit.listeners import set_actor_id
from datetime import datetime

# Initialize
register_listeners()
db = SessionLocal()

def verify_audit():
    print("--- Verifying Audit Log Coverage ---")
    
    # Simulate Actor (Admin)
    actor_id = str(uuid.uuid4())
    school_id = str(uuid.uuid4())
    set_actor_id(actor_id)
    print(f"Set Actor ID: {actor_id}")

    # 1. Test Notice Creation
    print("\n1. Testing Notice Creation...")
    notice_id = str(uuid.uuid4())
    notice = Notice(
        id=notice_id,
        school_id=school_id,
        title="Audit Test Notice",
        content="Testing audit logs",
        priority=NoticePriority.NORMAL,
        author_id=actor_id
    )
    db.add(notice)
    db.commit()

    # Check Audit Log for Notice
    log = db.query(AuditLog).filter(
        AuditLog.table_name == "notices",
        AuditLog.record_id == notice_id,
        AuditLog.action_type == "INSERT"
    ).first()

    if log:
        print("✅ Notice Audit Log Found!")
        print(f"   Log ID: {log.id}")
        print(f"   After State: {log.after_state}")
    else:
        print("❌ Notice Audit Log NOT Found!")

    # 2. Test Complaint Creation
    print("\n2. Testing Complaint Creation...")
    # Need to check Complaint model structure briefly or try generic
    # Based on previous view, Complaint is generic
    try:
        complaint_id = str(uuid.uuid4())
        # Complaint model not fully visible in previous turn, assuming schema
        # Re-importing to be safe
        from communication.models import Complaint
        
        complaint = Complaint(
             id=complaint_id,
             school_id=school_id,
             title="Audit Test Complaint",
             description="Testing audit logs for complaints", # Fixed field name
             created_by_id=actor_id,
             student_id=str(uuid.uuid4()) # Dummy student
        )
        db.add(complaint)
        db.commit()

        # Check Audit Log for Complaint
        log = db.query(AuditLog).filter(
            AuditLog.table_name == "complaints", 
            AuditLog.record_id == complaint_id,
            AuditLog.action_type == "INSERT"
        ).first()

        if log:
            print("✅ Complaint Audit Log Found!")
            print(f"   Log ID: {log.id}")
        else:
            print("❌ Complaint Audit Log NOT Found!")
            
    except Exception as e:
        print(f"⚠️ Error testing complaint: {e}")
        import traceback
        traceback.print_exc()

    # Clean up (Optional, but good for test hygiene)
    # db.query(Notice).filter(Notice.id == notice_id).delete()
    # db.commit()

if __name__ == "__main__":
    verify_audit()
