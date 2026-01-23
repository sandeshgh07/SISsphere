
import sys
import os
import random
from datetime import datetime, timedelta, timezone

# Add parent directory to path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database import SessionLocal, engine
from students.models import Student
from attendance.models import Attendance, AttendanceStatus
from academics.models import MarksEntry, ExamTerm, Subject, Grade, Section

def seed_analytics(db: Session, school_id: str):
    print(f"Seeding analytics data for school: {school_id}")
    
    # 1. Fetch Students
    students = db.query(Student).filter(Student.school_id == school_id).all()
    if not students:
        print("No students found. Skipping.")
        return

    print(f"Found {len(students)} students.")
    
    # 2. Date Range (Last 180 Days)
    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=180)
    
    # 3. Attendance Seeding
    print("Seeding attendance...")
    attendance_records = []
    
    # Optimization: Check if attendance already exists to avoid dupes/slow writes
    # For simplicity in this script, we just append new ones. 
    # In a real scenario, we might want to be more careful.
    
    for day_offset in range(181):
        current_date = start_date + timedelta(days=day_offset)
        # Skip weekends
        if current_date.weekday() >= 5:
            continue
            
        for student in students:
            # 92% chance of being present, slightly randomized per student to create "at risk" logic
            base_rate = 0.92
            if hash(student.id) % 10 == 0: # Every 10th student is "at risk"
                base_rate = 0.70
                
            status = AttendanceStatus.PRESENT if random.random() < base_rate else AttendanceStatus.ABSENT
             
            # Ensure student has grade/section (skip if not)
            if not student.grade_id or not student.section_id:
                continue

            attendance_records.append(Attendance(
                student_id=student.id,
                grade_id=student.grade_id,
                section_id=student.section_id,
                school_id=school_id,
                date=current_date,
                status=status
            ))
            
    # Bulk save attendance
    db.bulk_save_objects(attendance_records)
    print(f"Inserted {len(attendance_records)} attendance records.")

    # 4. Academic Seeding (Assignments/Marks)
    # Ensure there is an Exam Term
    term = db.query(ExamTerm).filter(ExamTerm.school_id == school_id).first()
    if not term:
        term = ExamTerm(name="Fall 2023", school_id=school_id, start_date=start_date)
        db.add(term)
        db.commit()
        db.refresh(term)
        
    print("Seeding grades...")
    # Get subjects
    subjects = db.query(Subject).filter(Subject.school_id == school_id).all()
    if not subjects:
        # Create some if none
        subjects = [
            Subject(name="Mathematics", code="MATH101", school_id=school_id),
            Subject(name="Science", code="SCI101", school_id=school_id),
            Subject(name="English", code="ENG101", school_id=school_id),
            Subject(name="History", code="HIST101", school_id=school_id),
        ]
        db.add_all(subjects)
        db.commit()
    
    marks_entries = []
    
    # For every student, add marks for 5 assignments per subject
    for subject in subjects:
        # Create dummy assignments (not strictly needed for MarksEntry but good for completeness if tables linked)
        # We will skip assignment table creation to keep script simple and focus on MarksEntry which drives analytics
        
        for student in students:
            # Determine student ability
            ability = 0.85 # Average B student
            if hash(student.id) % 10 == 0: ability = 0.55 # Struggling
            if hash(student.id) % 7 == 0: ability = 0.95 # Top performer
            
            # Generate one aggregated score for the term
            score = min(100, max(0, int(random.gauss(ability * 100, 10))))
            
            # Check if exists first (optional but safer for re-runs) - skipping for speed/simplicity of seed script
            # Assuming clean state or handle error. 
            # We will just do one entry.
            marks_entries.append(MarksEntry(
                student_id=student.id,
                subject_id=subject.id,
                exam_term_id=term.id,
                marks_obtained=score,
                total_marks=100,
                is_published=True,
                school_id=school_id
            ))

    db.bulk_save_objects(marks_entries)
    print(f"Inserted {len(marks_entries)} marks entries.")
    
    db.commit()
    print("Seeding complete!")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        # User School ID - hardcoding or fetching first school
        # In a real script we might take args.
        # For now, let's assume the first school in DB is the target
        from schools.models import School
        school = db.query(School).first()
        if school:
            seed_analytics(db, str(school.id))
        else:
            print("No school found to seed.")
    finally:
        db.close()
