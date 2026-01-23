"""
Debug script to test the create_school_with_principal endpoint
and capture the exact Pydantic validation error.
"""
import sys
sys.path.insert(0, "/Users/sandeshghimire/ai-sandbox/repos/jules_sis")

from fastapi.testclient import TestClient
from main import app
import json

client = TestClient(app, raise_server_exceptions=False)

# Login using env-based superuser credentials
print("=== Step 1: Login as Platform Superuser (owner@classa.com) ===")
login_response = client.post(
    "/api/auth/admin/login",
    json={
        "username": "owner@classa.com",
        "password": "mg8*54DV^Ctuc2rq"
    }
)
print(f"Login Status: {login_response.status_code}")
if login_response.status_code != 200:
    print(f"Login Response: {login_response.text}")
    sys.exit(1)

token_data = login_response.json()
access_token = token_data.get("access_token")
print(f"Got access token: {access_token[:20]}...")

# Now, try to create a school
print("\n=== Step 2: Create School with Principal ===")
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

# Payload that matches what the frontend sends
payload = {
    "school": {
        "name": "Test School Debug",
        "code": "test-school-debug",
        "country": "Nepal",
        "is_active": True
    },
    "principal": {
        "first_name": "Test",
        "last_name": "Admin",
        "email": "test.admin@testschool.debug",
        "password": "Password123!"
    }
}

print(f"Payload: {json.dumps(payload, indent=2)}")

response = client.post(
    "/api/schools/with-principal?role=super_admin",
    json=payload,
    headers=headers
)

print(f"\nResponse Status: {response.status_code}")
print(f"Response Body: {response.text}")

if response.status_code == 422:
    print("\n=== VALIDATION ERROR DETAILS ===")
    try:
        error_detail = response.json()
        print(json.dumps(error_detail, indent=2))
    except:
        print(response.text)
elif response.status_code == 201:
    print("\n=== SUCCESS! School created ===")
    print(json.dumps(response.json(), indent=2))
