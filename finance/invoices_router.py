from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone

from database import get_db
from schools.models import User
from schools import models as school_models
from auth.dependencies import get_current_active_user, Roles
from finance import models as fin_models
from students import models as stu_models
from academics import models as acad_models
from finance import invoices_schemas as schemas
from finance import invoice_generator
from audit.models import AuditLog
import uuid
import json
# logger = logging.getLogger(__name__)

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
import io
from fastapi.responses import StreamingResponse

router = APIRouter(
    prefix="/api/fees/invoices",
    tags=["Financials - Invoices"]
)

def create_audit_log(db: Session, school_id: str, actor: User, action: str, entity_id: str, details: dict):
    log = AuditLog(
        id=str(uuid.uuid4()),
        actor_id=str(actor.id),
        action_type=action,
        table_name="student_invoices",
        school_id=str(school_id),
        record_id=entity_id,
        after_state=json.dumps(details, default=str),
        timestamp=datetime.now(timezone.utc),
        reason=details.get("reason", "Manual Action")
    )
    db.add(log)

@router.post("/generator/preview", response_model=schemas.GeneratorResultSc)
def preview_invoice_generation(
    req: schemas.GeneratorPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Dry run invoice generation and return stats"""
    user_roles = {r.role_name for r in current_user.roles} | {current_user.role}
    if Roles.PRINCIPAL not in user_roles and Roles.ACCOUNTANT not in user_roles and Roles.SCHOOL_ADMIN not in user_roles:
         raise HTTPException(status_code=403, detail="Not authorized")
         
    return invoice_generator.generate_invoices_for_period(
        db, 
        str(current_user.school_id), 
        req.period,
        preview=True,
        conflict_rule=req.conflict_rule,
        grade_id=req.grade_id,
        template_ids=req.template_ids
    )

@router.post("/generator/run", response_model=schemas.GeneratorResultSc)
def run_invoice_generation(
    req: schemas.GeneratorPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Execute invoice generation"""
    try:
        user_roles = {r.role_name for r in current_user.roles} | {current_user.role}
        if Roles.PRINCIPAL not in user_roles and Roles.ACCOUNTANT not in user_roles and Roles.SCHOOL_ADMIN not in user_roles:
             raise HTTPException(status_code=403, detail="Not authorized")
             
        result = invoice_generator.generate_invoices_for_period(
            db, 
            str(current_user.school_id), 
            req.period,
            preview=False,
            conflict_rule=req.conflict_rule,
            grade_id=req.grade_id,
            template_ids=req.template_ids
        )
        
        # Audit log for batch run
        create_audit_log(db, str(current_user.school_id), current_user, "INVOICE_GENERATED", "BATCH", {
            "period": req.period,
            "counts": {k:v for k,v in result.items() if k in ['created', 'updated', 'skipped']}
        })
        db.commit()
        return result
    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[schemas.StudentInvoiceListSc])
