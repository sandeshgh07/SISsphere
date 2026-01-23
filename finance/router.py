from fastapi import APIRouter, Depends, HTTPException, Body, File, UploadFile, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from auth.dependencies import get_db, require_roles, TenantAccess, Roles, get_current_user
from schools import models as school_models
from finance import models as finance_models
from students import models as student_models
from academics import models as academic_models
from finance import plans_schemas
from auth.subscription import require_subscription_feature, require_active_subscription
from pydantic import BaseModel
from datetime import datetime, timezone
import shutil
import os
import re
from communication.email_service import NotificationService
from audit.listeners import set_reason

# Router config
# Using a specific prefix for finance admin/ops
router = APIRouter(prefix="/finance", tags=["Finance"])
email_service = NotificationService()

class FeeCreate(BaseModel):
    student_id: str
    amount: float
    description: str
    due_date: Optional[datetime] = None

class FeeUpdate(BaseModel):
    status: Optional[str] = None # 'paid' or 'pending'
    reason: Optional[str] = None

@router.post("/fees", dependencies=[Depends(require_roles("accountant", "super_admin", "superuser")), Depends(require_active_subscription())])
def create_fee(
    fee: FeeCreate,
    db: Session = Depends(get_db),
    current_user: school_models.User = Depends(get_current_user)
):
    # Verify student belongs to the same school
    student = db.query(student_models.Student).filter(
        student_models.Student.id == fee.student_id,
        student_models.Student.school_id == str(current_user.school_id)
    ).first()

    if not student:
        # We can return 404 Not Found to mask existence, or 403.
        # Since we are "admin", 404 is appropriate if we assume we can only see our students.
        raise HTTPException(status_code=404, detail="Student not found")

    new_fee = finance_models.Fee(
        student_id=fee.student_id,
        amount=fee.amount,
        description=fee.description,
        due_date=fee.due_date,
        school_id=current_user.school_id,
        status="pending"
    )
    db.add(new_fee)
    db.commit()
    db.refresh(new_fee)
    return new_fee

@router.patch("/fees/{fee_id}", dependencies=[Depends(require_roles("accountant", "super_admin", "superuser")), Depends(require_active_subscription())])
def update_fee(
    fee_id: str,
    update: FeeUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: school_models.User = Depends(get_current_user)
):
    fee = db.query(finance_models.Fee).filter(
        finance_models.Fee.id == fee_id,
        finance_models.Fee.school_id == str(current_user.school_id)
    ).first()

    if not fee:
        raise HTTPException(status_code=404, detail="Fee not found")

    if update.status:
        if update.status != fee.status:
            # Governance: Justification
            reason_text = update.reason or f"Status change: {fee.status} -> {update.status}"
            set_reason(reason_text)

        fee.status = update.status
        if update.status == "paid":
            fee.paid_date = datetime.now(timezone.utc)

            # Send Receipt
            student = db.query(student_models.Student).filter(student_models.Student.id == fee.student_id).first()
            if student:
                 # Get Parents
                 links = db.query(student_models.ParentStudentLink).filter(
                     student_models.ParentStudentLink.student_id == student.id,
                     student_models.ParentStudentLink.school_id == str(current_user.school_id)
                 ).all()

                 if links:
                     import uuid
                     # Parent IDs in Link are Strings (from my fix in admission_router), User IDs are UUIDs.
                     # But User.id is UUID type in model.
                     # So we need to cast Link.parent_id (str) to UUID for lookup?
                     # No, User.id in DB is UUID. Querying with string might fail depending on driver.
                     # Let's try casting to UUID.
                     try:
                         parent_ids = [uuid.UUID(l.parent_id) for l in links]
                     except ValueError:
                         parent_ids = []
                     parents = db.query(school_models.User).filter(school_models.User.id.in_(parent_ids)).all()

                     # Get School Name
                     school = db.query(school_models.School).filter(school_models.School.id == current_user.school_id).first()
                     school_name = school.name if school else "Our School"

                     for parent in parents:
                         background_tasks.add_task(
                             email_service.send_payment_receipt,
                             to_email=parent.email,
                             fee_id=str(fee.id),
                             amount=fee.amount,
                             date=fee.paid_date.strftime("%Y-%m-%d"),
                             school_name=school_name
                         )

        elif update.status == "pending":
            fee.paid_date = None

    db.commit()
    db.refresh(fee)
    return fee

