
import sqlite3
import os

# Check common DB names
db_files = ["dev.db", "sis.db", "classa.db"]
target_db = None

for db in db_files:
    if os.path.exists(db):
        target_db = db
        break

if not target_db:
    print("No database file found.")
    exit(1)

print(f"Targeting database: {target_db}")

conn = sqlite3.connect(target_db)
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE students ADD COLUMN user_id TEXT;")
    conn.commit()
    print("Successfully added user_id column to students table.")
except Exception as e:
    print(f"Error (maybe column exists?): {e}")

conn.close()
