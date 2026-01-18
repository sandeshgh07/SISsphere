from fastapi import APIRouter, Depends, HTTPException, Body, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from database import SessionLocal
from auth.dependencies import get_db, require_roles, TenantAccess, Roles, get_current_user
from students import models as student_models
from students import admission_schemas
from schools import models as school_models
from finance import models as finance_models
from academics import models as academic_models
from auth.subscription import require_subscription_feature
from datetime import datetime
from passlib.context import CryptContext
from communication.email_service import NotificationService
import secrets
import string
import uuid

router = APIRouter(tags=["Admission"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
email_service = NotificationService()

# Public Endpoint
@router.post("/api/public/admissions/{school_uuid}", response_model=admission_schemas.AdmissionResponse)
def submit_admission(
    school_uuid: str,
    application: admission_schemas.AdmissionCreate,
    db: Session = Depends(get_db)
):
    # Verify school exists
    try:
        school_uid = uuid.UUID(school_uuid)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid School UUID")

    school = db.query(school_models.School).filter(school_models.School.id == school_uid).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    # Create application
    new_app = student_models.AdmissionApplication(
        school_id=school_uuid,
        first_name=application.first_name,
        last_name=application.last_name,
        email=application.email,
        parent_phone=application.parent_phone,
        documents=application.documents
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return new_app

# Protected Endpoints

@router.get("/api/admissions", response_model=List[admission_schemas.AdmissionResponse])
def list_applications(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("SMART_ADMISSION"))
):
    return db.query(student_models.AdmissionApplication).filter(
        student_models.AdmissionApplication.school_id == str(tenant.school_id)
    ).order_by(student_models.AdmissionApplication.submission_date.desc()).all()

@router.post("/api/admissions/{application_id}/approve")
def approve_application(
    application_id: str,
    approval_data: admission_schemas.AdmissionApprove,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("SMART_ADMISSION"))
):
    # Fetch application
    app = db.query(student_models.AdmissionApplication).filter(
        student_models.AdmissionApplication.id == application_id,
        student_models.AdmissionApplication.school_id == str(tenant.school_id)
    ).first()

    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if app.status != student_models.AdmissionStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Application is already {app.status}")

    # 1. Create Student
    # Generate a roll number (simple implementation: count + 1)
    count = db.query(student_models.Student).filter(student_models.Student.school_id == tenant.school_id).count()
    roll_number = f"R{datetime.now().year}-{count + 1:04d}"

    new_student = student_models.Student(
        first_name=app.first_name,
        last_name=app.last_name,
        roll_number=roll_number,
        email=app.email,
        school_id=str(tenant.school_id),
        grade_id=approval_data.grade_id,
        section_id=approval_data.section_id,
        academic_year_id=approval_data.academic_year_id
    )
    db.add(new_student)
    db.flush() # Get ID

    # 2. Create Parent User & First-Touch Experience
    if app.email:
        parent_user = db.query(school_models.User).filter(
            school_models.User.email == app.email,
            school_models.User.school_id == tenant.school_id # User uses Uuid, so this is fine
        ).first()

        if not parent_user:
            # Generate 6-digit PIN
            pin = ''.join(secrets.choice(string.digits) for _ in range(6))
            hashed_pin = pwd_context.hash(pin)

            parent_user = school_models.User(
                email=app.email,
                hashed_password=hashed_pin,
                first_name="Parent",
                last_name=f"of {app.first_name}",
                role=Roles.PARENT,
                school_id=tenant.school_id,
                must_change_password=True
            )
            db.add(parent_user)
            db.flush()

            # Link Parent and Student
            link = student_models.ParentStudentLink(
                parent_id=str(parent_user.id),
                student_id=new_student.id,
                school_id=str(tenant.school_id)
            )
            db.add(link)

            # Send Email
            school = db.query(school_models.School).filter(school_models.School.id == tenant.school_id).first()
            school_name = school.name if school else "Our School"

            background_tasks.add_task(
                email_service.send_enrollment_welcome,
                to_email=app.email,
                pin=pin,
                school_name=school_name
            )

    # 3. Generate Registration Fee Invoice
    # Create Invoice
    invoice = finance_models.Invoice(
        school_id=str(tenant.school_id),
        student_id=new_student.id,
        total_amount=approval_data.registration_fee_amount,
        status=finance_models.InvoiceStatus.ISSUED
    )
    db.add(invoice)
    db.flush()

    # Create Fee Item
    fee = finance_models.Fee(
        student_id=new_student.id,
        amount=approval_data.registration_fee_amount,
        description="Registration Fee",
        school_id=str(tenant.school_id),
        status="pending"
    )
    db.add(fee)

    # 4. Update Application Status
    app.status = student_models.AdmissionStatus.APPROVED

    db.commit()

    return {"message": "Application approved, student created, invoice generated", "student_id": new_student.id}
