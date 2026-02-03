import requests
import sys
import uuid

BASE_URL = "http://localhost:8000/api"

def verify():
    # Login as Owner to create school context
    owner_creds = {
        "username": "owner@classa.com",
        "password": "mg8*54DV^Ctuc2rq"
    }
    
    try:
        # 1. Login
        res = requests.post(f"{BASE_URL}/auth/admin/login", json=owner_creds)
        if res.status_code != 200:
            print(f"Login failed: {res.text}")
            return
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get a school ID
        schools_res = requests.get(f"{BASE_URL}/schools", headers=headers)
        if schools_res.status_code != 200 or not schools_res.json():
            print("No schools found")
            return
            
        school_id = schools_res.json()[0]["id"]
        headers["X-School-ID"] = school_id
        
        # 2. Create Complaint
        complaint_payload = {
            "title": f"Test Complaint {uuid.uuid4().hex[:6]}",
            "description": "Initial description",
            "category": "student",
            "severity": "low"
        }
        res = requests.post(f"{BASE_URL}/complaints", json=complaint_payload, headers=headers)
        if res.status_code != 200:
            print(f"Failed to create complaint: {res.text}")
            return
        
        complaint_id = res.json()["id"]
        print(f"Complaint Created: {complaint_id}")
        
        # 3. Post Message (This was failing)
        msg_payload = {
            "content": "Follow up message testing UUID fix",
            "is_internal": False
        }
        res = requests.post(f"{BASE_URL}/complaints/{complaint_id}/messages", json=msg_payload, headers=headers)
        
        print(f"Post Message Status: {res.status_code}")
        if res.status_code == 200:
            print("✅ Message Posted Successfully")
            print(res.json())
        else:
            print(f"❌ Failed to post message: {res.text}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify()
