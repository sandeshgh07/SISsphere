from main import app
from fastapi.testclient import TestClient
from auth.jwt import create_access_token
from schools.models import User, School
from database import SessionLocal
import uuid

def test_student_search():
    client = TestClient(app)
    db = SessionLocal()
    
    # 1. Get Principal
    principal = db.query(User).filter(User.role == 'principal').first()
    if not principal:
        print("No principal found")
        return

    # 2. Get Access Token
    token = create_access_token(data={"sub": principal.email, "token_version": 1})
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Call endpoint
    res = client.get("/api/students", headers=headers)
    print(f"Status: {res.status_code}")
    if res.status_code == 200:
        data = res.json()
        print(f"Found {len(data)} students")
        if len(data) > 0:
            print("First student:", data[0])
    else:
        print("Error:", res.text)
        
    db.close()

if __name__ == "__main__":
    test_student_search()
