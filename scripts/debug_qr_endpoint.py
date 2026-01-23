import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from main import app
from auth.jwt import create_access_token
from schools.models import User, School
from database import SessionLocal
from auth.dependencies import Roles

# Create Test Client
client = TestClient(app)

def test_qr_generation():
    db = SessionLocal()
    try:
        # 1. Find a real student in Student table
        from students.models import Student
        real_student = db.query(Student).first()
        if not real_student:
             print("❌ No student record found in DB")
             return
        
        print(f"Testing with Real Student ID: {real_student.id}")

        # 2. Login as Principal of the SAME SCHOOL
        import uuid
        principal = db.query(User).filter(
            User.role == "principal",
            User.school_id == uuid.UUID(str(real_student.school_id))
        ).first()
        
        if not principal:
             # Fallback: Create mock principal token for that school
             print(f"⚠️ No principal found for school {real_student.school_id}, using mock token")
             token_data = {
                 "sub": "mock-principal@test.com",
                 "role": "principal",
                 "school_id": str(real_student.school_id),
                 "id": "mock-id-123", # Random ID
                 "token_version": 1
             }
        else:
             print(f"Authenticating as Principal: {principal.email}")
             token_data = {
                 "sub": principal.email,
                 "role": "principal",
                 "school_id": str(principal.school_id),
                 "id": str(principal.id),
                 "token_version": principal.token_version
             }
        
        token = create_access_token(token_data)
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # 3. Request QR Token
        url = f"/api/students/{real_student.id}/qr-token"
        print(f"Requesting: {url}")
        response = client.get(url, headers=headers)
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ QR Token Generated Successfully")
        else:
            print("❌ Failed")

    except Exception as e:
        print(f"❌ Exception: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_qr_generation()
