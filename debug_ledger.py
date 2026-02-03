
import sys
import os

# Add repo root to path
sys.path.append(os.getcwd())

from database import SessionLocal
from finance import ledger_router
from schools.models import User
from auth.dependencies import Roles
from unittest.mock import MagicMock

def test_ledger():
    db = SessionLocal()
    try:
        # Find a student
        from students.models import Student
        student = db.query(Student).first()
        if not student:
            print("No students found")
            return

        print(f"Testing for student: {student.id} ({student.first_name})")
        
        # Mock user
        user = MagicMock()
        user.school_id = student.school_id
        user.roles = []
        user.role = "principal"
        
        try:
            res = ledger_router.get_student_ledger(
                student_id=student.id,
                period="2026-02",
                db=db,
                current_user=user
            )
            print("Success!")
            print(res)
        except Exception as e:
            print(f"FAILED: {e}")
            import traceback
            traceback.print_exc()
            
    finally:
        db.close()

if __name__ == "__main__":
    test_ledger()
