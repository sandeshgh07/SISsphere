from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from auth.dependencies import get_db, require_roles, Roles
from schools.models import User, School
from students.models import Student
from finance.models import Fee
from audit.models import AuditLog
import pandas as pd
import io
import csv
from typing import List

router = APIRouter(prefix="/api/admin/bulk", tags=["bulk_data"])

# --- EXPORT ---

@router.get("/export/students")
def export_students(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.SUPER_ADMIN, Roles.PRINCIPAL))
):
    students = db.query(Student).filter(Student.school_id == user.school_id).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'First Name', 'Last Name', 'Roll Number', 'Email', 'Grade ID', 'Section ID'])

    for s in students:
        writer.writerow([s.id, s.first_name, s.last_name, s.roll_number, s.email, s.grade_id, s.section_id])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=students_export.csv"}
    )

@router.get("/export/teachers")
def export_teachers(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.SUPER_ADMIN, Roles.PRINCIPAL))
):
    teachers = db.query(User).filter(User.school_id == user.school_id, User.role == Roles.TEACHER).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'First Name', 'Last Name', 'Email', 'Role'])

    for t in teachers:
        writer.writerow([t.id, t.first_name, t.last_name, t.email, t.role])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=teachers_export.csv"}
    )

@router.get("/export/invoices")
def export_invoices(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.SUPER_ADMIN, Roles.PRINCIPAL, Roles.ACCOUNTANT))
):
    fees = db.query(Fee).filter(Fee.school_id == user.school_id).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'Student ID', 'Amount', 'Description', 'Status', 'Due Date', 'Receipt URL'])

    for f in fees:
        writer.writerow([f.id, f.student_id, f.amount, f.description, f.status, f.due_date, f.receipt_url])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=invoices_export.csv"}
    )

@router.get("/export/audit-logs")
def export_audit_logs(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.SUPER_ADMIN, Roles.PRINCIPAL))
):
    # Filter logs where actor is from the same school
    logs = db.query(AuditLog).join(User, AuditLog.actor_id == User.id)\
        .filter(User.school_id == user.school_id).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'Actor ID', 'Action', 'Table', 'Record ID', 'Timestamp', 'Reason'])

    for log in logs:
        writer.writerow([log.id, log.actor_id, log.action_type, log.table_name, log.record_id, log.timestamp, log.reason])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_logs_export.csv"}
    )

# --- IMPORT ---

@router.post("/import/students")
async def import_students(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.SUPER_ADMIN, Roles.PRINCIPAL))
):
    if not file.filename.endswith(('.csv', '.xlsx')):
         raise HTTPException(status_code=400, detail="Invalid format. Use CSV or Excel.")

    contents = await file.read()
    if file.filename.endswith('.csv'):
        df = pd.read_csv(io.BytesIO(contents))
    else:
        df = pd.read_excel(io.BytesIO(contents))

    # Expected columns: first_name, last_name, roll_number, email
    required = ['first_name', 'last_name', 'roll_number']
    if not all(col in df.columns for col in required):
        raise HTTPException(status_code=400, detail=f"Missing required columns: {required}")

    count = 0
    new_students = []
    roll_numbers = df['roll_number'].astype(str).tolist()

    # Batch check existence
    existing_students = db.query(Student.roll_number).filter(
        Student.school_id == user.school_id,
        Student.roll_number.in_(roll_numbers)
    ).all()
    existing_rolls = {r[0] for r in existing_students}

    for _, row in df.iterrows():
        roll = str(row['roll_number'])
        if roll not in existing_rolls:
            new_student = Student(
                first_name=row['first_name'],
                last_name=row['last_name'],
                roll_number=roll,
                email=row.get('email', None),
                school_id=user.school_id
            )
            new_students.append(new_student)
            existing_rolls.add(roll) # Prevent duplicates within the same batch
            count += 1

    if new_students:
        db.bulk_save_objects(new_students)
        db.commit()

    return {"message": f"Successfully imported {count} students."}

@router.post("/import/fees")
async def import_fees(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.SUPER_ADMIN, Roles.PRINCIPAL, Roles.ACCOUNTANT))
):
    if not file.filename.endswith(('.csv', '.xlsx')):
         raise HTTPException(status_code=400, detail="Invalid format. Use CSV or Excel.")

    contents = await file.read()
    if file.filename.endswith('.csv'):
        df = pd.read_csv(io.BytesIO(contents))
    else:
        df = pd.read_excel(io.BytesIO(contents))

    # Expected columns: student_roll_number, amount, description
    required = ['student_roll_number', 'amount', 'description']
    if not all(col in df.columns for col in required):
         raise HTTPException(status_code=400, detail=f"Missing required columns: {required}")

    count = 0
    errors = []
    new_fees = []

    # Get all roll numbers from import
    roll_numbers = df['student_roll_number'].astype(str).unique().tolist()

    # Batch fetch students
    students = db.query(Student).filter(
        Student.school_id == user.school_id,
        Student.roll_number.in_(roll_numbers)
    ).all()
    student_map = {s.roll_number: s.id for s in students}

    for index, row in df.iterrows():
        roll = str(row['student_roll_number'])
        student_id = student_map.get(roll)

        if not student_id:
            errors.append(f"Row {index}: Student with roll number {roll} not found.")
            continue

        fee = Fee(
            student_id=student_id,
            amount=float(row['amount']),
            description=row['description'],
            school_id=user.school_id
        )
        new_fees.append(fee)
        count += 1

    if new_fees:
        db.bulk_save_objects(new_fees)
        db.commit()

    return {"message": f"Successfully imported {count} fees.", "errors": errors}
