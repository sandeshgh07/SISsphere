
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
import json

client = TestClient(app, raise_server_exceptions=True)

def run_verification():
    print("=== Verification: Student Assignment Feature ===")

    # 1. Login
    print("\n[1] Logging in as Super Admin...")
    login_resp = client.post("/api/auth/admin/login", json={
        "username": "owner@classa.com",
        "password": "mg8*54DV^Ctuc2rq"
    })
    
    if login_resp.status_code != 200:
        print(f"Login failed: {login_resp.text}")
        return
    
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Login successful.")

    # 1.5 Get School Context
    print("\n[1.5] Fetching Schools to establish context...")
    schools_resp = client.get("/api/schools", headers=headers)
    if schools_resp.status_code != 200:
        print(f"Failed to fetch schools: {schools_resp.text}")
        return
    
    schools = schools_resp.json()
    if not schools:
        # Create a school if none exist
        print("No schools found. Creating a test school...")
        sch_create_resp = client.post("/api/schools", data={"name": "Test School", "code": "test-school", "country": "Nepal"}, headers=headers)
        if sch_create_resp.status_code != 201:
             print(f"Failed to create school: {sch_create_resp.text}")
             return
        target_school_id = sch_create_resp.json()["id"]
    else:
        target_school_id = schools[0]["id"]
    
    print(f"Target School ID: {target_school_id}")
    headers["X-School-ID"] = target_school_id

    # 2. Get Grades with Sections
    print("\n[2] Fetching Grades with Sections...")
    grades_resp = client.get("/api/academics/grades-with-sections", headers=headers)
    if grades_resp.status_code != 200:
        print(f"Failed to fetch grades: {grades_resp.text}")
        return
    
    grades = grades_resp.json()
    print(f"Found {len(grades)} grades.")
    
    target_grade_id = None
    target_section_id = None
    
    if grades:
        # Use the first grade that has sections
        for grade in grades:
            if grade["sections"]:
                target_grade_id = grade["id"]
                target_section_id = grade["sections"][0]["id"]
                print(f"Selected Grade: {grade['name']} ({target_grade_id})")
                print(f"Selected Section: {grade['sections'][0]['name']} ({target_section_id})")
                break
        
        # If no grade has sections, create one? For now just try to use first grade
        if not target_grade_id and grades:
             # Need to create a section or just note this
             print("Warning: Grades found but no sections available. Verification might fail.")
             target_grade_id = grades[0]["id"]
    else:
        print("No grades found. Creating seed data...")
        # Create Grade
        grade_resp = client.post("/api/academics/grades", json={"name": "Grade 1", "sequence": 1}, headers=headers)
        if grade_resp.status_code not in [200, 201]:
             print(f"Failed to create grade: {grade_resp.text}")
             return
        grade_data = grade_resp.json()
        target_grade_id = grade_data["id"]
        print(f"Created Grade: {grade_data['name']} ({target_grade_id})")

        # Create Section
        sec_resp = client.post("/api/academics/sections", json={"name": "Section A"}, headers=headers)
        if sec_resp.status_code not in [200, 201]:
             print(f"Failed to create section: {sec_resp.text}")
             # It might already exist?
             # return
        
        # If section exists (400), we probably need to fetch it? 
        # But we just got 0 grades, sections might exist without grades.
        # Let's just fetch all sections and pick one.
        all_secs = client.get("/api/academics/sections", headers=headers).json()
        if all_secs:
            target_section_id = all_secs[0]["id"]
            print(f"Using Section: {all_secs[0]['name']} ({target_section_id})")
        else:
             print("Failed to get/create section - check logs.")
             return

        # Link them
        link_resp = client.post(f"/api/academics/grades/{target_grade_id}/sections", json={"grade_id": target_grade_id, "section_id": target_section_id}, headers=headers)
        if link_resp.status_code == 200:
             print("Linked Grade and Section.")
        else:
             print(f"Failed to link: {link_resp.text}")

    if not target_section_id:
        # Retry finding section if we didn't just create it
        all_secs = client.get("/api/academics/sections", headers=headers).json()
        if all_secs:
             target_section_id = all_secs[0]["id"]
             
             # Ensure linked
             client.post(f"/api/academics/grades/{target_grade_id}/sections", json={"grade_id": target_grade_id, "section_id": target_section_id}, headers=headers)
        print("No section available to assign. Creating a section needs to be done via UI/API first.")
        # We could create one here, but let's see if we fail first.
        return

    # 3. Create User with Student Assignment
    print("\n[3] Creating new user with Student role and Assignment...")
    import uuid
    random_suffix = str(uuid.uuid4())[:8]
    email = f"student.{random_suffix}@test.com"
    
    user_payload = {
        "email": email,
        "first_name": "Test",
        "last_name": "Student",
        "password": "Password123!",
        "school_id": target_school_id,
        "roles": ["student"],
        "student_assignment": {
            "grade_id": target_grade_id,
            "section_id": target_section_id,
            "roll_number": "101"
        }
    }
    
    create_resp = client.post("/api/users", json=user_payload, headers=headers)
    
    if create_resp.status_code not in [200, 201]:
        print(f"Failed to create user: {create_resp.text}")
        return
    
    new_user = create_resp.json()
    user_id = new_user["id"]
    print(f"User created: {new_user['first_name']} {new_user['last_name']} (ID: {user_id})")

    # 4. Verify Student Record (Indirectly via Fetch or DB, but we can check if assignment endpoint returns current)
    # Actually, the endpoint is PATCH, so we can't GET assignment directly from a dedicated endpoint easily 
    # unless we check the user profile or student list.
    # Let's try to update the assignment to a different section/roll number.
    
    print("\n[4] Updating Student Assignment...")
    update_payload = {
        "grade_id": target_grade_id,
        "section_id": target_section_id, # Same for now, change roll number
        "roll_number": "102"
    }
    
    update_resp = client.patch(f"/api/students/{user_id}/assignment", json=update_payload, headers=headers)
    
    if update_resp.status_code != 200:
        print(f"Failed to update assignment: {update_resp.text}")
    else:
        print("Assignment updated successfully.")
        updated_data = update_resp.json()
        print(f"Updated Data: {updated_data}")
        
    print("\n=== Verification Complete ===")

if __name__ == "__main__":
    run_verification()
