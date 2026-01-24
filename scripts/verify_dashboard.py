
import json
import urllib.request
import urllib.parse
import urllib.error

API_URL = "http://localhost:8000"

def get_student_token():
    url = f"{API_URL}/api/token"
    payload = {
        "username": "student@stmarys.edu",
        "password": "student123"
    }
    data = urllib.parse.urlencode(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, method='POST')
    
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result["access_token"]
    except urllib.error.HTTPError as e:
        print(f"Login failed: {e.code} {e.read().decode('utf-8')}")
        return None
    except Exception as e:
        print(f"Login error: {e}")
        return None

def test_dashboard_overview():
    token = get_student_token()
    if not token:
        print("Skipping test due to login failure.")
        return

    url = f"{API_URL}/api/students/overview"
    req = urllib.request.Request(url, method='GET')
    req.add_header('Authorization', f'Bearer {token}')
    
    print("\n=== Testing GET /api/students/overview ===")
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            print("SUCCESS: Retrieved Dashboard Overview")
            print(f"Student: {data.get('student', {}).get('name')}")
            print(f"Attendance Last 30 Days: {data.get('attendance', {}).get('last30')}")
            print(f"Due Fees: {data.get('fees', {}).get('dueAmount')}")
            print(f"Critical Notices: {len(data.get('notices', {}).get('critical', []))}")
            print(f"Open Complaints: {data.get('complaints', {}).get('openCount')}")
    except urllib.error.HTTPError as e:
        print(f"FAILED: {e.code}")
        print(e.read().decode('utf-8'))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_dashboard_overview()
