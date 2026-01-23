"""
Fix script to normalize UUID formats in notices/complaints to match user.school_id format.
The User model uses UUID type which is stored/returned with dashes.
The Notice/Complaint models use String type - we need to ensure they have dashes too.
"""
import sys
import os
import re
sys.path.append(os.getcwd())

from sqlalchemy.orm import Session
from database import SessionLocal
import communication.models as comm_models
import schools.models as school_models

def format_uuid_with_dashes(uuid_str):
    """Convert a UUID string to standard format with dashes."""
    # Remove any existing dashes
    clean = uuid_str.replace('-', '')
    # Add dashes back in correct positions
    if len(clean) == 32:
        return f"{clean[:8]}-{clean[8:12]}-{clean[12:16]}-{clean[16:20]}-{clean[20:]}"
    return uuid_str

def fix_data():
    db = SessionLocal()
    
    try:
        print("📋 Fixing UUID format to match User.school_id (with dashes)...")
        
        # Get principal user
        principal = db.query(school_models.User).filter(
            school_models.User.role == "principal"
        ).first()
        
        if not principal:
            print("❌ No principal found!")
            return
        
        # Get the correct school_id format from user (with dashes)
        correct_school_id = str(principal.school_id)  # This has dashes
        print(f"   Principal: {principal.email}")
        print(f"   Correct School ID format: {correct_school_id}")
        
        # Fix notices - add dashes to school_id
        notices = db.query(comm_models.Notice).all()
        notices_fixed = 0
        for notice in notices:
            old_id = str(notice.school_id)
            new_id = format_uuid_with_dashes(old_id)
            if old_id != new_id:
                notice.school_id = new_id
                notices_fixed += 1
                print(f"      Notice: {old_id} -> {new_id}")
        
        print(f"   ✓ Fixed {notices_fixed} notices with UUID format")
        
        # Fix complaints - add dashes to school_id
        complaints = db.query(comm_models.Complaint).all()
        complaints_fixed = 0
        for complaint in complaints:
            old_id = str(complaint.school_id)
            new_id = format_uuid_with_dashes(old_id)
            if old_id != new_id:
                complaint.school_id = new_id
                complaints_fixed += 1
        
        print(f"   ✓ Fixed {complaints_fixed} complaints with UUID format")
        
        # Ensure principal is participant in all complaints
        participants_added = 0
        for complaint in complaints:
            existing = db.query(comm_models.ComplaintParticipant).filter(
                comm_models.ComplaintParticipant.complaint_id == complaint.id,
                comm_models.ComplaintParticipant.user_id == str(principal.id)
            ).first()
            
            if not existing:
                participant = comm_models.ComplaintParticipant(
                    complaint_id=complaint.id,
                    user_id=str(principal.id)
                )
                db.add(participant)
                participants_added += 1
        
        print(f"   ✓ Added {participants_added} complaint participants for principal")
        
        db.commit()
        
        # Verify counts
        notices_count = db.query(comm_models.Notice).filter(
            comm_models.Notice.school_id == correct_school_id
        ).count()
        
        complaints_count = db.query(comm_models.Complaint).join(
            comm_models.ComplaintParticipant
        ).filter(
            comm_models.ComplaintParticipant.user_id == str(principal.id),
            comm_models.Complaint.school_id == correct_school_id
        ).count()
        
        print(f"\n✅ Data fixed successfully!")
        print(f"   Notices visible to principal: {notices_count}")
        print(f"   Complaints visible to principal: {complaints_count}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    fix_data()
