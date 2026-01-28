from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from pydantic import BaseModel
from datetime import datetime, timezone
import csv
import io
import uuid

from database import get_db
from schools.models import User
from students.models import Student
from auth.dependencies import get_current_active_user, Roles
from finance import models as fin_models
from finance.invoices_router import create_audit_log

router = APIRouter(
    prefix="/api/fees/legacy",
    tags=["Financials - Legacy Import"]
)

class ImportRow(BaseModel):
    student_identifier: str # Email or Student ID
    period: str # YYYY-MM
    amount_due: float
    paid_amount: float = 0.0
    due_date: Optional[str] = None # YYYY-MM-DD
    notes: Optional[str] = None
    row_index: int
    status: str = "VALID" # VALID, ERROR, DUPLICATE
    message: Optional[str] = None
    student_id: Optional[str] = None # Resolved ID

class ImportPreviewResponse(BaseModel):
    rows: List[ImportRow]
    summary: Dict[str, int] # valid, error, duplicate, total_impact_value

class ImportCommitRequest(BaseModel):
    rows: List[ImportRow]

def require_finance_admin(current_user: User = Depends(get_current_active_user)):
    user_roles = {r.role_name for r in current_user.roles} | {current_user.role}
    allowed = {Roles.PRINCIPAL, Roles.ACCOUNTANT, Roles.SCHOOL_ADMIN}
    if not allowed.intersection(user_roles):
         raise HTTPException(status_code=403, detail="Not authorized for legacy operations")
    return current_user

@router.post("/import/preview", response_model=ImportPreviewResponse)
async def preview_legacy_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance_admin)
):
    contents = await file.read()
    decoded = contents.decode('utf-8-sig') # Handle BOM
    reader = csv.DictReader(io.StringIO(decoded))
    
    rows = []
    summary = {"valid": 0, "error": 0, "duplicate": 0, "total_value": 0.0}
    
    # Pre-fetch all students for efficient lookup
    # Map: email -> id, admission_no -> id, student_id -> id
    students = db.query(Student).filter(Student.school_id == str(current_user.school_id)).all()
    student_map = {}
    for s in students:
        if s.email: student_map[s.email.lower()] = s.id
        if s.student_id: student_map[s.student_id.lower()] = s.id
        # Assuming admission_no exists or map student_id as admission no
    
    # Existing invoices check (simple prevent dupe same period)
    # Map: (student_id, period) -> True
    existing_invoices = db.query(fin_models.StudentInvoice.student_id, fin_models.StudentInvoice.period).filter(
        fin_models.StudentInvoice.school_id == str(current_user.school_id)
    ).all()
    existing_set = {(r.student_id, r.period) for r in existing_invoices}

    for idx, row in enumerate(reader):
        item = ImportRow(
            row_index=idx,
            student_identifier=row.get('student_identifier', '').strip(),
            period=row.get('period', '').strip(),
            amount_due=0.0,
            paid_amount=0.0,
            due_date=row.get('due_date'),
            notes=row.get('notes')
        )
        
        # Validation Logic
        error = None
        
        # 1. Parse Numbers
        try:
            item.amount_due = float(row.get('total_due', 0))
            if row.get('paid_amount'):
                item.paid_amount = float(row.get('paid_amount', 0))
        except ValueError:
            error = "Invalid number format"
            
        # 2. Resolve Student
        sid = item.student_identifier.lower()
        if not sid:
            error = "Missing student identifier"
        elif sid in student_map:
            item.student_id = student_map[sid]
        else:
            error = "Student not found"
            
        # 3. Check Duplicate (Database)
        if item.student_id and item.period:
            if (item.student_id, item.period) in existing_set:
                 item.status = "DUPLICATE"
                 item.message = "Invoice already exists for period"
                 summary["duplicate"] += 1
                 rows.append(item)
                 continue
                 
        if error:
            item.status = "ERROR"
            item.message = error
            summary["error"] += 1
        else:
            item.status = "VALID"
            summary["valid"] += 1
            summary["total_value"] += item.amount_due
            
        rows.append(item)
        
    create_audit_log(db, str(current_user.school_id), current_user, "LEGACY_IMPORT_PREVIEW", "BATCH", {"rows": len(rows), "valid": summary["valid"]})
    db.commit()
    
    return ImportPreviewResponse(rows=rows, summary=summary)

@router.post("/import/commit")
def commit_legacy_import(
    req: ImportCommitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance_admin)
):
    school_id = str(current_user.school_id)
    valid_rows = [r for r in req.rows if r.status == "VALID"]
    
    count_invoices = 0
    count_payments = 0
    
    for row in valid_rows:
        # Create Invoice
        # Determine status
        total = row.amount_due
        paid = row.paid_amount
        balance = total - paid
        
        status = fin_models.StudentInvoiceStatus.ISSUED
        if balance <= 0.01:
            status = fin_models.StudentInvoiceStatus.PAID
            balance = 0
        elif paid > 0:
            status = fin_models.StudentInvoiceStatus.PARTIAL
            
        # Due Date
        due_at = None
        if row.due_date:
            try:
                due_at = datetime.strptime(row.due_date, "%Y-%m-%d")
            except:
                pass
        
        inv_id = str(uuid.uuid4())
        inv = fin_models.StudentInvoice(
            id=inv_id,
            school_id=school_id,
            student_id=row.student_id,
            period=row.period,
            status=status,
            total_due=total,
            paid_total=paid,
            balance=balance,
            issued_at=datetime.now(timezone.utc), # Legacy imported now
            due_date=due_at, # Should default if missing
            created_by=str(current_user.id)
        )
        db.add(inv)
        count_invoices += 1
        
        # Create Line Item (Generic "Legacy Fee Import")
        line = fin_models.InvoiceLine(
            id=str(uuid.uuid4()),
            school_id=school_id,
            invoice_id=inv_id,
            description=f"Legacy Import ({row.period})",
            base_amount=total,
            final_amount=total,
            category="LEGACY"
        )
        db.add(line)
        
        # Create Payment Record via Legacy logic if paid > 0
        if paid > 0:
            pid = str(uuid.uuid4())
            pmt = fin_models.Payment(
                id=pid,
                school_id=school_id,
                student_invoice_id=inv_id,
                amount=paid,
                currency="NPR",
                status="SUCCEEDED",
                entry_source=fin_models.EntrySource.OFFICE_CASH, # Assume cash/manual for legacy
                notes=f"Legacy Import. {row.notes or ''}",
                recorded_by=str(current_user.id),
                paid_at=datetime.now(timezone.utc) # Or backdate if column provided? Requirement only said due_date. 
                # Ideally legacy import should have payment_date but minimal spec for now.
            )
            db.add(pmt)
            count_payments += 1
            
    create_audit_log(db, school_id, current_user, "LEGACY_IMPORT_COMMIT", "BATCH", {
        "invoices_created": count_invoices,
        "payments_created": count_payments
    })
    
    db.commit()
    return {"status": "success", "invoices": count_invoices, "payments": count_payments}
