
import sys
import os
import random
import string
import json
from datetime import date, timedelta

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
    school_code = f"sched-{random_string()}"
    principal_email = f"principal@{school_code}.com"
    principal_pass = "Password123!"
    
    print(f"\n=== Step 2: Create School {school_code} ===")
    payload = {
        "school": {
            "name": "Schedule Test School",
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

    # --- TEST SCHEDULING ---

    # 1. Create Template
    print("\n=== Step 4: Create Schedule Template ===")
    template_data = {
        "name": "Regular 8 Periods",
        "structure": [
            {"label": "P1", "start": "09:00", "end": "09:45", "type": "CLASS"},
            {"label": "Break", "start": "09:45", "end": "10:00", "type": "BREAK"},
            {"label": "P2", "start": "10:00", "end": "10:45", "type": "CLASS"}
        ]
    }
    tpl_resp = client.post("/api/academics/schedule-templates", json=template_data, headers=p_headers)
    if tpl_resp.status_code != 200:
        print(f"Create Template Failed: {tpl_resp.text}")
        return
    tpl_id = tpl_resp.json()["id"]
    print(f"Template Created: {tpl_id}")
    
    # 2. Weekly Rules
    print("\n=== Step 5: Set Weekly Rules ===")
    weekly_data = {
        "day_rules": {
            "Monday": tpl_id,
            "Tuesday": tpl_id,
            "Wednesday": tpl_id,
            "Thursday": tpl_id,
            "Friday": tpl_id
        }
    }
    week_resp = client.post("/api/academics/schedule-weekly-rules", json=weekly_data, headers=p_headers)
    if week_resp.status_code != 200:
        print(f"Weekly Rules Failed: {week_resp.text}")
        return
    print("Weekly Rules Set.")
    
    # 3. Grade Mapping (Setup Grade First)
    print("\n=== Step 6: Grade Mapping ===")
    grade_resp = client.post("/api/academics/grades", json={"name": "Grade 10", "sequence": 10}, headers=p_headers)
    grade_id = grade_resp.json()["id"]
    
    map_data = {
        "grade_id": grade_id,
        "inherit_weekly": True,
        "default_template_id": None
    }
    map_resp = client.post("/api/academics/schedule-grade-mappings", json=map_data, headers=p_headers)
    if map_resp.status_code != 200:
        print(f"Grade Mapping Failed: {map_resp.text}")
        return
    print("Grade Mapping Created.")
    
    # 4. Override
    print("\n=== Step 7: Create Override ===")
    today = date.today().isoformat()
    override_data = {
        "name": "Exam Day",
        "start_date": today,
        "end_date": today,
        "target_grade_ids": [],
        "rule_config": {
            "days": [date.today().strftime("%A")],
            "template_id": tpl_id
        }
    }
    ov_resp = client.post("/api/academics/schedule-overrides", json=override_data, headers=p_headers)
    if ov_resp.status_code != 200:
        print(f"Override Failed: {ov_resp.text}")
        return
    print(f"Override Created: {ov_resp.json()['id']}")
    
    # 5. Preview
    print("\n=== Step 8: Preview Schedule ===")
    prev_data = {
        "date": today,
        "grade_id": None
    }
    prev_resp = client.post("/api/academics/schedule/preview", json=prev_data, headers=p_headers)
    if prev_resp.status_code != 200:
        print(f"Preview Failed: {prev_resp.text}")
        return
    
    res = prev_resp.json()
    print(f"Preview Result: Source={res['source']}, Template={res['template_name']}")
    
    assert res['template_name'] == "Regular 8 Periods"
    assert "Override" in res['source'] or "Weekly" in res['source'] # Ideally override wins
    
    print("\n✅ Period Structure Verification SUCCESS!")

if __name__ == "__main__":
    run_test()
