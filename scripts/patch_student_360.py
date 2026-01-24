
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'dev.db')

print(f"Migrating Student 360 tables for: {DB_PATH}")

def run_migration():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Behavior Incidents
    print("Creating 'behavior_incidents' table...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS behavior_incidents (
        id VARCHAR PRIMARY KEY,
        school_id VARCHAR NOT NULL,
        student_id VARCHAR NOT NULL,
        reported_by_user_id VARCHAR NOT NULL,
        incident_type VARCHAR NOT NULL,
        severity VARCHAR NOT NULL,
        title VARCHAR NOT NULL,
        description VARCHAR,
        occurred_at DATETIME,
        action_taken VARCHAR,
        status VARCHAR DEFAULT 'open',
        created_at DATETIME,
        updated_at DATETIME,
        FOREIGN KEY(school_id) REFERENCES schools(id),
        FOREIGN KEY(student_id) REFERENCES students(id),
        FOREIGN KEY(reported_by_user_id) REFERENCES users(id)
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_behavior_school_student ON behavior_incidents (school_id, student_id)")

    # 2. Student Documents
    print("Creating 'student_documents' table...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_documents (
        id VARCHAR PRIMARY KEY,
        school_id VARCHAR NOT NULL,
        student_id VARCHAR NOT NULL,
        uploaded_by_user_id VARCHAR NOT NULL,
        doc_type VARCHAR NOT NULL,
        title VARCHAR NOT NULL,
        file_path VARCHAR NOT NULL,
        mime_type VARCHAR NOT NULL,
        size_bytes INTEGER DEFAULT 0,
        created_at DATETIME,
        FOREIGN KEY(school_id) REFERENCES schools(id),
        FOREIGN KEY(student_id) REFERENCES students(id),
        FOREIGN KEY(uploaded_by_user_id) REFERENCES users(id)
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_docs_school_student ON student_documents (school_id, student_id)")

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    run_migration()
