import sys
import os
import requests

# Add root to sys.path
sys.path.append(os.getcwd())

API_URL = "http://localhost:8000/api"

def test_board_api():
    # 1. Create a fresh school and seed data
    from scripts.create_verified_school import create_verified_school
    creds = create_verified_school()
    if not creds:
        print("Failed to create school")
        return

    # 2. Login
    login_resp = requests.post(f"{API_URL}/auth/login", json={
        "username": creds["email"],
        "password": creds["password"]
    })

    if login_resp.status_code != 200:
        print(f"Login failed: {login_resp.text}")
        return

    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Check Financial Velocity (Triple Pulse)
    print("Testing /board/financial-velocity...")
    resp = requests.get(f"{API_URL}/board/financial-velocity", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        print("Success!")
        print("Triple Pulse Keys:", data.get("triple_pulse", {}).keys())
        # Verify seeded data presence (approx)
        # We seeded 1500, 2300, 1800
        # Check today
        # Note: FinanceAnalyticsService.get_triple_day_snapshot returns a flat dictionary:
        # { "today": float, "yesterday": float, "day_minus_2": float, "percent_change": float }
        # NOT nested with "metrics".

        today_val = data["triple_pulse"]["today"]
        print(f"Today Revenue: {today_val}")
        if today_val > 0:
            print("Verified: Today's revenue > 0")
        else:
            print("Warning: Today's revenue is 0")
    else:
        print(f"Failed: {resp.status_code} {resp.text}")

    # 4. Check Board Analytics (KPIs)
    print("\nTesting /board/analytics...")
    resp = requests.get(f"{API_URL}/board/analytics", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        print("Success!")
        print(f"Analytics Data: {data}")
        # Expect enrollment > 0 (we added students)
        if data["total_enrollment"] > 0:
            print("Verified: Enrollment > 0")
        else:
            print("Warning: Enrollment is 0")
    else:
        print(f"Failed: {resp.status_code} {resp.text}")

if __name__ == "__main__":
    test_board_api()