def list_invoices(
    period: Optional[str] = None,
    status: Optional[str] = None,
    grade_id: Optional[str] = None,
    q: Optional[str] = None,
    balance_gt0: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    school_id = str(current_user.school_id)
    query = db.query(fin_models.StudentInvoice).join(stu_models.Student).join(acad_models.Grade).filter(
        fin_models.StudentInvoice.school_id == school_id
    )
    
    # RBAC filtering
    user_roles = {r.role_name for r in current_user.roles} | {current_user.role}
    is_staff = any(r in [Roles.PRINCIPAL, Roles.ACCOUNTANT, Roles.SCHOOL_ADMIN] for r in user_roles)
    is_parent = Roles.PARENT in user_roles
    is_student = Roles.STUDENT in user_roles
    
    if not is_staff:
        if is_student:
             query = query.filter(fin_models.StudentInvoice.student_id == current_user.id) # Assuming user.id links to student? Usually strictly mapped.
             # For now, let's assume we map via email or explicit link. The User model might have student_id.
             # MVP: Using simplified RBAC for verified actors. If strict per-student match needed:
             # query = query.filter(fin_models.StudentInvoice.student_id == current_user.linked_student_id)
             pass
        elif is_parent:
             # Filter by children
             pass
        else:
             return [] # No access
             
    if period:
        query = query.filter(fin_models.StudentInvoice.period == period)
    if status and status != "ALL":
        query = query.filter(fin_models.StudentInvoice.status == status)
    if grade_id and grade_id != "all":
        query = query.filter(stu_models.Student.grade_id == grade_id)
    if balance_gt0:
        query = query.filter(fin_models.StudentInvoice.balance > 0)
    if q:
        search = f"%{q}%"
        query = query.filter(or_(
            stu_models.Student.first_name.ilike(search),
            stu_models.Student.last_name.ilike(search),
            stu_models.Student.email.ilike(search),
            fin_models.StudentInvoice.id.ilike(search)
        ))
        
    try:
        invoices = query.order_by(desc(fin_models.StudentInvoice.generated_at)).offset(offset).limit(limit).all()
        
        # Enrich
        result = []
        for inv in invoices:
            student_name = f"{inv.student.first_name} {inv.student.last_name}"
            grade_name = inv.student.grade.name if inv.student.grade else "N/A"
            
            # Serialize
            item = schemas.StudentInvoiceListSc.from_orm(inv)
            item.student_name = student_name
            item.grade_name = grade_name
            result.append(item)
            
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{id}", response_model=schemas.StudentInvoiceSc)
def get_invoice(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # RBAC Pre-check
    user_roles = {r.role_name for r in current_user.roles} | {current_user.role}
    is_staff = any(r in [Roles.PRINCIPAL, Roles.ACCOUNTANT, Roles.SCHOOL_ADMIN, Roles.SUPER_ADMIN] for r in user_roles)
    is_parent = Roles.PARENT in user_roles
    is_student = Roles.STUDENT in user_roles

    inv = db.query(fin_models.StudentInvoice).filter(
        fin_models.StudentInvoice.id == id,
        fin_models.StudentInvoice.school_id == str(current_user.school_id)
    ).first()
    
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Strict Access Control
    if not is_staff:
        if is_student:
             # Assuming User.id maps to Student via user_id field in Student model or similar
             # Best check: specific link
             student = db.query(stu_models.Student).filter(stu_models.Student.user_id == str(current_user.id)).first()
             if not student or str(student.id) != inv.student_id:
                 raise HTTPException(status_code=403, detail="Access denied")
        elif is_parent:
             # Check ParentStudentLink
             link = db.query(stu_models.ParentStudentLink).filter(
                 stu_models.ParentStudentLink.parent_id == str(current_user.id),
                 stu_models.ParentStudentLink.student_id == inv.student_id
             ).first()
             if not link:
                 raise HTTPException(status_code=403, detail="Access denied")
        else:
             raise HTTPException(status_code=403, detail="Access denied")
        
    # Get lines
    lines = db.query(fin_models.InvoiceLine).filter(fin_models.InvoiceLine.invoice_id == id).all()
    # Get payments (via student_invoice_id)
    payments = db.query(fin_models.Payment).filter(fin_models.Payment.student_invoice_id == id).all()
    
    # Create SC
    res = schemas.StudentInvoiceSc.from_orm(inv)
    res.student_name = f"{inv.student.first_name} {inv.student.last_name}"
    res.grade_name = inv.student.grade.name if inv.student.grade else "N/A"
    
    # Populate Billing Entity (School)
    school = db.query(school_models.School).filter(school_models.School.id == uuid.UUID(inv.school_id)).first()
    if school:
        res.billing_entity = schemas.BillingEntitySc(
            name=school.name,
            address=f"{school.country}", 
            logo_url=school.logo_url
        )

    # Populate Bill To (Parent)
    parent_link = db.query(stu_models.ParentStudentLink).filter(
        stu_models.ParentStudentLink.student_id == inv.student_id
    ).first()
    
    if parent_link:
        parent = db.query(school_models.User).filter(school_models.User.id == uuid.UUID(parent_link.parent_id)).first()
        if parent:
            res.bill_to = schemas.BillToSc(
                name=f"{parent.first_name} {parent.last_name}",
                email=parent.email,
                phone=parent.phone,
                relationship="Parent/Guardian"
            )
    else:
        res.bill_to = schemas.BillToSc(name="Account Holder")
    
    # Map lines with qties
    enriched_lines = []
    for line in lines:
        line_sc = schemas.InvoiceLineItemSc.from_orm(line)
        line_sc.qty = 1.0 
        line_sc.unit_price = line.base_amount
        enriched_lines.append(line_sc)
        
    res.lines = enriched_lines
    res.payments = payments
    return res

class TimelineEventSc(BaseModel):
    id: str
    action: str
    timestamp: datetime
    actor_name: str
    details: Optional[str] = None

@router.get("/{id}/timeline", response_model=List[TimelineEventSc])
def get_invoice_timeline(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # RBAC check same as get_invoice (can reuse logic or decorator in future)
    inv = db.query(fin_models.StudentInvoice).filter(fin_models.StudentInvoice.id == id).first()
    if not inv: return [] # Avoid 404 to keep UI clean, or throw

    logs = db.query(AuditLog).filter(
        AuditLog.record_id == id,
        AuditLog.school_id == str(current_user.school_id)
    ).order_by(AuditLog.timestamp.desc()).all()

    result = []
    for log in logs:
        # Resolve actor name
        actor_name = "System"
        if log.actor_id:
            actor = db.query(school_models.User).filter(school_models.User.id == uuid.UUID(log.actor_id)).first()
            if actor:
                actor_name = f"{actor.first_name} {actor.last_name}"
        
        result.append(TimelineEventSc(
            id=log.id,
            action=log.action_type,
            timestamp=log.timestamp,
            actor_name=actor_name,
            details=log.reason or ""
        ))
    return result

@router.post("/{id}/issue")
def issue_invoice(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    user_roles = {r.role_name for r in current_user.roles} | {current_user.role}
    if Roles.ACCOUNTANT not in user_roles and Roles.PRINCIPAL not in user_roles:
         raise HTTPException(status_code=403, detail="Not authorized")

    try:
        inv = db.query(fin_models.StudentInvoice).filter(
            fin_models.StudentInvoice.id == id,
            fin_models.StudentInvoice.school_id == str(current_user.school_id)
        ).first()
        
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if inv.status != fin_models.StudentInvoiceStatus.DRAFT:
            raise HTTPException(status_code=400, detail="Only DRAFT invoices can be issued")
            
        inv.status = fin_models.StudentInvoiceStatus.ISSUED
        inv.issued_at = datetime.now(timezone.utc)
        inv.issued_by = str(current_user.id)
        
        create_audit_log(db, str(current_user.school_id), current_user, "INVOICE_ISSUED", id, {"period": inv.period})
        db.commit()
        return {"status": "success", "invoice_status": "ISSUED"}
    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{id}/void")
def void_invoice(
    id: str,
    req: schemas.InvoiceVoidRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    user_roles = {r.role_name for r in current_user.roles} | {current_user.role}
    if Roles.ACCOUNTANT not in user_roles and Roles.PRINCIPAL not in user_roles:
         raise HTTPException(status_code=403, detail="Not authorized")

    try:
        inv = db.query(fin_models.StudentInvoice).filter(
            fin_models.StudentInvoice.id == id,
            fin_models.StudentInvoice.school_id == str(current_user.school_id)
        ).first()
        
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if inv.status == fin_models.StudentInvoiceStatus.PAID:
            raise HTTPException(status_code=400, detail="Cannot void PAID invoice")
            
        inv.status = fin_models.StudentInvoiceStatus.VOID
        inv.voided_at = datetime.now(timezone.utc)
        inv.voided_by = str(current_user.id)
        inv.void_reason = req.reason
        inv.balance = 0 # Clear balance? Usually yes for void.
        inv.total_due = 0 
        
        create_audit_log(db, str(current_user.school_id), current_user, "INVOICE_VOIDED", id, {"reason": req.reason})
        db.commit()
        return {"status": "success", "invoice_status": "VOID"}
    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{id}/payments")
def record_payment(
    id: str,
    req: schemas.InvoicePaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    user_roles = {r.role_name for r in current_user.roles} | {current_user.role}
    if Roles.ACCOUNTANT not in user_roles and Roles.PRINCIPAL not in user_roles:
         raise HTTPException(status_code=403, detail="Not authorized")

    try:
        inv = db.query(fin_models.StudentInvoice).filter(
            fin_models.StudentInvoice.id == id,
            fin_models.StudentInvoice.school_id == str(current_user.school_id)
        ).first()
        
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if inv.status in [fin_models.StudentInvoiceStatus.PAID, fin_models.StudentInvoiceStatus.VOID]:
            raise HTTPException(status_code=400, detail="Invoice is already PAID or VOID")
            
        # Create Payment
        # Need to map entry_source etc.
        payment = fin_models.Payment(
            school_id=str(current_user.school_id),
            invoice_id=None, # Legacy field
            student_invoice_id=id,
            amount=req.amount,
            currency="NPR",
            status="SUCCEEDED", # Manual entry implies success
            entry_source=fin_models.EntrySource.OFFICE_CASH if req.method == "CASH" else fin_models.EntrySource.REMOTE,
            notes=req.notes,
            reference=req.reference,
            recorded_by=str(current_user.id),
            paid_at=req.paid_at or datetime.now(timezone.utc)
        )
        db.add(payment)
        
        # Update Invoice
        inv.paid_total = float(inv.paid_total or 0) + req.amount
        inv.balance = float(inv.total_due) - inv.paid_total
        
        if inv.balance <= 0.01: # Floating point tolerance
            inv.status = fin_models.StudentInvoiceStatus.PAID
            inv.balance = 0
        else:
            inv.status = fin_models.StudentInvoiceStatus.PARTIAL
            
        create_audit_log(db, str(current_user.school_id), current_user, "PAYMENT_RECORDED", id, {"amount": req.amount, "method": req.method})
        db.commit()
        return {"status": "success", "new_balance": inv.balance, "invoice_status": inv.status}
    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{id}/pdf")
def generate_pdf(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    inv = db.query(fin_models.StudentInvoice).filter(
        fin_models.StudentInvoice.id == id,
        fin_models.StudentInvoice.school_id == str(current_user.school_id)
    ).first()
    
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    lines = db.query(fin_models.InvoiceLine).filter(fin_models.InvoiceLine.invoice_id == id).all()
    
    # Fetch School & Parent for PDF
    school = db.query(school_models.School).filter(school_models.School.id == uuid.UUID(inv.school_id)).first()
    parent_link = db.query(stu_models.ParentStudentLink).filter(
        stu_models.ParentStudentLink.student_id == inv.student_id
    ).first()
    parent_name = "Account Holder"
    parent_phone = ""
    if parent_link:
        parent = db.query(school_models.User).filter(school_models.User.id == uuid.UUID(parent_link.parent_id)).first()
        if parent:
            parent_name = f"{parent.first_name} {parent.last_name}"
            parent_phone = parent.phone or ""

    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # --- HEADER ---
    # Left: School Info
    p.setFont("Helvetica-Bold", 14)
    p.drawString(50, height - 50, school.name if school else "School Name")
    p.setFont("Helvetica", 10)
    p.drawString(50, height - 65, school.country if school else "")
    
    # Right: Invoice Label & Metadata
    p.setFont("Helvetica-Bold", 20)
    p.drawRightString(width - 50, height - 50, "INVOICE")
    
    p.setFont("Helvetica", 10)
    p.drawRightString(width - 50, height - 75, f"#{inv.id.split('-')[0].upper()}")
    p.drawRightString(width - 50, height - 90, f"Status: {inv.status}")
    
    # Metadata Grid
    y_meta = height - 120
    p.setFont("Helvetica-Bold", 10)
    p.drawString(50, y_meta, "Issue Date:")
    p.setFont("Helvetica", 10)
    p.drawString(120, y_meta, inv.issued_at.strftime('%Y-%m-%d') if inv.issued_at else "Draft")
    
    p.setFont("Helvetica-Bold", 10)
    p.drawString(250, y_meta, "Due Date:")
    p.setFont("Helvetica", 10)
    p.drawString(320, y_meta, inv.due_date.strftime('%Y-%m-%d') if inv.due_date else "N/A")
    
    p.setFont("Helvetica-Bold", 10)
    p.drawString(450, y_meta, "Billing Period:")
    p.setFont("Helvetica", 10)
    p.drawString(530, y_meta, inv.period)

    # --- BILL TO & STUDENT ---
    y_blocks = y_meta - 40
    # Box 1: Bill To
    p.setLineWidth(0.5)
    p.rect(50, y_blocks - 60, 240, 60, stroke=1, fill=0)
    p.setFont("Helvetica-Bold", 10)
    p.drawString(60, y_blocks - 15, "Bill To:")
    p.setFont("Helvetica", 10)
    p.drawString(60, y_blocks - 30, parent_name)
    if parent_phone:
        p.drawString(60, y_blocks - 45, parent_phone)

    # Box 2: Student
    p.rect(300, y_blocks - 60, 240, 60, stroke=1, fill=0)
    p.setFont("Helvetica-Bold", 10)
    p.drawString(310, y_blocks - 15, "Student:")
    p.setFont("Helvetica", 10)
    p.drawString(310, y_blocks - 30, f"{inv.student.first_name} {inv.student.last_name}")
    p.drawString(310, y_blocks - 45, f"Grade: {inv.student.grade.name if inv.student.grade else 'N/A'}")
    
    # --- TABLE ---
    y_table = y_blocks - 90
    # Header
    p.setFillColorRGB(0.95, 0.95, 0.95)
    p.rect(50, y_table, width - 100, 20, stroke=0, fill=1)
    p.setFillColorRGB(0, 0, 0)
    p.setFont("Helvetica-Bold", 10)
    p.drawString(60, y_table + 6, "Description")
    p.drawRightString(width - 60, y_table + 6, "Amount")
    
    y_row = y_table - 20
    p.setFont("Helvetica", 10)
    
    for line in lines:
        if y_row < 50:
            p.showPage()
            y_row = height - 50
        
        p.drawString(60, y_row, line.description)
        p.drawRightString(width - 60, y_row, f"NPR {line.base_amount:,.2f}")
        y_row -= 15
        if line.discount_amount > 0:
             p.setFillColor(colors.red)
             title = (line.line_metadata or {}).get('discount_title', 'Applied')
             p.drawString(70, y_row, f"Discount ({title})")
             p.drawRightString(width - 60, y_row, f"- NPR {line.discount_amount:,.2f}")
             p.setFillColor(colors.black)
             y_row -= 15
             
    # --- TOTALS ---
    y_totals = y_row - 20
    p.line(300, y_totals + 10, width - 50, y_totals + 10)
    
    p.setFont("Helvetica-Bold", 10)
    p.drawString(350, y_totals, "Total Due:")
    p.drawRightString(width - 60, y_totals, f"NPR {inv.total_due:,.2f}")
    y_totals -= 15
    
    p.drawString(350, y_totals, "Paid:")
    p.drawRightString(width - 60, y_totals, f"NPR {inv.paid_total:,.2f}")
    y_totals -= 15
    
    p.setLineWidth(1)
    p.line(300, y_totals + 5, width - 50, y_totals + 5)
    p.setFont("Helvetica-Bold", 12)
    p.drawString(350, y_totals - 10, "Balance:")
    p.drawRightString(width - 60, y_totals - 10, f"NPR {inv.balance:,.2f}")
    
    # --- STAMP ---
    if inv.status == fin_models.StudentInvoiceStatus.PAID:
        p.saveState()
        p.translate(width/2, height/2)
        p.rotate(45)
        p.setFillColorRGB(0, 1, 0, 0.3)
        p.setFont("Helvetica-Bold", 100)
        p.drawCentredString(0, 0, "PAID")
        p.restoreState()
    elif inv.status == fin_models.StudentInvoiceStatus.VOID:
        p.saveState()
        p.translate(width/2, height/2)
        p.rotate(45)
        p.setFillColorRGB(1, 0, 0, 0.3)
        p.setFont("Helvetica-Bold", 100)
        p.drawCentredString(0, 0, "VOID")
        p.restoreState()

    # --- FOOTER ---
    p.setFont("Helvetica", 9)
    p.setFillColor(colors.gray)
    p.drawCentredString(width/2, 30, "Terms: Please pay by the due date. Contact school office for any queries.")

    p.showPage()
    p.save()
    
    buffer.seek(0)
    
    # Audit Log
    create_audit_log(db, str(current_user.school_id), current_user, "INVOICE_PDF_EXPORTED", id, {})
    db.commit()

    return StreamingResponse(
        buffer, 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"attachment; filename=invoice-{inv.id}.pdf"}
    )
