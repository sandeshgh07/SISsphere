from fastapi import APIRouter, Depends, HTTPException, Request, Header, status, File, UploadFile, Form
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_
from typing import Dict, Any, Optional, List
import uuid
import json
import logging
import shutil
import os
import re
from datetime import datetime as dt, timezone

from auth.dependencies import get_db, require_roles, TenantAccess, Roles
from finance import models as finance_models
from finance import schemas as finance_schemas
from finance.gateway import gateway_service
from database import engine
from pydantic import BaseModel

# Logger
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])

@router.get("/", response_model=List[finance_schemas.PaymentResponse])
def list_payments(
    student_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.SUPER_ADMIN, Roles.ACCOUNTANT, Roles.PRINCIPAL, Roles.SCHOOL_ADMIN))
):
    query = db.query(finance_models.Payment).filter(
        finance_models.Payment.school_id == tenant.school_id
    )

    if student_id:
        # Payments might link to invoice or fee or neither?
        # Standard payment has invoice_id or student_invoice_id (preferred new way).
        # We need to join with Invoice/StudentInvoice to filter by student.
        # Or if Payment has student linkage directly? Current model doesn't seem to have direct student_id column on Payment, 
        # it links via invoice_id (old) or student_invoice_id (new) or fee_id.
        # This is complex to filter efficiently without joins.
        # Let's try joining StudentInvoice
        query = query.outerjoin(
            finance_models.StudentInvoice, 
            finance_models.Payment.student_invoice_id == finance_models.StudentInvoice.id
        ).outerjoin(
            finance_models.Fee,
            finance_models.Payment.fee_id == finance_models.Fee.id
        ).filter(
            or_(
                finance_models.StudentInvoice.student_id == student_id,
                finance_models.Fee.student_id == student_id
            )
        )

    if start_date:
        query = query.filter(finance_models.Payment.created_at >= start_date)
    if end_date:
        query = query.filter(finance_models.Payment.created_at <= end_date)

    payments = query.order_by(finance_models.Payment.created_at.desc()).offset(offset).limit(limit).all()
    return payments

@router.post("/invoices", response_model=finance_schemas.InvoiceResponse)
def create_invoice(
    invoice: finance_schemas.InvoiceCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.SUPER_ADMIN, Roles.ACCOUNTANT))
):
    """
    Admin/Accountant creates an invoice.
    """
    db_invoice = finance_models.Invoice(
        school_id=tenant.school_id,
        student_id=invoice.student_id,
        total_amount=invoice.amount_due, # Map request 'amount_due' to 'total_amount'
        amount_paid=0.0,
        currency=invoice.currency,
        status=finance_models.InvoiceStatus.ISSUED
    )
    db.add(db_invoice)
    db.commit()
    db.refresh(db_invoice)
    return db_invoice

