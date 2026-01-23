
import sys
import os
import random
import string
# Fix path to include root
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
import json
from datetime import date

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
    school_code = f"acad-{random_string()}"
    principal_email = f"principal@{school_code}.com"
    principal_pass = "Password123!"
    
    print(f"\n=== Step 2: Create School {school_code} ===")
    payload = {
        "school": {
            "name": "Academics Test School",
            "code": school_code,
            "country": "Nepal",
            "is_active": True
        },
        "principal": {
            "first_name": "Principal",
            "last_name": "Test",
            "email": principal_email,
            "password": principal_pass
        }
    }
    
    create_school = client.post(
        "/api/schools/with-principal", # Assuming query param role=super_admin optional or default? Previous script used it.
        params={"role": "super_admin"},
        json=payload,
        headers=owner_headers
    )
    if create_school.status_code != 201:
        print(f"Create School Failed: {create_school.text}")
        return
    
    print("School Created.")
    school_data = create_school.json()
    school_id = school_data["id"]

    # Login as Principal
    print(f"\n=== Step 3: Login as Principal {principal_email} (School: {school_id}) ===")
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
    
    # Create Academic Year
    print("\n=== Step 4: Create Academic Year ===")
    ay_payload = {
        "name": "2025-2026",
        "start_date": "2025-04-15",
        "end_date": "2026-03-31",
        "is_active": True
    }
    ay_resp = client.post("/api/academics/academic-years", json=ay_payload, headers=p_headers)
    if ay_resp.status_code != 200:
        print(f"Create AY Failed: {ay_resp.text}")
        return
    ay_data = ay_resp.json()
    ay_id = ay_data["id"]
    print(f"AY Created: {ay_data['name']} (ID: {ay_id})")
    
    # Create Term
    print("\n=== Step 5: Create First Term ===")
    # First Term covers today? Today is 2026-01-21.
    # If AY ends March 2026, then Jan 2026 is inside.
    # Let's make term cover Jan 2026.
    term_payload = {
        "name": "Third Term",
        "academic_year_id": ay_id,
        "start_date": "2025-12-01",
        "end_date": "2026-03-15",
        "weightage": 40.0
    }
    term_resp = client.post("/api/academics/terms", json=term_payload, headers=p_headers)
    if term_resp.status_code != 200:
        print(f"Create Term Failed: {term_resp.text}")
        return
    print(f"Term Created: {term_resp.json()['name']}")
    
    # Create Grading Policy
    print("\n=== Step 6: Create Grading Policy ===")
    policy_payload = {
        "academic_year_id": ay_id,
        "gpa_scale": "4.0",
        "pass_mark": 40.0,
        "grading_structure": [{"label": "A", "min": 90}]
    }
    pol_resp = client.post("/api/academics/grading-policies", json=policy_payload, headers=p_headers)
    if pol_resp.status_code != 200:
        print(f"Create Policy Failed: {pol_resp.text}")
        return # Continue? No, stricter.
    print("Policy Created.")
    
    # Create Grade & Subject
    print("\n=== Step 7: Create Grade and Subject ===")
    # Grade
    grade_resp = client.post("/api/academics/grades", json={"name": "Grade 10", "sequence": 10}, headers=p_headers)
    grade_id = grade_resp.json()["id"]
    
    # Subject
    sub_payload = {
        "name": "Advanced Math",
        "code": "MTH101",
        "grade_id": grade_id,
        "is_elective": False
    }
    sub_resp = client.post("/api/academics/subjects", json=sub_payload, headers=p_headers)
    if sub_resp.status_code != 200:
        print(f"Create Subject Failed: {sub_resp.text}")
        return
    print(f"Subject Created: {sub_resp.json()['name']}")
    
    # Get Overview
    print("\n=== Step 8: Get Overview ===")
    overview_resp = client.get("/api/academics/overview", headers=p_headers)
    if overview_resp.status_code != 200:
        print(f"Overview Failed: {overview_resp.text}")
        return
    
    ov = overview_resp.json()
    print("Overview Data:")
    print(json.dumps(ov, indent=2))
    
    # Assertions
    assert ov["active_year"]["id"] == ay_id
    assert ov["current_term"]["name"] == "Third Term"
    assert ov["grades_count"] >= 1
    assert "GPA Scale: 4.0" in ov["policy_summary"]
    
    print("\n✅ Verification SUCCESS!")

if __name__ == "__main__":
    run_test()
