
from database import engine, Base
from finance.models import StudentDiscountAssociation

def migrate():
    print("Creating tables...")
    # This safely creates only missing tables
    Base.metadata.create_all(bind=engine)
    print("Migration complete. 'student_discount_associations' table created.")

if __name__ == "__main__":
    migrate()