@router.post("/initiate", response_model=finance_schemas.PaymentInitiateResponse)
def initiate_payment(
    request: finance_schemas.PaymentInitiateRequest,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PARENT, Roles.SUPER_ADMIN, Roles.ACCOUNTANT, Roles.STUDENT))
):
    """
    Step A: Initiate Payment (Partial or Full)
    """
    # 1. Fetch Invoice
    invoice = db.query(finance_models.Invoice).filter(
        finance_models.Invoice.id == request.invoice_id,
        finance_models.Invoice.school_id == tenant.school_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status == finance_models.InvoiceStatus.PAID:
        raise HTTPException(status_code=400, detail="Invoice is already paid")

    if invoice.status == finance_models.InvoiceStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Invoice is cancelled")

    # Determine amount
    remaining_amount = invoice.total_amount - invoice.amount_paid
    amount_to_pay = request.amount if request.amount else remaining_amount

    # Validate amount
    if amount_to_pay <= 0:
         raise HTTPException(status_code=400, detail="Amount must be positive")

    if amount_to_pay > remaining_amount:
         raise HTTPException(status_code=400, detail=f"Amount exceeds remaining balance of {remaining_amount}")

    # 2. Create PaymentIntent
    idempotency_key = str(uuid.uuid4())

    metadata = {
        "school_id": tenant.school_id,
        "invoice_id": invoice.id,
        "payment_intent_id": "PENDING"
    }

    payment_intent = finance_models.PaymentIntent(
        school_id=tenant.school_id,
        invoice_id=invoice.id,
        amount=amount_to_pay,
        currency=invoice.currency,
        idempotency_key=idempotency_key,
        status=finance_models.PaymentIntentStatus.CREATED
    )
    db.add(payment_intent)
    db.commit()
    db.refresh(payment_intent)

    metadata["payment_intent_id"] = payment_intent.id

    # 3. Call Gateway
    try:
        session_data = gateway_service.create_session(
            amount=amount_to_pay,
            currency=invoice.currency,
            metadata=metadata
        )
    except Exception as e:
        logger.error(f"Gateway error: {e}")
        raise HTTPException(status_code=502, detail="Payment gateway error")

    # 4. Update Intent
    payment_intent.gateway_session_id = session_data["id"]
    payment_intent.status = finance_models.PaymentIntentStatus.PENDING
    db.commit()

    return {
        "payment_intent_id": payment_intent.id,
        "client_secret": session_data["client_secret"],
        "gateway_session_id": session_data["id"],
        "amount": amount_to_pay,
        "currency": invoice.currency
    }

@router.post("/webhook")
async def payment_webhook(
    request: Request,
    x_signature: str = Header(None)
):
    """
    Step C: Webhook Handler
    """
    payload_bytes = await request.body()

    if not gateway_service.verify_webhook_signature(payload_bytes, x_signature):
        logger.warning("Invalid webhook signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        payload = json.loads(payload_bytes)
        event_type = payload.get("type")
        data_object = payload.get("data", {}).get("object", {})
    except json.JSONDecodeError:
         raise HTTPException(status_code=400, detail="Invalid JSON")

    if event_type != "payment_intent.succeeded":
        return {"status": "ignored"}

    gateway_txn_id = data_object.get("id")
    amount = data_object.get("amount")
    currency = data_object.get("currency")
    metadata = data_object.get("metadata", {})

    school_id = metadata.get("school_id")
    invoice_id = metadata.get("invoice_id")
    payment_intent_id = metadata.get("payment_intent_id")

    if not (school_id and invoice_id and payment_intent_id):
        return {"status": "metadata_missing"}

    from database import SessionLocal
    db = SessionLocal()

    try:
        existing_payment = db.query(finance_models.Payment).filter(
            finance_models.Payment.gateway == "mock_gateway",
            finance_models.Payment.gateway_txn_id == gateway_txn_id
        ).first()

        if existing_payment:
            logger.info(f"Duplicate webhook for txn {gateway_txn_id}")
            return {"status": "already_processed"}

        txn_details = gateway_service.get_transaction_details(gateway_txn_id)
        if txn_details.get("status") != "succeeded":
             logger.error(f"Gateway verification failed for {gateway_txn_id}")
             raise HTTPException(status_code=400, detail="Gateway verification failed")

        # LOCKING
        invoice = db.query(finance_models.Invoice).with_for_update().filter(
            finance_models.Invoice.id == invoice_id,
            finance_models.Invoice.school_id == school_id
        ).first()

        if not invoice:
            return {"status": "invoice_not_found"}

        if invoice.status == finance_models.InvoiceStatus.CANCELLED:
             logger.error(f"Invoice {invoice_id} is cancelled")
             # Payment succeeded but invoice cancelled.
             # Should record payment as REFUNDED/FAILED conceptually or hold it.
             # Requirements say "Invoice never decreases amount_paid".
             # For now, we reject the update.
             return {"status": "invoice_cancelled"}

        payment_intent = db.query(finance_models.PaymentIntent).filter(
            finance_models.PaymentIntent.id == payment_intent_id
        ).first()

        if not payment_intent:
             return {"status": "intent_not_found"}

        # Validate amount matches intent
        if payment_intent.amount != amount or payment_intent.currency != currency:
             logger.error("Amount mismatch")
             raise HTTPException(status_code=400, detail="Amount mismatch")

        # OVERPAYMENT CHECK
        if (invoice.amount_paid + amount) > invoice.total_amount:
            logger.error(f"Overpayment attempt. Paid: {invoice.amount_paid}, New: {amount}, Total: {invoice.total_amount}")
            # Record failed payment
            payment = finance_models.Payment(
                school_id=school_id,
                invoice_id=invoice_id,
                payment_intent_id=payment_intent_id,
                gateway="mock_gateway",
                gateway_txn_id=gateway_txn_id,
                amount=amount,
                currency=currency,
                status=finance_models.PaymentStatus.FAILED,
                raw_event=payload
            )
            db.add(payment)
            payment_intent.status = finance_models.PaymentIntentStatus.FAILED
            db.commit()
            return {"status": "overpayment_rejected"}

        # SUCCESS PATH
        payment = finance_models.Payment(
            school_id=school_id,
            invoice_id=invoice_id,
            payment_intent_id=payment_intent_id,
            gateway="mock_gateway",
            gateway_txn_id=gateway_txn_id,
            amount=amount,
            currency=currency,
            status=finance_models.PaymentStatus.SUCCEEDED,
            raw_event=payload
        )
        db.add(payment)

        payment_intent.status = finance_models.PaymentIntentStatus.SUCCEEDED

        # Update Invoice
        invoice.amount_paid += amount
        if invoice.amount_paid >= invoice.total_amount:
             invoice.status = finance_models.InvoiceStatus.PAID
        else:
             invoice.status = finance_models.InvoiceStatus.PARTIALLY_PAID

        db.commit()
        logger.info(f"Payment processed for invoice {invoice_id}. New balance: {invoice.total_amount - invoice.amount_paid}")
        return {"status": "success"}

    except Exception as e:
        db.rollback()
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        db.close()


@router.get("/status", response_model=finance_schemas.PaymentStatusResponse)
def get_payment_status(
    invoice_id: str,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PARENT, Roles.SUPER_ADMIN, Roles.ACCOUNTANT, Roles.STUDENT))
):
    invoice = db.query(finance_models.Invoice).filter(
        finance_models.Invoice.id == invoice_id,
        finance_models.Invoice.school_id == tenant.school_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return {
        "invoice_id": invoice.id,
        "status": invoice.status,
        "total_amount": invoice.total_amount,
        "amount_paid": invoice.amount_paid,
        "remaining_amount": invoice.total_amount - invoice.amount_paid
    }

class PaymentVerifyRequest(BaseModel):
    status: str # "verified" or "rejected"
    notes: Optional[str] = None

@router.post("/record")
async def record_payment(
    invoice_id: Optional[str] = Form(None),
    fee_id: Optional[str] = Form(None),
    amount: float = Form(...),
    entry_source: str = Form(...),
    notes: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    current_user = Depends(require_roles(Roles.SUPER_ADMIN, Roles.ACCOUNTANT, Roles.PRINCIPAL, Roles.PARENT))
):
    """
    Hybrid Payment Entry:
    - REMOTE: Requires Receipt Attachment. Starts as PENDING.
    - OFFICE_CASH: Attachment optional, logs accountant as verifier. Starts as SUCCEEDED.
    """
    if not invoice_id and not fee_id:
        raise HTTPException(status_code=400, detail="Either invoice_id or fee_id is required")

    # Validate Source
    if entry_source not in [e.value for e in finance_models.EntrySource]:
        raise HTTPException(status_code=400, detail="Invalid entry source")

    source_enum = finance_models.EntrySource(entry_source)

    if source_enum == finance_models.EntrySource.OFFICE_CASH:
        if current_user.role not in [Roles.SUPER_ADMIN, Roles.ACCOUNTANT, Roles.PRINCIPAL, Roles.SCHOOL_ADMIN]:
             raise HTTPException(status_code=403, detail="Only staff can record cash payments")

    # 1. Validation Logic
    receipt_url = None
    verifier_id = None
    initial_status = finance_models.PaymentStatus.CONFIRMED

    if source_enum == finance_models.EntrySource.REMOTE:
        if not file:
            raise HTTPException(status_code=400, detail="Receipt attachment is REQUIRED for REMOTE payments")
        # REMOTE payments start as PENDING verification
        initial_status = finance_models.PaymentStatus.PENDING_VERIFICATION
    elif source_enum == finance_models.EntrySource.OFFICE_CASH:
        # Attachment optional
        verifier_id = current_user.id
        # CASH payments are verified by default (since accountant enters them)
        initial_status = finance_models.PaymentStatus.CONFIRMED

    # 2. File Upload
    if file:
         # Validate file type
        allowed_extensions = {".pdf", ".jpg", ".jpeg", ".png"}
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail="Invalid file type")

        upload_dir = "static/receipts"
        os.makedirs(upload_dir, exist_ok=True)

        # Secure filename
        safe_filename = re.sub(r'[^a-zA-Z0-9_.-]', '_', os.path.basename(file.filename))
        filename_id = invoice_id if invoice_id else fee_id
        filename = f"manual_{filename_id}_{safe_filename}"
        file_path = os.path.join(upload_dir, filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        receipt_url = f"/static/receipts/{filename}"

    # 3. Fetch Target (Invoice or Fee)
    remaining = 0.0
    currency = "NPR"
    invoice = None
    fee = None

    if invoice_id:
        invoice = db.query(finance_models.Invoice).filter(
            finance_models.Invoice.id == invoice_id,
            finance_models.Invoice.school_id == tenant.school_id
        ).first()

        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if invoice.status == finance_models.InvoiceStatus.CANCELLED:
            raise HTTPException(status_code=400, detail="Invoice is cancelled")
        remaining = invoice.total_amount - invoice.amount_paid
        currency = invoice.currency

    elif fee_id:
        fee = db.query(finance_models.Fee).with_for_update().filter(
            finance_models.Fee.id == fee_id,
            finance_models.Fee.school_id == tenant.school_id
        ).first()
        if not fee:
            raise HTTPException(status_code=404, detail="Fee not found")

        # Calculate remaining for Fee
        paid_sum = db.query(func.sum(finance_models.Payment.amount)).filter(
            finance_models.Payment.fee_id == fee_id,
            finance_models.Payment.status == finance_models.PaymentStatus.CONFIRMED
        ).scalar() or 0.0
        remaining = fee.amount - paid_sum

    # 4. Overpayment Check
    # Allow small float error or strict? Strict for now.
    if amount > remaining + 0.01:
         raise HTTPException(status_code=400, detail=f"Amount exceeds remaining balance ({remaining})")

    # 5. Create Payment Record
    # Generate a manual txn id
    manual_txn_id = str(uuid.uuid4())

    payment = finance_models.Payment(
        school_id=tenant.school_id,
        invoice_id=invoice_id,
        fee_id=fee_id,
        payment_intent_id=None, # No intent for manual
        gateway="MANUAL",
        gateway_txn_id=manual_txn_id,
        amount=amount,
        currency=currency,
        status=initial_status,
        entry_source=source_enum,
        verifier_id=verifier_id,
        receipt_url=receipt_url,
        notes=notes,
        raw_event={"source": "manual_entry", "by": current_user.email}
    )
    db.add(payment)

    # 6. Update Status (Only if CONFIRMED immediately)
    if initial_status == finance_models.PaymentStatus.CONFIRMED:
        if invoice:
            invoice.amount_paid += amount
            if invoice.amount_paid >= invoice.total_amount - 0.01:
                 invoice.status = finance_models.InvoiceStatus.PAID
            else:
                 invoice.status = finance_models.InvoiceStatus.PARTIALLY_PAID
        elif fee:
            # Recalculate total paid including this one
            final_sum = (paid_sum if 'paid_sum' in locals() else 0.0) + amount

            if final_sum >= fee.amount - 0.01:
                fee.status = "paid"
                fee.paid_date = dt.now(timezone.utc)
            else:
                fee.status = "pending"

    db.commit()
    db.refresh(payment)

    return {"status": "success", "payment_id": payment.id, "payment_status": payment.status}

@router.post("/{payment_id}/verify")
def verify_payment(
    payment_id: str,
    request: PaymentVerifyRequest,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    current_user = Depends(require_roles(Roles.SUPER_ADMIN, Roles.ACCOUNTANT, Roles.PRINCIPAL))
):
    """
    Verify or Reject a PENDING payment.
    """
    payment = db.query(finance_models.Payment).filter(
        finance_models.Payment.id == payment_id,
        finance_models.Payment.school_id == tenant.school_id
    ).first()

    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment.status not in [finance_models.PaymentStatus.PENDING, finance_models.PaymentStatus.PENDING_VERIFICATION]:
        raise HTTPException(status_code=400, detail="Payment is not pending verification")

    if request.status == "verified":
        payment.status = finance_models.PaymentStatus.CONFIRMED
        payment.verifier_id = current_user.id
        if request.notes:
            payment.notes = (payment.notes or "") + f" | Verified: {request.notes}"

        # Apply Balance Update logic (same as record_payment)
        if payment.invoice_id:
            invoice = db.query(finance_models.Invoice).with_for_update().filter(
                finance_models.Invoice.id == payment.invoice_id
            ).first()
            if invoice:
                invoice.amount_paid += payment.amount
                if invoice.amount_paid >= invoice.total_amount - 0.01:
                    invoice.status = finance_models.InvoiceStatus.PAID
                else:
                    invoice.status = finance_models.InvoiceStatus.PARTIALLY_PAID

        elif payment.fee_id:
            fee = db.query(finance_models.Fee).with_for_update().filter(
                finance_models.Fee.id == payment.fee_id
            ).first()
            if fee:
                paid_sum = db.query(func.sum(finance_models.Payment.amount)).filter(
                    finance_models.Payment.fee_id == fee.id,
                    finance_models.Payment.status == finance_models.PaymentStatus.CONFIRMED
                ).scalar() or 0.0
                # Add current payment (now CONFIRMED)
                final_sum = paid_sum + payment.amount

                if final_sum >= fee.amount - 0.01:
                    fee.status = "paid"
                    fee.paid_date = dt.now(timezone.utc)
                else:
                    fee.status = "pending"

    elif request.status == "rejected":
        payment.status = finance_models.PaymentStatus.REJECTED
        payment.verifier_id = current_user.id
        if request.notes:
            payment.notes = (payment.notes or "") + f" | Rejected: {request.notes}"
    else:
        raise HTTPException(status_code=400, detail="Invalid status")

    db.commit()
    db.refresh(payment)
    return {"status": "success", "payment_status": payment.status}
