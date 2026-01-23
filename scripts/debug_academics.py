import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from main import app
import academics.router
print(f"DEBUG: academics.router file: {academics.router.__file__}")
from auth.jwt import create_access_token
from schools.models import User
from database import SessionLocal
import uuid

# Create Test Client
client = TestClient(app)

def test_grades():
    db = SessionLocal()
    try:
        # Login as Principal
        principal = db.query(User).filter(User.role == "principal").first()
        if not principal:
            print("❌ No principal found")
            return

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

        # 1. CREATE Grade
        print("\nTesting POST /api/academics/grades")
        grade_payload = {
            "name": f"Test Grade {uuid.uuid4().hex[:4]}",
            "sequence": 99
        }
        response = client.post("/api/academics/grades", json=grade_payload, headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Grade Created")
            grade_id = response.json().get("id")
        else:
            print(f"❌ Failed: {response.text}")
            return

        # 2. GET Structure
        print("\nTesting GET /api/academics/structure")
        response = client.get("/api/academics/structure", headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Structure Retrieved")
        else:
            print(f"❌ Failed: {response.text}")

        # 3. CREATE Section
        print("\nTesting POST /api/academics/sections")
        sec_payload = {"name": f"Test Sec {uuid.uuid4().hex[:4]}"}
        response = client.post("/api/academics/sections", json=sec_payload, headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Section Created")
        else:
            print(f"❌ Failed: {response.text}")

    except Exception as e:
        print(f"❌ Exception: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_grades()
