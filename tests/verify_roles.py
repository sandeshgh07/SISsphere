import requests
import json
import sys

BASE_URL = "http://localhost:8000/api"
HYBRID_EMAIL = "hybrid@nepsis.com"
PASSWORD = "nepsis123"

def run_test():
    print("🚀 Starting Role Verification Test...")

    # 1. Login
    print(f"🔑 Logging in as {HYBRID_EMAIL}...")
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"username": HYBRID_EMAIL, "password": PASSWORD})
        if resp.status_code != 200:
            print(f"❌ Login Failed: {resp.status_code} {resp.text}")
            sys.exit(1)

        data = resp.json()
        token = data["access_token"]
        available_roles = data.get("available_roles", [])

        print(f"✅ Login Success. Available Roles: {available_roles}")

        if "accountant" not in available_roles or "guardian" not in available_roles:
            print("❌ Roles missing from login response.")
            sys.exit(1)

    except Exception as e:
        print(f"❌ Exception during login: {e}")
        sys.exit(1)

    # 2. Test Access as ACCOUNTANT
    print("\n🕵️ Testing Access as ACCOUNTANT...")
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Active-Role": "accountant"
    }

    # Try /api/api/finance/fees (double prefix assumption based on code)
    url_double = f"http://localhost:8000/api/api/finance/fees"
    url_single = f"http://localhost:8000/api/finance/fees"

    target_url = url_double

    print(f"   Requesting {target_url} ...")
    resp = requests.post(target_url, json={}, headers=headers)
    print(f"   Response: {resp.status_code}")

    if resp.status_code == 404:
        print("   ⚠️ 404 on double prefix. Trying single prefix...")
        target_url = url_single
        resp = requests.post(target_url, json={}, headers=headers)
        print(f"   Response: {resp.status_code}")

    if resp.status_code == 403:
        print("❌ Failed: Accountant should have access (got 403).")
        sys.exit(1)
    elif resp.status_code == 422:
        print("✅ Success: Accountant reached endpoint (Validation Error means Auth passed).")
    elif resp.status_code == 200:
        print("✅ Success: Accountant reached endpoint (200 OK).")
    else:
        # 404 might still mean route not found if both URLs fail
        if resp.status_code == 404:
             print("❌ Failed: Endpoint not found (404). Check routing.")
             # We can't verify auth if we can't hit the endpoint.
             # Let's try /api/auth/me which requires superuser usually?
             # Or /api/users (requires Admin). Accountant shouldn't access /api/users?
             # Accountant in 'schools/router.py' -> require_roles(SUPER_ADMIN, PRINCIPAL, SCHOOL_ADMIN).
             # So Accountant should get 403 on /api/users.
             pass
        else:
             print(f"✅ Success: Accountant reached endpoint (Code {resp.status_code}).")

    # 3. Test Access as GUARDIAN (Should Fail)
    print("\n🕵️ Testing Access as GUARDIAN...")
    headers["X-Active-Role"] = "guardian"

    print(f"   Requesting {target_url} ...")
    resp = requests.post(target_url, json={}, headers=headers)
    print(f"   Response: {resp.status_code}")

    if resp.status_code == 403:
        print("✅ Success: Guardian was denied access.")
    else:
        print(f"❌ Failed: Guardian should be denied (got {resp.status_code}).")
        sys.exit(1)

    print("\n🎉 Verification Completed Successfully!")

if __name__ == "__main__":
    run_test()
