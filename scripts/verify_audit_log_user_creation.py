import requests
import sys
import uuid
import time

BASE_URL = "http://localhost:8000/api"

def verify():
    # Login as Owner first to get valid school
    owner_creds = {
        "username": "owner@classa.com",
        "password": "mg8*54DV^Ctuc2rq"
    }
    
    try:
        # 1. Login as Owner
        res = requests.post(f"{BASE_URL}/auth/admin/login", json=owner_creds)
        if res.status_code != 200:
            print(f"Login failed: {res.text}")
            return
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get School ID
        schools_res = requests.get(f"{BASE_URL}/schools", headers=headers)
        if not schools_res.json():
            print("No schools found")
            return
        school_id = schools_res.json()[0]["id"]
        headers["X-School-ID"] = school_id
        
        # 2. Create a User (Teacher)
        new_email = f"testuser_{uuid.uuid4().hex[:6]}@example.com"
        user_payload = {
            "email": new_email,
            "first_name": "Test",
            "last_name": "User",
            "password": "password123",
            "role": "teacher",
            "school_id": school_id
        }
        res = requests.post(f"{BASE_URL}/users", json=user_payload, headers=headers)
        if res.status_code != 201:
            print(f"Failed to create user: {res.text}")
            return
        
        user_id = res.json()["id"]
        print(f"User Created: {user_id}")
        
        # 3. Check Audit Logs
        # Wait a moment for async DB operations if any (though synchronous here)
        time.sleep(1)
        
        res = requests.get(f"{BASE_URL}/audit-logs", headers=headers)
        if res.status_code != 200:
            print(f"Failed to fetch audit logs: {res.text}")
            return
            
        response_data = res.json()
        logs = response_data.get("items", [])
        
        # Look for the creation log for this user
        found = False
        for log in logs:
            if log["record_id"] == user_id and log["table_name"] == "users" and log["action_type"] == "INSERT":
                print("✅ Found explicit/automatic creation log:")
                print(log)
                found = True
                break
            # Also check for "User Creation" reason (explicit log)
            if log["reason"] == "User Creation" and log["record_id"] == user_id:
                print("✅ Found explicit creation log by reason:")
                print(log)
                found = True
                break
        
        if not found:
            print("❌ Audit log for user creation NOT found.")
            # Print top 3 logs
            print("Top 3 logs:")
            for l in logs[:3]:
                print(l)
        else:
            print("Verified successfully.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify()
