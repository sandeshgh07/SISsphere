from fastapi import APIRouter, Depends, HTTPException, Request, Header, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import Dict, Any
import uuid
import json
import logging

from auth.dependencies import get_db, require_roles, TenantAccess, Roles
from finance import models as finance_models
from finance import schemas as finance_schemas
from finance.gateway import gateway_service
from database import engine

# Logger
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])

@router.post("/invoices", response_model=finance_schemas.InvoiceResponse)
def create_invoice(
    invoice: finance_schemas.InvoiceCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.SCHOOL_ADMIN, Roles.ACCOUNTANT))
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
    user=Depends(require_roles(Roles.PARENT, Roles.SCHOOL_ADMIN, Roles.ACCOUNTANT, Roles.STUDENT))
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
    user=Depends(require_roles(Roles.PARENT, Roles.SCHOOL_ADMIN, Roles.ACCOUNTANT, Roles.STUDENT))
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
