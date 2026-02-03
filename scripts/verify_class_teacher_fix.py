import requests
import sys

BASE_URL = "http://localhost:8000/api"

def verify():
    # Login as Super Admin to get token first
    login_payload = {
        "username": "owner@classa.com",
        "password": "mg8*54DV^Ctuc2rq"
    }
    try:
        res = requests.post(f"{BASE_URL}/auth/admin/login", json=login_payload)
        if res.status_code != 200:
            print(f"Login failed: {res.text}")
            return
        
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # We need a valid academic_year_id, grade_id, section_id.
        # But even with invalid IDs, it should return None (null) and 200 OK, not 500 error.
        # Unless the DB query fails? But filter().first() returns None if not found.
        # So we can test with dummy UUIDs.
        
        params = {
            "academic_year_id": "00000000-0000-0000-0000-000000000000",
            "grade_id": "00000000-0000-0000-0000-000000000000",
            "section_id": "00000000-0000-0000-0000-000000000000"
        }
        
        # We need to use school_id of the tenant though. Owner login might not set tenant context correctly without school_id header?
        # Actually owner login returns token. But TenantAccess depends on X-School-ID or user context?
        # TenantAccess usually derives from user if not super_admin?
        # For super_admin, we might need to specify school_id in header or query if the endpoint uses TenantAccess dependency.
        # TenantAccess logic: if header present use it, else if user has school_id use it.
        # Owner user usually has no school_id?
        # Let's try listing schools to get a valid school_id first.
        
        schools_res = requests.get(f"{BASE_URL}/schools", headers=headers)
        if schools_res.status_code == 200:
            schools = schools_res.json()
            if schools:
                school_id = schools[0]["id"]
                headers["X-School-ID"] = school_id
                print(f"Using School ID: {school_id}")
            else:
                print("No schools found")
        else:
            print(f"Failed to list schools: {schools_res.status_code}")

        res = requests.get(f"{BASE_URL}/academics/class-teachers", params=params, headers=headers)
        
        print(f"Status Code: {res.status_code}")
        print(f"Response: {res.text}")
        
        if res.status_code == 200 and (res.text == "null" or res.json() is None):
            print("✅ Fix Verified: Returned null correctly.")
        else:
            print("❌ Verification Failed")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify()
