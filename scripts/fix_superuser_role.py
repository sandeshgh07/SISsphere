
from database import SessionLocal
from schools.models import User
from auth.dependencies import Roles

def fix_superuser():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "admin@classa.com").first()
        if user:
            print(f"Found superuser: {user.email}, Role: {user.role}")
            if user.role != Roles.SUPER_USER:
                print(f"Updating role from {user.role} to {Roles.SUPER_USER}...")
                user.role = Roles.SUPER_USER
                db.commit()
                print("Role updated successfully.")
            else:
                print("Role is already correct.")
        else:
            print("Superuser not found in DB.")
            
    finally:
        db.close()

if __name__ == "__main__":
    fix_superuser()
