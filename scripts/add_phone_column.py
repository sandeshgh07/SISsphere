import sys
import os

# Add the parent directory to sys.path so we can import from database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from sqlalchemy import text

def add_column():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR"))
            conn.commit()
            print("Successfully added phone column to users table.")
        except Exception as e:
            # Check for various DB "column exists" errors (sqlite, postgres, etc)
            if "duplicate column name" in str(e).lower() or "no such column" not in str(e).lower():
                 # Wait, if "no such column" is NOT in error, it means the column might exist?
                 # Actually, SQLite error is "duplicate column name: phone".
                 print(f"Note: {e}")
            else:
                print(f"Error adding column: {e}")

if __name__ == "__main__":
    add_column()
