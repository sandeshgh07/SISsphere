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
    
    # Need to create Grade and assign student to it to test directory properly
    print("\n--- 4. Create Grade ---")
    grade_data = {"name": "Test Grade 10", "sequence": 1.0} # Float sequence?
    res = requests.post(f"{BASE_URL}{API_PREFIX}/academics/grades", json=grade_data, headers=headers_principal)
    # If endpoint differs check router. But assuming standard for now.
    # Actually I should check `academics/router.py` or similar if I don't know endpoint.
    # Assuming standard CRUD?
    # Wait, let's just create student without grade first, then update?
    # The models say Grade is required or nullable? Nullable.
    # But for Directory we need grade.
    
    # Check if Grades exist? usually school creation doesn't make grades.
    # Let's try to create one if endpoint exists, or just use `POST /grades`?
    # I'll rely on viewing the code?
    # Or... for directory test, I can skip if I can't create grade easily.
    # But `get_parent_directory` relies on grades.
    
    # Let's try creating a grade via `POST /api/academics/grades`
    # If that fails I will check endpoints.
    
    print("\n--- 4. Create Student with Grade ---")
    # First create student
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

    # Assign Grade? 
    # API might allow creating with grade_id. 
    # But I don't have a grade_id.
    
    # Let's try creating a new grade.
    grade_res = requests.post(f"{BASE_URL}{API_PREFIX}/academics/grades", json={"name": "Grade 10", "sequence": 1}, headers=headers_principal)
    if grade_res.status_code in [200, 201]:
        grade_id = grade_res.json()["id"]
        print(f"Grade created: {grade_id}")
        
        # Update student with grade
        # PATCH /students/{id}
        grade_update_res = requests.patch(f"{BASE_URL}{API_PREFIX}/students/{student_id}", json={"grade_id": grade_id}, headers=headers_principal)
        if grade_update_res.status_code == 200:
             print(f"Student updated with grade: {grade_id}")
        else:
             print(f"Failed to update student grade: {grade_update_res.status_code} {grade_update_res.text}")
    else:
        print(f"Failed to create grade (maybe endpoint differs): {grade_res.status_code}")
        grade_id = None

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

    print("\n--- 7. Verify Directory Endpoint ---")
    res = requests.get(f"{BASE_URL}{API_PREFIX}/parents/me/directory", headers=headers_parent)
    if res.status_code == 200:
        data = res.json()
        print(f"Directory Data: {json.dumps(data, indent=2)}")
        
        # Checks
        if grade_id:
            # Should have students
            if len(data.get("students", [])) > 0:
                print("✅ Students found.")
                s1 = data["students"][0]
                if s1["id"] == student_id:
                     print("✅ Correct student in directory.")
                
                # Check privacy
                if "phone" in s1 or "email" in s1:
                    print("❌ Privacy Leak: Student phone/email present.")
                else:
                    print("✅ Privacy check passed (Students).")
            else:
                print("❌ No students found (Expected 1).")
        
        # Check Staff
        if len(data.get("staff", [])) > 0:
            print(f"✅ Staff found: {len(data['staff'])}")
            st1 = data["staff"][0]
            # Principal should be there
             # Check privacy
            if "phone" in st1 or "email" in st1:
                print("❌ Privacy Leak: Staff phone/email present.")
            else:
                print("✅ Privacy check passed (Staff).")
        else:
            print("❌ No staff found (Expected Principal).")

    else:
        print(f"❌ Directory Endpoint Failed: {res.status_code} {res.text}")

if __name__ == "__main__":
    main()
