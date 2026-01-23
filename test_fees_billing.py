"""
Verification Script for Fees & Billing System
"""
import sys
import json
import random
from datetime import datetime
from fastapi.testclient import TestClient
from main import app

client = TestClient(app, raise_server_exceptions=True)

def log(msg):
    print(f"\n[TEST] {msg}")

def login_as_superuser():
    log("Logging in as Superuser...")
    res = client.post("/api/auth/admin/login", json={"username": "owner@classa.com", "password": "mg8*54DV^Ctuc2rq"})
    if res.status_code != 200:
        print(f"Login failed: {res.text}")
        sys.exit(1)
    return res.json()["access_token"]

def create_school(token):
    log("Creating Test School...")
    suffix = random.randint(1000, 9999)
    payload = {
        "school": {
            "name": f"Billing Test School {suffix}",
            "code": f"billing-school-{suffix}",
            "country": "Nepal",
            "is_active": True
        },
        "principal": {
            "first_name": "Principal",
            "last_name": "Test",
            "email": f"principal{suffix}@billing.test",
            "password": "Password123!"
        }
    }
    res = client.post("/api/schools/with-principal", json=payload, headers={"Authorization": f"Bearer {token}"})
    if res.status_code != 201:
        print(f"School creation failed: {res.text}")
        sys.exit(1)
    data = res.json()
    return data["school"]["id"], data["principal"]["id"] # Actually principal ID usually returned

def login_as_principal(email, password, school_id):
    log(f"Logging in as Principal ({email})...")
    res = client.post("/api/auth/login", json={"username": email, "password": password, "school_id": school_id})
    if res.status_code != 200:
        print(f"Principal login failed: {res.text}")
        sys.exit(1)
    return res.json()["access_token"]

def create_grade(token):
    log("Creating Grade...")
    res = client.post("/api/academics/grades", json={"name": "Grade 10", "sequence": 1}, headers={"Authorization": f"Bearer {token}"})
    if res.status_code != 200:
        print(f"Grade creation failed: {res.text}")
        sys.exit(1)
    return res.json()["id"]

def create_student(token, grade_id):
    log("Creating Student...")
    payload = {
        "first_name": "John",
        "last_name": "Doe",
        "email": f"student{random.randint(1000,9999)}@test.com",
        "grade_id": grade_id,
        "roll_no": f"R-{random.randint(100,999)}",
        "parent_phone": "9800000000",
        "dob": "2010-01-01",
        "gender": "male",
        "address": "Test Address"
    }
    res = client.post("/api/students", json=payload, headers={"Authorization": f"Bearer {token}"})
    if res.status_code != 200:
        print(f"Student creation failed: {res.text}")
        sys.exit(1)
    return res.json()["id"]

def run_test():
    # 1. Login Superuser
    su_token = login_as_superuser()
    
    # 2. Create School & Principal
    suffix = random.randint(10000, 99999)
    school_name = f"BillingTest{suffix}"
    principal_email = f"p{suffix}@test.com"
    
    # We can create school via superadmin endpoint or use existing.
    # Let's clean up: create a new one to ensure clean state.
    res = client.post("/api/schools/with-principal", 
        json={
            "school": {"name": school_name, "code": f"bt{suffix}", "country": "Nepal", "is_active": True},
            "principal": {"first_name": "P", "last_name": "Test", "email": principal_email, "password": "Password123!"}
        }, 
        headers={"Authorization": f"Bearer {su_token}"}
    )
    if res.status_code != 201:
        print(f"Create school failed: {res.text}")
        return
    school_id = res.json()["id"]
    log(f"School created: {school_id}")
    
    # 3. Login as Principal
    token = login_as_principal(principal_email, "Password123!", school_id)
    
    # 4. Create Grade
    grade_id = create_grade(token)
    log(f"Grade created: {grade_id}")
    
    # 5. Create Student
    student_id = create_student(token, grade_id)
    log(f"Student created: {student_id}")
    
    # 6. Create Fee Template (Monthly Tuition)
    log("Creating Fee Template...")
    fee_payload = {
        "title": "Monthly Tuition",
        "amount": 5000,
        "grade_id": grade_id,
        "billing_type": "RECURRING",
        "recurrence": "MONTHLY"
    }
    res = client.post("/api/fees/templates", json=fee_payload, headers={"Authorization": f"Bearer {token}"})
    if res.status_code != 200:
        print(f"Fee Template creation failed: {res.text}")
        sys.exit(1)
    template_id = res.json()["id"]
    log(f"Fee Template created: {template_id}")
    
    # 7. Create Discount (10% off for student)
    log("Creating Discount Rule...")
    discount_payload = {
        "title": "Scholarship",
        "discount_type": "PERCENT",
        "value": 10,
        "student_id": student_id,
        "applies_to_fee_template_id": template_id,
        "scope_type": "STUDENT_SPECIFIC"
    }
    res = client.post("/api/fees/discounts", json=discount_payload, headers={"Authorization": f"Bearer {token}"})
    if res.status_code != 200:
        print(f"Discount creation failed: {res.text}")
        sys.exit(1)
    log("Discount Rule created")
    
    # 8. Generate Invoices
    current_period = datetime.now().strftime("%Y-%m")
    log(f"Generating Invoices for period {current_period}...")
    res = client.post("/api/fees/invoices/generate", json={"period": current_period}, headers={"Authorization": f"Bearer {token}"})
    if res.status_code != 200:
        print(f"Invoice generation failed: {res.text}")
        sys.exit(1)
    
    print(f"Generation Result: {res.json()}")
    
    # 9. Verify Invoice
    log("Verifying Invoice...")
    res = client.get(f"/api/fees/invoices?student_id={student_id}&period={current_period}", headers={"Authorization": f"Bearer {token}"})
    invoices = res.json()
    if not invoices:
        print("ERROR: No invoice found for student")
        sys.exit(1)
    
    inv = invoices[0]
    print(f"Invoice ID: {inv['id']}")
    print(f"Total Due: {inv['total_due']}")
    print(f"Status: {inv['status']}")
    
    # Check amount: 5000 - 10% = 4500
    expected_due = 4500.0
    if float(inv['total_due']) == expected_due:
        log("SUCCESS: Invoice amount is correct (4500)!")
    else:
        log(f"FAILURE: Expected {expected_due}, got {inv['total_due']}")

    # 10. Test Idempotency (Run again)
    log("Testing Idempotency...")
    res = client.post("/api/fees/invoices/generate", json={"period": current_period}, headers={"Authorization": f"Bearer {token}"})
    if res.json()['invoices_created'] == 0:
        log("SUCCESS: Idempotency confirmed (0 new invoices)")
    else:
        log("FAILURE: Duplicate invoices created?")

if __name__ == "__main__":
    run_test()
