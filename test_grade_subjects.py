
import sys
import os
import random
import string
import uuid
from datetime import date, timedelta

# Fix path to include root
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
import academics.models as academic_models
from academics.models import GradeSubject

client = TestClient(app)

def run_test():
    print("=== STARTING PHASE 2 BACKEND TEST ===")
    
    # 1. Setup: Admin Login & School
    admin_email = f"admin_{uuid.uuid4()}@test.com"
    # We cheat and use a known admin or create one? 
    # Let's use the standard "super_admin" setup if possible or just mock auth?
    # Actually, simpler to use the same flow as previous test: Create School -> Login as Principal.
    
    # Create School via Super Admin (Mocked or real?)
    # Assuming local dev env has no auth on /api/schools/with-principal? Wait, it needs super_admin role.
    # We'll try to find a way to get a token.
    # Previous test used: POST /api/auth/admin/login
    
    print("\n=== Step 1: Login as Admin ===")
    admin_login = client.post("/api/auth/admin/login", json={"username": "owner@classa.com", "password": "mg8*54DV^Ctuc2rq"})
    if admin_login.status_code != 200:
        print(f"Admin login failed: {admin_login.text}. Attempting setup workaround?")
        # If this fails, we might need to rely on existing data or skip auth (not possible).
        # Assuming admin@classa.io exists in seeded dev db.
        return
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    print("\n=== Step 2: Create School ===")
    school_code = f"sch-{uuid.uuid4().hex[:6]}"
    principal_email = f"principal@{school_code}.com"
    create_school = client.post(
        "/api/schools/with-principal?role=super_admin",
        headers=admin_headers,
        json={
            "school": {
                "name": "Phase2 Test School",
                "code": school_code,
                "country": "Nepal", # Required field usually
                "is_active": True
            },
            "principal": {
                "first_name": "Principal",
                "last_name": "User",
                "email": principal_email,
                "password": "password"
            }
        }
    )
    if create_school.status_code != 201:
        print(f"Create school failed: {create_school.text}")
        return
    school_id = create_school.json()["id"]
    print(f"School Created: {school_id}")

    # Login as Principal
    print(f"\n=== Step 3: Login as Principal {principal_email} ===")
    p_login = client.post("/api/auth/login", json={"username": principal_email, "password": "password", "school_id": school_id})
    if p_login.status_code != 200:
        print(f"Principal login failed: {p_login.text}")
        return
    p_token = p_login.json()["access_token"]
    p_headers = {"Authorization": f"Bearer {p_token}"}

    # Fetch Principal ID via Users List
    # Verified: schools/router.py has @router.get("/users")
    users_resp = client.get("/api/users", headers=p_headers)
    assert users_resp.status_code == 200
    users = users_resp.json()
    # It might be list or paginated items
    if isinstance(users, dict) and "items" in users:
        users = users["items"]
        
    principal_user = next((u for u in users if u["email"] == principal_email), None)
    if not principal_user:
        print("Principal not found in users list!")
        return
        
    principal_id = principal_user["id"]
    print(f"Principal ID: {principal_id}")
    
    # 4. Setup Academic Year & Grade
    print("\n=== Step 4: Setup Year & Grade ===")
    ay_resp = client.post("/api/academics/academic-years", headers=p_headers, json={
        "name": "2025-2026",
        "start_date": "2025-01-01",
        "end_date": "2025-12-31"
    })
    ay_id = ay_resp.json()["id"]
    
    grade_resp = client.post("/api/academics/grades", headers=p_headers, json={"name": "Grade 10", "sequence": 10})
    grade_id = grade_resp.json()["id"]
    
    # 5. Create Grade Subject (With Book)
    print("\n=== Step 5: Create Grade Subject ===")
    gs_payload = {
        "grade_id": grade_id,
        "academic_year_id": ay_id,
        "name": "Physics",
        "code": "PHY101",
        "book_title": "Physics for Gen Z",
        "book_publisher": "Future Press",
        "book_edition": "1st Edition"
    }
    gs_resp = client.post("/api/academics/grade-subjects", headers=p_headers, json=gs_payload)
    if gs_resp.status_code != 200:
        print(f"Create GS Failed: {gs_resp.text}")
        return
    gs_data = gs_resp.json()
    gs_id = gs_data["id"]
    print(f"Grade Subject Created: {gs_id}, Book: {gs_data.get('current_book_title')}")
    assert gs_data["current_book_title"] == "Physics for Gen Z"
    
    # 6. Add New Book Version
    print("\n=== Step 6: Add Book Version 2 ===")
    v2_payload = {
        "title": "Physics for Gen Alpha",
        "publisher": "Future Press",
        "edition": "2nd Edition",
        "effective_from": str(date.today())
    }
    v2_resp = client.post(f"/api/academics/grade-subjects/{gs_id}/book-versions", headers=p_headers, json=v2_payload)
    assert v2_resp.status_code == 200
    print("ver 2 added.")
    
    # Verify List (Get V2 mainly, history should show both?)
    list_gs = client.get(f"/api/academics/grade-subjects?academic_year_id={ay_id}&grade_id={grade_id}", headers=p_headers)
    assert list_gs.json()[0]["current_book_title"] == "Physics for Gen Alpha"
    print("Listing shows V2 title.")
    
    # 7. Create Section & Timetable Mapping
    print("\n=== Step 7: Create Section & Map Subject ===")
    sec_resp = client.post("/api/academics/sections", headers=p_headers, json={"name": "Section A"})
    sec_id = sec_resp.json()["id"]
    
    mapping_payload = [{
        "academic_year_id": ay_id,
        "grade_id": grade_id,
        "section_id": sec_id,
        "day_pattern_key": "REGULAR",
        "period_index": 1,
        "grade_subject_id": gs_id # Using specific GS
    }]
    map_resp = client.put("/api/academics/timetable/section-subject", headers=p_headers, json=mapping_payload)
    assert map_resp.status_code == 200
    
    # Verify Mapping retrieval
    get_map = client.get(
        f"/api/academics/timetable/section-subject?academic_year_id={ay_id}&grade_id={grade_id}&section_id={sec_id}&day_pattern_key=REGULAR", 
        headers=p_headers
    )
    data = get_map.json()
    print(f"Mapping Data: {data[0]}")
    assert data[0]["grade_subject_id"] == gs_id
    assert data[0]["book_title"] == "Physics for Gen Alpha"
    print("Timetable mapping verified correctly with Contextual Book Title.")
    
    # 8. Teaching Assignment
    print("\n=== Step 8: Flexible Teaching Assignment ===")
    # Assign Principal as teacher for this GS
    assign_payload = {
        "academic_year_id": ay_id,
        "teacher_user_id": principal_id,
        "grade_id": grade_id,
        "grade_subject_id": gs_id,
        "section_id": sec_id # Specific section assignment
    }
    assign_resp = client.post("/api/academics/teaching-assignments", headers=p_headers, json=assign_payload)
    if assign_resp.status_code != 200:
        print(f"Assignment Failed: {assign_resp.text}")
        return
        
    print("Teaching Assignment Created.")
    
    # List assignments
    list_assign = client.get(f"/api/academics/teaching-assignments?academic_year_id={ay_id}", headers=p_headers)
    assert len(list_assign.json()) >= 1
    print("Assignment listed successfully.")
    
    print("\n=== PHASE 2 TEST COMPLETE SUCCESS ===")

if __name__ == "__main__":
    run_test()
