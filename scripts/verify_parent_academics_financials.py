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
    
    data = res.json()
    school_id = data.get("id")
    print(f"School Created: {school_id}")
    principal_email = school_payload['principal']['email']

    print("\n--- 3. Login as Principal ---")
    principal_creds = {
        "username": principal_email,
        "password": "Password123!",
        "school_id": school_id
    }
    res = requests.post(f"{BASE_URL}{API_PREFIX}/auth/login", json=principal_creds)
    principal_token = res.json()["access_token"]
    headers_principal = {"Authorization": f"Bearer {principal_token}"}
    print("Principal logged in.")

    print("\n--- 4. Create Student ---")
    student_data = {
        "first_name": "Test",
        "last_name": "Child",
        "roll_no": f"R-{run_id}"
    }
    res = requests.post(f"{BASE_URL}{API_PREFIX}/students", json=student_data, headers=headers_principal)
    if res.status_code not in [200, 201]:
        print(f"Failed to create student: {res.text}")
        return
    student_id = res.json()["id"]
    print(f"Student created: {student_id}")

    print("\n--- 5. Create Parent and Link ---")
    parent_email = f"parent.{run_id}@test.com"
    parent_data = {
        "email": parent_email,
        "password": "Password123!",
        "first_name": "Test",
        "last_name": "Parent",
        "role": "parent"
    }
    res = requests.post(f"{BASE_URL}{API_PREFIX}/users", json=parent_data, headers=headers_principal)
    if res.status_code not in [200, 201]:
        print(f"Failed to create parent: {res.text}")
        return
    parent_id = res.json()["id"]
    print(f"Parent created: {parent_id}")

    # Link
    link_payload = {"student_ids": [student_id]}
    res = requests.put(f"{BASE_URL}{API_PREFIX}/students/parents/{parent_id}/students", json=link_payload, headers=headers_principal)
    if res.status_code != 200:
        print(f"Failed to link: {res.text}")
        return
    print("Link successful.")

    print("\n--- 6. Login as Parent ---")
    res = requests.post(f"{BASE_URL}{API_PREFIX}/auth/login", json=principal_creds) # Oops copy paste error in previous thought, wait. I need parent creds.
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

    print("\n--- 7. Verify Academics Endpoint ---")
    res = requests.get(f"{BASE_URL}{API_PREFIX}/parents/me/academics/summary", headers=headers_parent)
    if res.status_code == 200:
        data = res.json()
        print(f"Academics Data: {json.dumps(data, indent=2)}")
        if len(data) > 0 and data[0]['student_id'] == student_id:
             print("✅ Academics Endpoint Verified")
        else:
             print("❌ Academics Data Empty or Mismatch")
    else:
        print(f"❌ Academics Endpoint Failed: {res.status_code} {res.text}")

    print("\n--- 8. Verify Financials Endpoint ---")
    res = requests.get(f"{BASE_URL}{API_PREFIX}/parents/me/financials/summary", headers=headers_parent)
    if res.status_code == 200:
        data = res.json()
        print(f"Financials Data: {json.dumps(data, indent=2)}")
        # Check for students list and student_id inside
        if data.get("students") and len(data["students"]) > 0:
            s_data = data["students"][0]
            if s_data.get("student_id") == student_id:
                print("✅ Financials Endpoint Verified (student_id present)")
            else:
                print(f"❌ Financials: student_id missing or mismatch. Found keys: {s_data.keys()}")
        else:
             print("❌ Financials Data Empty")
    else:
        print(f"❌ Financials Endpoint Failed: {res.status_code} {res.text}")

if __name__ == "__main__":
    main()
