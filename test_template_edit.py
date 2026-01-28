
import sys
import os
import random
import string
import json
from datetime import date, timedelta

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
    school_code = f"edit-{random_string()}"
    principal_email = f"principal@{school_code}.com"
    principal_pass = "Password123!"
    
    payload = {
        "school": {
            "name": "Edit Test School",
            "code": school_code,
            "country": "Nepal",
            "is_active": True
        },
        "principal": {
            "first_name": "Edit",
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
    p_login = client.post(
        "/api/auth/login", 
        json={ 
            "username": principal_email,
            "password": principal_pass,
            "school_id": school_id
        }
    )
    
    p_token = p_login.json().get("access_token")
    p_headers = {"Authorization": f"Bearer {p_token}"}

    # 1. Create Template
    print("\n=== Step 2: Create Template ===")
    template_data = {
        "name": "Original Name",
        "structure": [
            {"label": "P1", "start": "09:00", "end": "09:45", "type": "CLASS"}
        ]
    }
    tpl_resp = client.post("/api/academics/schedule-templates", json=template_data, headers=p_headers)
    if tpl_resp.status_code != 200:
        print(f"Create Failed: {tpl_resp.text}")
        return
    tpl_id = tpl_resp.json()["id"]
    print(f"Template Created: {tpl_id}")
    
    # 2. Update Template
    print("\n=== Step 3: Update Template ===")
    update_data = {
        "name": "Updated Name",
        "structure": [
            {"label": "P1", "start": "10:00", "end": "10:45", "type": "CLASS"},
            {"label": "P2", "start": "11:00", "end": "11:45", "type": "CLASS"}
        ]
    }
    upd_resp = client.put(f"/api/academics/schedule-templates/{tpl_id}", json=update_data, headers=p_headers)
    
    if upd_resp.status_code != 200:
        print(f"Update Failed: {upd_resp.text}")
        return
    
    res = upd_resp.json()
    print(f"Updated Name: {res['name']}")
    print(f"Updated Structure Len: {len(res['structure'])}")
    
    assert res['name'] == "Updated Name"
    assert len(res['structure']) == 2
    assert res['structure'][0]['start'] == "10:00"
    
    print("\n✅ Template Update Verification SUCCESS!")

if __name__ == "__main__":
    run_test()
