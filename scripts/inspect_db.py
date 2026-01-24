
import sqlite3
import pandas as pd
import os

db_path = "dev.db"
if not os.path.exists(db_path):
    print(f"{db_path} not found.")
    exit(1)

conn = sqlite3.connect(db_path)

print("=== LATEST USER ===")
try:
    users = pd.read_sql_query("SELECT id, email, role, school_id, created_at FROM users ORDER BY created_at DESC LIMIT 1", conn)
    print(users)
    latest_user_id = users.iloc[0]["id"]
except Exception as e:
    print(e)
    latest_user_id = None

print("\n=== LATEST STUDENT ===")
try:
    students = pd.read_sql_query("SELECT id, first_name, last_name, roll_number, school_id, user_id, created_at FROM students ORDER BY created_at DESC LIMIT 1", conn)
    print(students)
    if 'user_id' in students.columns and not students.empty:
        print("Student user_id value:", students.iloc[0]['user_id'])
except Exception as e:
    print(e)

if latest_user_id:
    print(f"\nChecking link for User ID: {latest_user_id}")
    try:
        match = pd.read_sql_query(f"SELECT * FROM students WHERE user_id = '{latest_user_id}'", conn)
        if not match.empty:
            print("Match found:")
            print(match)
        else:
            print("No student found with this user_id.")
            # Partial match check
            print("Checking LIKE match...")
            match_like = pd.read_sql_query(f"SELECT * FROM students WHERE user_id LIKE '%{latest_user_id}%'", conn)
            print(match_like)
            
    except Exception as e:
        print(e)

conn.close()
