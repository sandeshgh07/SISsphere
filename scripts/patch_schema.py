
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "dev.db")

def patch_db():
    print(f"Patching DB at {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. academic_years.is_closed
    try:
        cursor.execute("ALTER TABLE academic_years ADD COLUMN is_closed BOOLEAN DEFAULT 0")
        print("Fixed: academic_years.is_closed")
    except Exception as e:
        print(f"Skip academic_years.is_closed: {e}")

    # 2. audit_logs.school_id
    try:
        cursor.execute("ALTER TABLE audit_logs ADD COLUMN school_id VARCHAR")
        print("Fixed: audit_logs.school_id")
    except Exception as e:
        print(f"Skip audit_logs.school_id: {e}")

    # 3. subjects extensions
    try:
        cursor.execute("ALTER TABLE subjects ADD COLUMN grade_id VARCHAR")
        print("Fixed: subjects.grade_id")
    except Exception as e:
        print(f"Skip subjects.grade_id: {e}")
        
    try:
        cursor.execute("ALTER TABLE subjects ADD COLUMN is_elective BOOLEAN DEFAULT 0")
        print("Fixed: subjects.is_elective")
    except Exception as e:
        print(f"Skip subjects.is_elective: {e}")
        
    try:
        cursor.execute("ALTER TABLE subjects ADD COLUMN assigned_teacher_id VARCHAR")
        print("Fixed: subjects.assigned_teacher_id")
    except Exception as e:
        print(f"Skip subjects.assigned_teacher_id: {e}")

    conn.commit()
    conn.close()
    print("Patch complete.")

if __name__ == "__main__":
    patch_db()
