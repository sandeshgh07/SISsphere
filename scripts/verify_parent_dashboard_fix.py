import sys
import os
import requests
import json
import uuid

# Set up path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

BASE_URL = "http://localhost:8000"
API_PREFIX = "/api"

def main():
    print("--- 1. Login as Superuser ---")
    owner_creds = {
        "username": "owner@classa.com",
        "password": "mg8*54DV^Ctuc2rq"
    }
    
    try:
        res = requests.post(f"{BASE_URL}{API_PREFIX}/auth/admin/login", json=owner_creds)
        if res.status_code != 200:
            print(f"Superuser login failed: {res.text}")
            return
        owner_token = res.json()["access_token"]
        headers_owner = {"Authorization": f"Bearer {owner_token}"}
        print("Superuser logged in.")
    except Exception as e:
        print(f"Connection failed: {e}")
        return

    print("\n--- 2. Create School + Principal ---")
    run_id = uuid.uuid4().hex[:6]
    school_payload = {
        "school": {
            "name": f"Test School {run_id}",
            "code": f"test-school-{run_id}",
            "country": "Nepal",
            "is_active": True
        },
        "principal": {
            "first_name": "Test",
            "last_name": "Principal",
            "email": f"principal.{run_id}@test.com",
            "password": "Password123!"
        }
    }
    
    res = requests.post(
        f"{BASE_URL}{API_PREFIX}/schools/with-principal?role=super_admin",
        json=school_payload,
        headers=headers_owner
    )
    if res.status_code != 201:
        print(f"School creation failed: {res.text}")
        return
    
    print(f"School created: {school_payload['school']['name']}")
    principal_email = school_payload['principal']['email']
    principal_password = school_payload['principal']['password']

    print("\n--- 3. Login as Principal ---")
    # Need to find school_id? 
    # Actually, wait. Principal login usually needs school_id or just email if unique?
    # auth/login says: "if credentials.school_id: ... else: ... User must be SUPER_ADMIN"
    # But wait, Principal IS NOT Super Admin.
    # So Principal MUST provide school_id.
    # We need to get the school_id from the creation response.
    # school_res = res.json()
    # It returns detailed info?
    # debug_api_test.py prints response.json().
    # Let's assume response contains school_id.
    data = res.json()
    # It returns the School object directly
    school_id = data.get("id")
    if not school_id:
        print(f"Could not find school_id in response: {json.dumps(data)}")
        return
    
    print(f"School ID: {school_id}")

    principal_creds = {
        "username": principal_email,
        "password": principal_password,
        "school_id": school_id
    }
    
    res = requests.post(f"{BASE_URL}{API_PREFIX}/auth/login", json=principal_creds)
    if res.status_code != 200:
        print(f"Principal login failed: {res.text}")
        return
        
    principal_token = res.json()["access_token"]
    headers_principal = {"Authorization": f"Bearer {principal_token}"}
    print("Principal logged in.")

    print("\n--- 4. Create Student ---")
    student_data = {
        "first_name": "Test",
        "last_name": "Child",
        "roll_no": f"R-{run_id}",
        "grade_id": None, # Optional
        "section_id": None # Optional
    }
    res = requests.post(f"{BASE_URL}{API_PREFIX}/students", json=student_data, headers=headers_principal)
    if res.status_code not in [200, 201]:
        print(f"Failed to create student: {res.text}")
        return
    student_id = res.json()["id"]
    print(f"Student created: {student_id}")

    print("\n--- 5. Create Parent ---")
    parent_email = f"parent.{run_id}@test.com"
    parent_data = {
        "email": parent_email,
        "password": "Password123!",
        "first_name": "Test",
        "last_name": "Parent",
        "role": "parent"
    }
    # Where to create parent? /users?
    # "users_router" -> POST /users requires Admin? Principal is Admin role usually?
    # Let's try.
    res = requests.post(f"{BASE_URL}{API_PREFIX}/users", json=parent_data, headers=headers_principal)
    if res.status_code not in [200, 201]:
        print(f"Failed to create parent: {res.text}")
        return
    parent_id = res.json()["id"]
    print(f"Parent created: {parent_id}")

    print("\n--- 6. Link Parent -> Student ---")
    link_payload = {"student_ids": [student_id]}
    res = requests.put(f"{BASE_URL}{API_PREFIX}/students/parents/{parent_id}/students", json=link_payload, headers=headers_principal)
    if res.status_code != 200:
        print(f"Failed to link: {res.text}")
        return
    print("Link successful.")

    print("\n--- 7. Login as Parent ---")
    parent_creds = {
        "username": parent_email,
        "password": "Password123!",
        "school_id": school_id
    }
    res = requests.post(f"{BASE_URL}{API_PREFIX}/auth/login", json=parent_creds)
    if res.status_code != 200:
        print(f"Parent login failed: {res.text}")
        return
    parent_token = res.json()["access_token"]
    headers_parent = {"Authorization": f"Bearer {parent_token}"}
    print("Parent logged in.")

    print("\n--- 8. Verify GET /api/parents/me/students ---")
    res = requests.get(f"{BASE_URL}{API_PREFIX}/parents/me/students", headers=headers_parent)
    if res.status_code == 200:
        data = res.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        found = any(s["id"] == student_id for s in data)
        if found:
            print("✅ SUCCESS: Linked student found in parent dashboard endpoint.")
        else:
            print("❌ FAILURE: Linked student NOT found in response.")
    else:
        print(f"❌ FAILURE: Endpoint returned status {res.status_code}: {res.text}")

    print("\n--- 9. Verify GET /api/parent/dashboard/summary ---")
    res = requests.get(f"{BASE_URL}{API_PREFIX}/parent/dashboard/summary", headers=headers_parent)
    if res.status_code == 200:
        data = res.json()
        print(f"Summary Response Length: {len(data)}")
        if len(data) > 0 and data[0]["student_id"] == student_id:
            print("✅ SUCCESS: Analytics summary returned data for student.")
        else:
            print("❌ FAILURE: Analytics summary empty or mismatch.")
    else:
        print(f"❌ FAILURE: Summary endpoint failed {res.status_code}: {res.text}")

if __name__ == "__main__":
    main()
