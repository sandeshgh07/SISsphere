from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from database import SessionLocal
from auth.dependencies import get_db, require_roles, TenantAccess, Roles
from students import models as student_models
from schools import models as school_models
from audit.listeners import set_actor_id, set_reason
from core.limiter import limiter
from core.email_service import email_service
import magic
import uuid
import os
import shutil
import random
from datetime import datetime
from passlib.context import CryptContext

router = APIRouter(tags=["Admission"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Public Endpoint
@router.post("/public/admissions/{school_uuid}")
@limiter.limit("5/hour")
def submit_admission(
    request: Request,
    school_uuid: str,
    first_name: str = Form(...),
    last_name: str = Form(...),
    parent_phone: str = Form(...),
    age: int = Form(...),
    target_grade: str = Form(...),
    completed_grade: str = Form(None),
    previous_school: str = Form(None),
    parent_name: str = Form(None),
    email: Optional[str] = Form(None),
    source: Optional[str] = Form("direct"),
    transcript: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    import logging
    log = logging.getLogger(__name__)
    log.info(f"Admission submitted. Source: {source}")

    # Verify school exists
    try:
        school_uuid_obj = uuid.UUID(school_uuid)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid School UUID")

    school = db.query(school_models.School).filter(school_models.School.id == school_uuid_obj).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    # File Validation
    file_content = transcript.file.read(1024)
    mime_type = magic.from_buffer(file_content, mime=True)
    transcript.file.seek(0)

    allowed_types = ['application/pdf', 'image/jpeg', 'image/png']
    if mime_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF, JPG, PNG allowed.")

    # Save File
    file_ext = os.path.splitext(transcript.filename)[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = f"static/admissions/{filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(transcript.file, buffer)

    # Create Application
    new_app = student_models.AdmissionApplication(
        school_id=school_uuid,
        first_name=first_name,
        last_name=last_name,
        email=email,
        parent_phone=parent_phone,
        age=age,
        target_grade=target_grade,
        completed_grade=completed_grade,
        previous_school=previous_school,
        parent_name=parent_name,
        transcript_url=f"/static/admissions/{filename}",
        status=student_models.AdmissionStatus.APPLIED
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return {"message": "Application submitted successfully", "application_id": new_app.id}

# Internal Endpoints

@router.get("/admissions")
def list_applications(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.ACCOUNTANT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    query = db.query(student_models.AdmissionApplication).filter(
        student_models.AdmissionApplication.school_id == str(tenant.school_id)
    )
    if status:
        query = query.filter(student_models.AdmissionApplication.status == status)

    return query.order_by(student_models.AdmissionApplication.submission_date.desc()).all()

@router.post("/admissions/{application_id}/eligibility")
def set_eligibility(
    application_id: str,
    status: str = Form(...), # ELIGIBLE or INELIGIBLE
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.ACCOUNTANT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    app = db.query(student_models.AdmissionApplication).filter(
        student_models.AdmissionApplication.id == application_id,
        student_models.AdmissionApplication.school_id == str(tenant.school_id)
    ).first()

    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if status not in [student_models.AdmissionStatus.ELIGIBLE, student_models.AdmissionStatus.INELIGIBLE]:
         raise HTTPException(status_code=400, detail="Invalid status")

    set_actor_id(str(user.id))
    app.status = status
    db.commit()

    # Mock Email
    print(f"Mock Email to {app.email or app.parent_phone}: Your application is {status}.")

    return {"message": "Status updated", "status": app.status}

@router.post("/admissions/{application_id}/enroll")
def enroll_student(
    application_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.ACCOUNTANT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    app = db.query(student_models.AdmissionApplication).filter(
        student_models.AdmissionApplication.id == application_id,
        student_models.AdmissionApplication.school_id == str(tenant.school_id)
    ).first()

    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if app.status != student_models.AdmissionStatus.ELIGIBLE:
        raise HTTPException(status_code=400, detail="Student is not eligible for enrollment")

    # Generate PIN
    pin = "".join([str(random.randint(0, 9)) for _ in range(6)])
    hashed_pin = pwd_context.hash(pin)

    # Create User
    # Ensure email uniqueness. If conflict, append random.
    user_email = app.email
    if not user_email:
        user_email = f"{app.first_name.lower()}.{app.last_name.lower()}{random.randint(10,99)}@school.com"

    existing_user = db.query(school_models.User).filter(school_models.User.email == user_email).first()
    if existing_user:
        user_email = f"{user_email.split('@')[0]}{random.randint(100,999)}@{user_email.split('@')[1]}"

    new_user = school_models.User(
        email=user_email,
        hashed_password=hashed_pin,
        first_name=app.first_name,
        last_name=app.last_name,
        role="student",
        school_id=tenant.school_id,
        force_password_change=True,
        is_active=True
    )
    db.add(new_user)
    db.flush() # get ID

    # Generate Roll Number
    count = db.query(student_models.Student).filter(student_models.Student.school_id == tenant.school_id).count()
    roll_number = f"R{datetime.now().year}-{count + 1:04d}"

    # Create Student
    new_student = student_models.Student(
        id=str(new_user.id), # Link ID if possible, or use generated UUID.
        # Ideally Student ID != User ID but they can be same or mapped.
        # Using separate UUID for student usually.
        first_name=app.first_name,
        last_name=app.last_name,
        roll_number=roll_number,
        email=user_email,
        school_id=str(tenant.school_id),
        is_active=True
    )
    # The student ID will be autogenerated if I don't set it, but wait, Student.id default is UUID.
    # I'll let it autogenerate.

    db.add(new_student)

    # Update App Status
    set_actor_id(str(user.id))
    app.status = student_models.AdmissionStatus.ENROLLED
    db.commit()

    # Send Email
    school = db.query(school_models.School).filter(school_models.School.id == tenant.school_id).first()
    school_name = school.name if school else "Nepsis School"

    # Send to parent email if available, or just log
    target_email = app.email if app.email else "parent@example.com"
    email_service.send_enrollment_email(
        to_email=target_email,
        student_name=f"{app.first_name} {app.last_name}",
        login_url="http://localhost:5173/login", # In prod, from config
        username=user_email,
        pin=pin,
        school_name=school_name
    )

    return {
        "message": "Student enrolled successfully",
        "student_id": new_student.id,
        "user_email": user_email,
        "pin": pin # Returning PIN for testing convenience, in prod sent via email
    }
