import requests
import json
import sys

BASE_URL = "http://localhost:8000/api"
EMAIL = "principal@stmarys.com"  # Adjust as needed for dev env
PASSWORD = "password123"

def login():
    try:
        resp = requests.post(f"{BASE_URL}/auth/token", data={"username": EMAIL, "password": PASSWORD})
        resp.raise_for_status()
        return resp.json()["access_token"]
    except Exception as e:
        print(f"Login failed: {e}")
        sys.exit(1)

def main():
    token = login()
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n--- 1. Creating Discount Rule ---")
    data = {
        "title": "Test Scholarship 2026",
        "discount_type": "PERCENT",
        "value": 15,
        "scope_type": "ALL_STUDENTS",
        "is_active": True,
        "start_date": "2026-01-01",
        "end_date": "2026-12-31"
    }
    
    resp = requests.post(f"{BASE_URL}/financials/discount-rules", json=data, headers=headers)
    if resp.status_code == 200:
        rule = resp.json()
        print(f"✅ Created Rule: {rule['id']} - {rule['title']}")
    else:
        print(f"❌ Failed to create rule: {resp.text}")
        sys.exit(1)
        
    rule_id = rule['id']

    print("\n--- 2. Toggling Rule ---")
    resp = requests.post(f"{BASE_URL}/financials/discount-rules/{rule_id}/toggle", headers=headers)
    if resp.status_code == 200:
        print(f"✅ Toggled Rule active state to: {resp.json()['is_active']}")
    else:
        print(f"❌ Failed to toggle rule: {resp.text}")

    print("\n--- 3. Triggering Invoice Generation (Dry Run or Real) ---")
    # Assuming period is current month
    period = "2026-01"
    resp = requests.post(f"{BASE_URL}/fees/invoices/generate", json={"period": period}, headers=headers)
    if resp.status_code == 200:
        print(f"✅ Generated Invoices: {resp.json()}")
    else:
        print(f"⚠️ Failed to generate invoices (might be normal if no students): {resp.text}")

    print("\n--- 4. Deleting Rule ---")
    resp = requests.delete(f"{BASE_URL}/financials/discount-rules/{rule_id}", headers=headers)
    if resp.status_code == 200:
        print("✅ Rule deleted")
    else:
        print(f"❌ Failed to delete rule: {resp.text}")

if __name__ == "__main__":
    main()
