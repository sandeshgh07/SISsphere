import sys
import os
import requests
import json
from datetime import datetime

# Set up path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Config
BASE_URL = "http://localhost:8000"
API_PREFIX = "/api"

def login_as_admin():
    # Attempt to login with known admin credentials or creation if needed
    # Assuming test admin exists from previous context or using default "admin@example.com"
    # Actually, let's try to verify with an existing token if possible or login.
    # For now, we'll try a standard test login.
    login_data = {
        "username": "admin@example.com",
        "password": "password123"
    }
    # Check if we can login
    try:
        response = requests.post(f"{BASE_URL}{API_PREFIX}/auth/token", data=login_data)
        if response.status_code == 200:
            print("Login successful")
            return response.json()["access_token"]
        else:
            print(f"Login failed: {response.text}")
            return None
    except Exception as e:
        print(f"Connection failed: {e}")
        return None

def verify_assignment():
    token = login_as_admin()
    if not token:
        print("Skipping verification due to login failure (server might be down or creds wrong)")
        return

    headers = {"Authorization": f"Bearer {token}"}

    # 1. List students with query
    print("Testing student search...")
    res = requests.get(f"{BASE_URL}{API_PREFIX}/students?q=a", headers=headers) # Search for 'a'
    if res.status_code == 200:
        students = res.json()
        print(f"Search found {len(students)} students")
        target_student = students[0] if students else None
    else:
        print(f"Search failed: {res.text}")
        target_student = None

    if not target_student:
        print("No students found to test assignment. Creating one?")
        # Skip for now, assuming students exist
        return

    # 2. Get a parent user
    print("Fetching users (parents)...")
    res = requests.get(f"{BASE_URL}{API_PREFIX}/users?role=parent", headers=headers)
    target_parent = None
    if res.status_code == 200:
        parents = res.json()
        if parents:
            target_parent = parents[0]
            print(f"Found parent: {target_parent['full_name']} ({target_parent['email']})")
        else:
            print("No parents found.")
    else:
        print("Failed to list users")

    if not target_parent:
        return

    # 3. Assign student to parent
    print(f"Assigning student {target_student['id']} to parent {target_parent['id']}...")
    payload = {"student_ids": [target_student['id']]}
    res = requests.put(f"{BASE_URL}{API_PREFIX}/students/parents/{target_parent['id']}/students", json=payload, headers=headers)
    
    if res.status_code == 200:
        print("Assignment successful!")
    else:
        print(f"Assignment failed: {res.text}")
        return

    # 4. Verify assignment
    print("Verifying assignment...")
    res = requests.get(f"{BASE_URL}{API_PREFIX}/students/parents/{target_parent['id']}/students", headers=headers)
    if res.status_code == 200:
        assigned = res.json()
        assigned_ids = [s['id'] for s in assigned]
        if target_student['id'] in assigned_ids:
            print("Verification PASSED: Student is assigned.")
        else:
            print(f"Verification FAILED: Student not found in assigned list. Got: {assigned_ids}")
    else:
        print(f"Failed to fetch assigned students: {res.text}")

if __name__ == "__main__":
    verify_assignment()