@router.post("/invoices/{invoice_id}/payment-plan", response_model=plans_schemas.PaymentPlanResponse)
def create_payment_plan(
    invoice_id: str,
    plan_data: plans_schemas.PaymentPlanCreate,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.ACCOUNTANT)),
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("PAYMENT_PLANS"))
):
    # Verify invoice
    invoice = db.query(finance_models.Invoice).filter(
        finance_models.Invoice.id == invoice_id,
        finance_models.Invoice.school_id == tenant.school_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Validate installments sum matches total (or remaining?)
    # Assuming full split for now
    total_plan = sum(i.amount for i in plan_data.installments)
    # Simple validation: total plan amount should likely match invoice total or remaining.
    # We will just warn or strictly enforce. Let's strictly enforce against Invoice total for now.
    if abs(total_plan - invoice.total_amount) > 0.01:
        raise HTTPException(status_code=400, detail=f"Installments total ({total_plan}) must match Invoice total ({invoice.total_amount})")

    # Create Plan
    plan = finance_models.PaymentPlan(
        school_id=tenant.school_id,
        invoice_id=invoice_id,
        status=finance_models.PaymentPlanStatus.PENDING_APPROVAL
    )
    db.add(plan)
    db.flush()

    # Create Installments
    for i in plan_data.installments:
        inst = finance_models.Installment(
            payment_plan_id=plan.id,
            due_date=i.due_date,
            amount=i.amount,
            status=finance_models.InstallmentStatus.PENDING
        )
        db.add(inst)

    db.commit()
    db.refresh(plan)
    return plan

@router.patch("/payment-plans/{plan_id}/approve", response_model=plans_schemas.PaymentPlanResponse)
def approve_payment_plan(
    plan_id: str,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.ACCOUNTANT, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("PAYMENT_PLANS"))
):
    plan = db.query(finance_models.PaymentPlan).filter(
        finance_models.PaymentPlan.id == plan_id,
        finance_models.PaymentPlan.school_id == tenant.school_id
    ).first()

    if not plan:
        raise HTTPException(status_code=404, detail="Payment Plan not found")

    plan.status = finance_models.PaymentPlanStatus.ACTIVE
    plan.approved_by_id = user.id

    db.commit()
    db.refresh(plan)
    return plan

def secure_filename(filename: str) -> str:
    # Remove directory paths
    filename = os.path.basename(filename)
    # Replace non-alphanumeric (except ._-)
    filename = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)
    return filename

@router.post("/receipt", dependencies=[Depends(get_current_user)])
async def upload_receipt(
    file: UploadFile = File(...),
    fee_id: str = Body(...),
    db: Session = Depends(get_db),
    current_user: school_models.User = Depends(get_current_user)
):
    # Verify fee exists and belongs to school
    fee = db.query(finance_models.Fee).filter(
        finance_models.Fee.id == fee_id,
        finance_models.Fee.school_id == str(current_user.school_id)
    ).first()

    if not fee:
        raise HTTPException(status_code=404, detail="Fee not found")

    # Access Control: Parent of student, Student themselves, or Admin
    is_admin = current_user.role in [Roles.SUPER_USER, Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.ACCOUNTANT]

    if not is_admin:
        if current_user.role == Roles.STUDENT:
             pass
        elif current_user.role == Roles.PARENT:
             link = db.query(student_models.ParentStudentLink).filter(
                 student_models.ParentStudentLink.parent_id == current_user.id,
                 student_models.ParentStudentLink.student_id == fee.student_id
             ).first()
             if not link:
                 raise HTTPException(status_code=403, detail="Not authorized for this student")

    # Validate file type by extension
    allowed_extensions = {".pdf", ".jpg", ".jpeg", ".png"}
    ext = os.path.splitext(file.filename)[1].lower()

    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Invalid file type. Only .pdf, .jpg, .jpeg, .png allowed.")

    # Additional Content-Type check
    allowed_types = ["application/pdf", "image/jpeg", "image/png", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid Content-Type.")

    # Save File
    upload_dir = "static/receipts"
    os.makedirs(upload_dir, exist_ok=True)

    # Secure filename
    safe_filename = secure_filename(file.filename)
    filename = f"{fee.id}_{safe_filename}"
    file_path = os.path.join(upload_dir, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    url = f"/static/receipts/{filename}"

    # Update Fee
    fee.receipt_url = url

    db.commit()
    db.refresh(fee)

    return {"url": url, "message": "Receipt uploaded successfully"}
