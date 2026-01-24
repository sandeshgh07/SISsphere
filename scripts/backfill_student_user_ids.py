
import sqlite3
import os
import uuid

db_path = "dev.db"
if not os.path.exists(db_path):
    print(f"{db_path} not found.")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("=== BACKFILLING STUDENT USER IDs ===")

# Get all users (id, email)
cursor.execute("SELECT id, email FROM users")
users = cursor.fetchall()

count = 0
for u_id_raw, email in users:
    if not email:
        continue
        
    # Convert raw ID to dashed UUID string if it's hex
    try:
        # Check if it looks like a hex string (32 chars)
        if len(str(u_id_raw)) == 32:
            u_uuid = uuid.UUID(str(u_id_raw))
            user_id_formatted = str(u_uuid)
        else:
            # Assume it's already formatted or we take it as is
            user_id_formatted = str(u_id_raw)
    except Exception as e:
        print(f"Error parsing user ID {u_id_raw} for {email}: {e}")
        continue

    # Update student record with matching email and empty user_id
    # We update ONLY if user_id is NULL to avoid overwriting (though overwriting might be safe if mismatched)
    # Let's target NULLs first.
    
    # Check if student exists
    cursor.execute("SELECT id FROM students WHERE email = ?", (email,))
    student_rows = cursor.fetchall()
    
    if student_rows:
        print(f"Linking User {email} (ID: {user_id_formatted}) to {len(student_rows)} student records...")
        cursor.execute(
            "UPDATE students SET user_id = ? WHERE email = ? AND (user_id IS NULL OR user_id = '')",
            (user_id_formatted, email)
        )
        if cursor.rowcount > 0:
            count += cursor.rowcount
            print(f"  -> Updated {cursor.rowcount} records.")

conn.commit()
print(f"=== BACKFILL COMPLETE. Updated {count} student records. ===")
conn.close()
