from database import SessionLocal
from students.models import Student
from schools.models import School

db = SessionLocal()
students = db.query(Student).all()
print(f"Total Students: {len(students)}")
if students:
    print(f"Sample Student School ID: {students[0].school_id} (Type: {type(students[0].school_id)})")

schools = db.query(School).all()
print(f"Total Schools: {len(schools)}")
if schools:
    print(f"Sample School ID: {schools[0].id} (Type: {type(schools[0].id)})")
db.close()
