from sqlalchemy import create_engine, MetaData, Table, text
import os

# Use absolute path to ensure consistency regardless of execution context
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Construct path relative to script location (assuming script is in /scripts)
DB_PATH = os.path.join(os.path.dirname(BASE_DIR), 'dev.db')
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

def recreate_table():
    print(f"Connecting to database: {DATABASE_URL}")
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        print("Dropping 'complaints' table...")
        # Drop constraint tables first if they depend on complaints
        try:
            conn.execute(text("DROP TABLE IF EXISTS complaint_participants"))
            conn.execute(text("DROP TABLE IF EXISTS complaint_messages"))
            conn.execute(text("DROP TABLE IF EXISTS complaints"))
            conn.execute(text("DROP TABLE IF EXISTS audit_logs")) # Added audit_logs
            conn.commit()
            print("Tables dropped successfully.")
        except Exception as e:
            print(f"Error dropping tables: {e}")

if __name__ == "__main__":
    recreate_table()
