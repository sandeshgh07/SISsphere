from main import app
from fastapi.testclient import TestClient
from auth.jwt import create_access_token
from schools.models import User
from audit.models import AuditLog
from database import SessionLocal
import datetime
import uuid

def test_audit_pagination():
    client = TestClient(app)
    db = SessionLocal()
    
    # 1. Get Principal
    principal = db.query(User).filter(User.role == 'principal').first()
    if not principal:
        print("Skipping: No principal found")
        return

    # 2. Add dummy logs if needed (ensure there are at least 10)
    current_count = db.query(AuditLog).count()
    if current_count < 10:
        print("Seeding dummy logs...")
        for i in range(10 - current_count):
            db.add(AuditLog(
                id=str(uuid.uuid4()),
                action_type="TEST_LOG",
                table_name="test",
                actor_id=str(principal.id),
                timestamp=datetime.datetime.utcnow() - datetime.timedelta(minutes=i)
            ))
        db.commit()

    # 3. Get Access Token
    token = create_access_token(data={"sub": principal.email, "token_version": 1, "school_id": str(principal.school_id)})
    headers = {"Authorization": f"Bearer {token}"}
    
    # 4. Page 1 (limit=3)
    print("\n--- Fetching Page 1 (limit=3) ---")
    res1 = client.get("/api/audit-logs?limit=3", headers=headers)
    assert res1.status_code == 200
    data1 = res1.json()
    items1 = data1["items"]
    cursor1 = data1["next_cursor"]
    
    print(f"Page 1: {len(items1)} items")
    for item in items1:
        print(f" - {item['timestamp']} | {item['action_type']}")
        
    if not cursor1:
        print("No next cursor returned (not enough logs?)")
        return

    # 5. Page 2 (limit=3, cursor=...)
    print(f"\n--- Fetching Page 2 (limit=3, cursor={cursor1}) ---")
    res2 = client.get(f"/api/audit-logs?limit=3&cursor={cursor1}", headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()
    items2 = data2["items"]
    
    print(f"Page 2: {len(items2)} items")
    for item in items2:
        print(f" - {item['timestamp']} | {item['action_type']}")
        
    # Check no overlap
    ids1 = {i['id'] for i in items1}
    ids2 = {i['id'] for i in items2}
    intersection = ids1.intersection(ids2)
    
    if intersection:
        print(f"❌ FAILURE: Overlap found: {intersection}")
    else:
        print("✅ SUCCESS: No duplicates between pages.")
        
    db.close()

if __name__ == "__main__":
    test_audit_pagination()
