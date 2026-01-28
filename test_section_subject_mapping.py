
import sys
import os
import random
import string
import json
from datetime import date

# Fix path to include root
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def random_string(length=6):
    return ''.join(random.choices(string.ascii_lowercase, k=length))

def run_test():
    print("=== Step 1: Login as Platform Owner ===")
    login_response = client.post(
        "/api/auth/admin/login",
        json={  
            "username": "owner@classa.com",
            "password": "mg8*54DV^Ctuc2rq"
        }
    )
    if login_response.status_code != 200:
        print(f"Owner Login Failed: {login_response.text}")
        return
    
    owner_token = login_response.json().get("access_token")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    
    # Create School
    school_code = f"map-{random_string()}"
    principal_email = f"principal@{school_code}.com"
    principal_pass = "Password123!"
    
    print(f"\n=== Step 2: Create School {school_code} ===")
    payload = {
        "school": {
            "name": "Mapping Test School",
            "code": school_code,
            "country": "Nepal",
            "is_active": True
        },
        "principal": {
            "first_name": "Sched",
            "last_name": "Admin",
            "email": principal_email,
            "password": principal_pass
        }
    }
    
    create_school = client.post(
        "/api/schools/with-principal", 
        params={"role": "super_admin"},
        json=payload,
        headers=owner_headers
    )
    if create_school.status_code != 201:
        print(f"Create School Failed: {create_school.text}")
        return
    
    school_id = create_school.json()["id"]
    print(f"Create School Response: {create_school.json()}")
    # Check if principal is returned
    resp_json = create_school.json()
    if "principal" in resp_json:
        principal_id = resp_json["principal"]["id"]
        print(f"Principal ID from Creation: {principal_id}")
    else:
        print("Principal object not in create_school response")

    # Login as Principal
    print(f"\n=== Step 3: Login as Principal {principal_email} ===")
    p_login = client.post(
        "/api/auth/login", 
        json={ 
            "username": principal_email,
            "password": principal_pass,
            "school_id": school_id
        }
    )
    
    if p_login.status_code != 200:
        print(f"Principal Login Failed: {p_login.text}")
        return

    p_token = p_login.json().get("access_token")
    p_headers = {"Authorization": f"Bearer {p_token}"}
    print("Principal Logged In.")

    # --- SETUP ACADEMIC DATA ---
    
    # 1. Academic Year
    print("\n=== Step 4: Create Academic Year ===")
    ay_resp = client.post("/api/academics/academic-years", json={
        "name": "2024",
        "start_date": "2024-01-01",
        "end_date": "2024-12-31",
        "is_active": True
    }, headers=p_headers)
    assert ay_resp.status_code == 200
    ay_id = ay_resp.json()["id"]

    # 2. Grade
    print("\n=== Step 5: Create Grade ===")
    grade_resp = client.post("/api/academics/grades", json={"name": "Grade 10", "sequence": 10}, headers=p_headers)
    assert grade_resp.status_code == 200
    grade_id = grade_resp.json()["id"]
    
    # 3. Section
    print("\n=== Step 6: Create Section ===")
    sec_resp = client.post("/api/academics/sections", json={"name": "A"}, headers=p_headers)
    assert sec_resp.status_code == 200
    section_id = sec_resp.json()["id"]
    
    # 4. Create Teacher User
    print("\n=== Step 7: Create Teacher ===")
    teacher_email = f"teacher@{school_code}.com"
    # We need a teacher user. Usually requires admin to create user.
    # Assuming standard user creation flow or helper
    # Let's create a user via /api/schools/{school_id}/users if accessible or standard register?
    # Actually, create_school made principal. Let's make a teacher via principal.
    user_payload = {
        "email": teacher_email,
        "password": "Password123!",
        "first_name": "Teacher",
        "last_name": "One",
        "role": "teacher",
        "school_id": school_id
    }
    # Note: Using a direct robust endpoint if available. 
    # Usually: POST /api/auth/register-user inside school context or admin endpoint
    # Looking at `test_period_structure_v2.py` it doesn't create teachers.
    # I'll create using `POST /api/schools/{school_id}/users` if I can find it.
    # Or `POST /api/auth/register`?
    # Let's try `POST /api/auth/register` as principal? No.
    # I'll check `admin/router.py` or similar later. But for now let's try assuming Principal can be the teacher for the test?
    # Yes, principal has user_id. Let's create a subject assigned to Principal for simplicity, verifying the system works.
    import uuid
    print(f"Login Response Keys: {p_login.json().keys()}")
    print(f"Fetching users for school {school_id}")
    users_resp = client.get(f"/api/schools/{school_id}/users", headers=p_headers)
    if users_resp.status_code == 200:
        users = users_resp.json()
        user_list = users.get('items', users) if isinstance(users, dict) else users
        principal = next((u for u in user_list if u['email'] == principal_email), None)
        if principal:
            teacher_id = principal['id']
            print(f"Found Principal ID: {teacher_id}")
        else:
            print("Principal not found in user list.")
            teacher_id = str(uuid.uuid4())
    else:
        print(f"Failed to list users: {users_resp.status_code}")
        teacher_id = str(uuid.uuid4())
    
    # 5. Subject
    print("\n=== Step 8: Create Subject ===")
    subj_data = {
        "name": "English",
        "code": "ENG101",
        "is_elective": False,
        "grade_id": grade_id,
        "assigned_teacher_id": teacher_id
    }
    subj_resp = client.post("/api/academics/subjects", json=subj_data, headers=p_headers)
    assert subj_resp.status_code == 200
    subject_id = subj_resp.json()["id"]
    
    # --- TEST MAPPING ---
    
    # 6. Create Mapping
    print("\n=== Step 9: Create Section-Subject Mapping ===")
    mapping_payload = [
        {
            "academic_year_id": ay_id,
            "grade_id": grade_id,
            "section_id": section_id,
            "day_pattern_key": "REGULAR",
            "period_index": 1,
            "grade_subject_id": subject_id
        }
    ]
    
    map_resp = client.put("/api/academics/timetable/section-subject", json=mapping_payload, headers=p_headers)
    if map_resp.status_code != 200:
        print(f"Mapping Failed: {map_resp.text}")
        return
    print("Mapping Upserted.")
    
    # 7. Get Mapping
    print("\n=== Step 10: Verify Mapping ===")
    get_map = client.get("/api/academics/timetable/section-subject", params={
        "academic_year_id": ay_id,
        "grade_id": grade_id,
        "section_id": section_id,
        "day_pattern_key": "REGULAR"
    }, headers=p_headers)
    
    assert get_map.status_code == 200
    data = get_map.json()
    assert len(data) == 1
    print(f"GET Response Data[0]: {data[0]}")
    # Assert subject_id is correct (grade_subject_id might be None due to aliasing)
    assert data[0]["subject_id"] == subject_id
    print("Mapping Verified.")
    
    # 8. Compute Class Teacher
    print("\n=== Step 11: Auto Compute Class Teacher ===")
    comp_resp = client.post("/api/academics/timetable/compute-class-teachers", params={
        "academic_year_id": ay_id,
        "grade_id": grade_id,
        "section_id": section_id
    }, headers=p_headers)
    
    if comp_resp.status_code != 200:
        print(f"Computation Failed: {comp_resp.text}")
        return
    
    print(f"Computed Teacher: {comp_resp.json()}")
    assert comp_resp.json()["teacher_id"] == teacher_id # Should be Principal/Teacher
    
    # Verify Persistence
    ct_get = client.get("/api/academics/class-teachers", params={
         "academic_year_id": ay_id,
        "grade_id": grade_id,
        "section_id": section_id
    }, headers=p_headers)
    assert ct_get.status_code == 200
    assert ct_get.json()["teacher_user_id"] == teacher_id
    assert ct_get.json()["source"] == "AUTO_FROM_P1"
    
    # 9. Override
    print("\n=== Step 12: Manual Override ===")
    # Let's override (using same teacher id is fine to test logic, or null if allowed, but schema implies str)
    # Actually schema requires string. I'll use same ID but check source change.
    
    over_resp = client.put("/api/academics/class-teachers/override", json={
        "academic_year_id": ay_id,
        "grade_id": grade_id,
        "section_id": section_id,
        "teacher_user_id": teacher_id # Same ID
    }, headers=p_headers)
    assert over_resp.status_code == 200
    
    ct_get_2 = client.get("/api/academics/class-teachers", params={
         "academic_year_id": ay_id,
        "grade_id": grade_id,
        "section_id": section_id
    }, headers=p_headers)
    assert ct_get_2.json()["source"] == "MANUAL_OVERRIDE"
    
    # 10. Re-Compute (Should NOT overwrite)
    print("\n=== Step 13: Re-Compute Protection ===")
    comp_resp_2 = client.post("/api/academics/timetable/compute-class-teachers", params={
        "academic_year_id": ay_id,
        "grade_id": grade_id,
        "section_id": section_id
    }, headers=p_headers)
    
    print(comp_resp_2.json())
    # Should say "skipped" or similar logic? 
    # My logic was: "return {message: 'Class teacher is manually overridden...'}"
    assert "overridden" in comp_resp_2.json()["message"]
    
    ct_get_3 = client.get("/api/academics/class-teachers", params={
         "academic_year_id": ay_id,
        "grade_id": grade_id,
        "section_id": section_id
    }, headers=p_headers)
    assert ct_get_3.json()["source"] == "MANUAL_OVERRIDE"
    
    print("\n✅ Section-Subject Mapping & Class Teacher Verification SUCCESS!")

if __name__ == "__main__":
    run_test()
