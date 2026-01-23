import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import SessionLocal
from academics.models import Grade
import uuid

def test_insert():
    db = SessionLocal()
    try:
        # Create a grade with string school_id
        sid = str(uuid.uuid4())
        print(f"School ID String: {sid}, Type: {type(sid)}")
        
        g = Grade(name="Test Model Grade", sequence=1, school_id=sid)
        print(f"Grade Object created. school_id type: {type(g.school_id)}")
        
        db.add(g)
        db.commit()
        print("✅ Inserted successfully")
    except Exception as e:
        print(f"❌ Failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_insert()
