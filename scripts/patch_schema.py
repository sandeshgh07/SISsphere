
import sqlite3
import os

# Define path to DB
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'dev.db')

print(f"Patching database at: {DB_PATH}")

def table_has_column(cursor, table_name, column_name):
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [info[1] for info in cursor.fetchall()]
    return column_name in columns

def patch_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Patch Attendance
    print("Checking 'attendance' table...")
    try:
        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='attendance'")
        if not cursor.fetchone():
            print("Table 'attendance' does not exist. Skipping.")
        else:
            if not table_has_column(cursor, 'attendance', 'recorded_by_user_id'):
                print("Adding column 'recorded_by_user_id' to 'attendance'")
                cursor.execute("ALTER TABLE attendance ADD COLUMN recorded_by_user_id TEXT")
            
            if not table_has_column(cursor, 'attendance', 'note'):
                print("Adding column 'note' to 'attendance'")
                cursor.execute("ALTER TABLE attendance ADD COLUMN note TEXT")
                
            if not table_has_column(cursor, 'attendance', 'created_at'):
                print("Adding column 'created_at' to 'attendance'")
                cursor.execute("ALTER TABLE attendance ADD COLUMN created_at DATETIME")
                
            if not table_has_column(cursor, 'attendance', 'updated_at'):
                print("Adding column 'updated_at' to 'attendance'")
                cursor.execute("ALTER TABLE attendance ADD COLUMN updated_at DATETIME")
                
    except Exception as e:
        print(f"Error patching attendance: {e}")

    # 2. Patch Assessments
    print("Checking 'assessments' table...")
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='assessments'")
        if not cursor.fetchone():
            print("Table 'assessments' does not exist. Skipping.")
        else:
            if not table_has_column(cursor, 'assessments', 'description'):
                print("Adding column 'description' to 'assessments'")
                cursor.execute("ALTER TABLE assessments ADD COLUMN description TEXT")
                
            if not table_has_column(cursor, 'assessments', 'due_date'):
                print("Adding column 'due_date' to 'assessments'")
                cursor.execute("ALTER TABLE assessments ADD COLUMN due_date DATETIME")
                
            if not table_has_column(cursor, 'assessments', 'grade_id'):
                print("Adding column 'grade_id' to 'assessments'")
                cursor.execute("ALTER TABLE assessments ADD COLUMN grade_id TEXT")
                
            if not table_has_column(cursor, 'assessments', 'section_id'):
                print("Adding column 'section_id' to 'assessments'")
                cursor.execute("ALTER TABLE assessments ADD COLUMN section_id TEXT")
                
            if not table_has_column(cursor, 'assessments', 'created_by_user_id'):
                print("Adding column 'created_by_user_id' to 'assessments'")
                cursor.execute("ALTER TABLE assessments ADD COLUMN created_by_user_id TEXT")
                
            if not table_has_column(cursor, 'assessments', 'created_at'):
                print("Adding column 'created_at' to 'assessments'")
                cursor.execute("ALTER TABLE assessments ADD COLUMN created_at DATETIME")
                
            if not table_has_column(cursor, 'assessments', 'assessment_type_id'):
                print("Adding column 'assessment_type_id' to 'assessments'")
                cursor.execute("ALTER TABLE assessments ADD COLUMN assessment_type_id TEXT")

    except Exception as e:
        print(f"Error patching assessments: {e}")

    conn.commit()
    conn.close()
    print("Database patch completed.")

if __name__ == "__main__":
    patch_db()
