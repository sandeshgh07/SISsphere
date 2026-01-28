import sys
import os
from sqlalchemy import text, inspect

# Add root to custom path to allow imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine, Base
import academics.models  # Import models to register them

def run_migrations():
    print("Running Migrations...")
    
    # 1. Create new tables
    print("Creating new tables via SQLAlchemy...")
    Base.metadata.create_all(bind=engine)
    
    # 2. Add column to existing table if missing
    inspector = inspect(engine)
    columns = [c['name'] for c in inspector.get_columns("section_subject_timetables")]
    
    if "grade_subject_id" not in columns:
        print("Adding 'grade_subject_id' to 'section_subject_timetables'...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE section_subject_timetables ADD COLUMN grade_subject_id VARCHAR"))
            conn.commit()
        print("Column added.")
    else:
        print("'grade_subject_id' already exists.")

    print("Migration Complete.")

if __name__ == "__main__":
    run_migrations()
