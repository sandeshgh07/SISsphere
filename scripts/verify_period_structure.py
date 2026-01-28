
import requests
import json
from datetime import date, timedelta
import uuid

BASE_URL = "http://localhost:8000"

# Mock login to get token (adjust based on your auth setup, assuming dev bypass or similar for testing, 
# or I will assume I have a valid token mechanism. For now, I'll try to use a known user or skip if auth is disabled in dev)
# Since I can't easily interactive login, I'll fetch the token from a known endpoint or assume the user has one.
# Wait, I don't have a token. I'll need to login first.

def login():
    try:
        # Assuming there is a seed user or I can create one. 
        # I'll try a standard admin login often found in these setups
        resp = requests.post(f"{BASE_URL}/api/auth/login", data={"username": "principal@example.com", "password": "password123"})
        if resp.status_code == 200:
            return resp.json()["access_token"]
        print("Login failed, trying superadmin")
        resp = requests.post(f"{BASE_URL}/api/auth/login", data={"username": "superadmin@jules.app", "password": "password123"})
        if resp.status_code == 200:
            return resp.json()["access_token"]
    except:
        pass
    return None

def run_tests():
    token = login()
    if not token:
        print("SKIPPING AUTH TEST (No token)")
        # If I can't login, I can't test. I'll just print this and stop.
    
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    
    print("--- 1. Testing Template Creation ---")
    template_data = {
        "name": "Test Template 7 Periods",
        "structure": [
            {"label": "P1", "start": "09:00", "end": "09:45", "type": "CLASS"},
            {"label": "Break", "start": "09:45", "end": "10:00", "type": "BREAK"},
            {"label": "P2", "start": "10:00", "end": "10:45", "type": "CLASS"}
        ]
    }
    resp = requests.post(f"{BASE_URL}/api/academics/schedule-templates", json=template_data, headers=headers)
    if resp.status_code == 200:
        tpl = resp.json()
        print(f"SUCCESS: Created template {tpl['id']}")
        tpl_id = tpl['id']
    else:
        print(f"FAILED: {resp.text}")
        return

    print("\n--- 2. Testing Weekly Rules ---")
    weekly_data = {
        "day_rules": {
            "Monday": tpl_id,
            "Tuesday": tpl_id,
            "Wednesday": tpl_id,
            "Thursday": tpl_id,
            "Friday": tpl_id
        }
    }
    resp = requests.post(f"{BASE_URL}/api/academics/schedule-weekly-rules", json=weekly_data, headers=headers)
    if resp.status_code == 200:
        print("SUCCESS: Updated weekly rules")
    else:
        print(f"FAILED: {resp.text}")

    print("\n--- 3. Testing Overrides ---")
    today = date.today().isoformat()
    override_data = {
        "name": "Test Override",
        "start_date": today,
        "end_date": today,
        "target_grade_ids": [], # Whole school
        "rule_config": {
            "days": [date.today().strftime("%A")],
            "template_id": tpl_id
        }
    }
    resp = requests.post(f"{BASE_URL}/api/academics/schedule-overrides", json=override_data, headers=headers)
    if resp.status_code == 200:
        ov = resp.json()
        print(f"SUCCESS: Created override {ov['id']}")
    else:
        print(f"FAILED: {resp.text}")

    print("\n--- 4. Testing Preview ---")
    preview_data = {
        "date": today,
        "grade_id": None
    }
    resp = requests.post(f"{BASE_URL}/api/academics/schedule/preview", json=preview_data, headers=headers)
    if resp.status_code == 200:
        res = resp.json()
        print(f"SUCCESS: Preview result -> Template: {res['template_name']}, Source: {res['source']}")
    else:
        print(f"FAILED: {resp.text}")

if __name__ == "__main__":
    run_tests()
