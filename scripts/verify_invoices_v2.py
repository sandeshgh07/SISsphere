
import urllib.request
import urllib.parse
import json
import sys
from datetime import datetime

BASE_URL = "http://localhost:8000"

def request(method, url, data=None, headers=None):
    if headers is None:
        headers = {}
    if data:
        data = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
        
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode('utf-8')
            return response.status, json.loads(res_body)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')
    except Exception as e:
        return 0, str(e)

def get_token(email="principal@stmarys.edu", password="principal123"):
    url = f"{BASE_URL}/api/auth/login"
    # Using fetched school_id for St. Mary's (with hyphens)
    data = {"username": email, "password": password, "school_id": "1aa34625-ae99-4427-ad7f-5d365fd0a1b0"}
    
    status, res = request("POST", url, data)
    
    if status != 200:
        print(f"Login failed ({status}): {res}")
        sys.exit(1)
        
    return res["access_token"]

def verify_invoice_flow():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    print("Logged in successfully.")
    
    print("\n1. Testing Generator Preview...")
    period = datetime.now().strftime("%Y-%m")
    status, res = request("POST", f"{BASE_URL}/api/fees/invoices/generator/preview", 
        {"period": period, "conflict_rule": "SKIP"}, headers)
    
    if status != 200:
        # If no students, this might return success but empty.
        print(f"Preview Failed: {res}")
    else:
        print(f"Preview Success: {json.dumps(res, indent=2)}")

    print("\n2. Testing Generator Run...")
    status, run_res = request("POST", f"{BASE_URL}/api/fees/invoices/generator/run", 
        {"period": period, "conflict_rule": "SKIP"}, headers)
        
    if status != 200:
        print(f"Run Failed: {run_res}")
        return
    print(f"Run Success: {json.dumps(run_res, indent=2)}")
    
    # 3. List
    print("\n3. Listing Invoices...")
    status, invoices = request("GET", f"{BASE_URL}/api/fees/invoices", headers=headers)
    if status != 200:
        print(f"List Failed: {invoices}")
        return
        
    if not invoices:
        print("No invoices found! The generator might not have found any students or fee templates.")
        return
    
    total = len(invoices)
    print(f"Found {total} invoices.")
    inv_id = invoices[0]['id']
    print(f"Testing with invoice ID: {inv_id} (Status: {invoices[0]['status']})")
    
    # 4. Issue
    if invoices[0]['status'] == 'DRAFT':
        print("\n4. Issuing Invoice...")
        status, issue_res = request("POST", f"{BASE_URL}/api/fees/invoices/{inv_id}/issue", headers=headers)
        if status == 200:
            print("Issued Successfully")
        else:
            print(f"Issue Failed: {issue_res}")
    else:
        print("\n4. Skipping Issue (Not Draft)")

    # 5. Record Payment
    print("\n5. Recording Payment (100 NPR)...")
    status, pay_res = request("POST", f"{BASE_URL}/api/fees/invoices/{inv_id}/payments", 
        {"amount": 100, "method": "CASH", "notes": "Test"}, headers)
        
    if status == 200:
        print(f"Payment Recorded: {pay_res}")
    else:
        print(f"Payment Failed: {pay_res}")
        
    # 6. Void
    print("\n6. Voiding Invoice...")
    status, void_res = request("POST", f"{BASE_URL}/api/fees/invoices/{inv_id}/void", 
        {"reason": "Testing Void"}, headers)
        
    if status == 200:
         print(f"Void Success: {void_res}")
    else:
         print(f"Void Failed: {void_res}")

    print("\n7. End of automated verification.")

if __name__ == "__main__":
    verify_invoice_flow()
