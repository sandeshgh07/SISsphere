
import sqlite3
import pandas as pd
import os

db_path = "dev.db"
if not os.path.exists(db_path):
    print(f"{db_path} not found.")
    exit(1)

conn = sqlite3.connect(db_path)

print("=== CHECKING FOR UNLINKED STUDENTS ===")
try:
    # Students with NULL user_id
    unlinked_students = pd.read_sql_query("SELECT id, first_name, email, user_id FROM students WHERE user_id IS NULL OR user_id = ''", conn)
    print(f"Found {len(unlinked_students)} unlinked students.")
    print(unlinked_students.head())
    
    if not unlinked_students.empty:
        print("\n=== CHECKING FOR MATCHING USERS ===")
        emails = unlinked_students['email'].tolist()
        placeholders = ','.join(['?'] * len(emails))
        users = pd.read_sql_query(f"SELECT id, email FROM users WHERE email IN ({placeholders})", conn, params=emails)
        print(f"Found {len(users)} matching users by email.")
        print(users.head())
        
except Exception as e:
    print(e)

conn.close()
