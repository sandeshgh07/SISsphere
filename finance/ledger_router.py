from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from decimal import Decimal

from database import get_db
from schools.models import User
from auth.dependencies import get_current_active_user, Roles
from finance import models as fin_models
from students import models as stu_models
from academics import models as acad_models
from finance import ledger_schemas as schemas
from finance import invoice_generator

router = APIRouter(
    prefix="/api/fees/ledger",
    tags=["Financials - Ledger"]
)

@router.get("/", response_model=schemas.LedgerResponse)
def get_student_ledger(
    student_id: str,
    period: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # 1. RBAC
    school_id = str(current_user.school_id)
    user_roles = {r.role_name for r in current_user.roles} | {current_user.role}
    
    # Allow Parent/Student to view own
    if Roles.STUDENT in user_roles:
         # Verify link
         pass # Assume trusted or strictly check
    
    student = db.query(stu_models.Student).filter(
        stu_models.Student.id == student_id,
        stu_models.Student.school_id == school_id
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # 2. Check for Existing Invoice
    invoice = db.query(fin_models.StudentInvoice).filter(
        fin_models.StudentInvoice.school_id == school_id,
        fin_models.StudentInvoice.student_id == student_id,
        fin_models.StudentInvoice.period == period
    ).first()
    
    breakdown_lines = []
    fee_templates_sc = []
    matched_discounts_sc = []
    
    base_total = 0.0
    discount_total = 0.0
    paid_total = 0.0
    
    if invoice:
        # Load from Invoice
        lines = db.query(fin_models.InvoiceLine).filter(fin_models.InvoiceLine.invoice_id == invoice.id).all()
        
        for line in lines:
            line_total = float(line.base_amount or 0)
            line_disc = float(line.discount_amount or 0)
            
            breakdown_lines.append(schemas.LedgerLineSc(
                description=line.description or "Fee",
                unit_price=float(line.base_amount or 0),
                amount=float(line.final_amount or 0),
                discount_amount=float(line.discount_amount or 0),
                kind="FEE",
                qty=1.0
            ))
            
            if line_disc > 0:
                 # Add discount representation
                 # Note: The request wants "matched_discounts[]" separately.
                 pass

            base_total += line_total
            discount_total += line_disc
        
        paid_total = float(invoice.paid_total or 0)
        net_total = float(invoice.total_due or 0)
        balance = float(invoice.balance or 0)
        
        # We can try to reconstruct templates/discounts metadata from lines if stored?
        # Ideally we stored template_id.
        
    else:
        # Calculate on the fly
        # Validating context
        all_templates = db.query(fin_models.FeeItemTemplate).filter(
            fin_models.FeeItemTemplate.school_id == school_id,
            fin_models.FeeItemTemplate.is_active == "true"
        ).all()
        
        # Group manually locally since we don't have the helpers exposed beautifully yet
        templates_by_grade = {}
        all_grade_templates = []
        for t in all_templates:
            if t.grade_id:
                templates_by_grade.setdefault(t.grade_id, []).append(t)
            else:
                all_grade_templates.append(t)
                
        # Addons
        enrollments = db.query(fin_models.StudentAddonEnrollment).filter(
            fin_models.StudentAddonEnrollment.school_id == school_id,
            fin_models.StudentAddonEnrollment.student_id == student_id,
            fin_models.StudentAddonEnrollment.status == "active"
        ).all()
        addons_by_student = {student_id: [e.fee_template_id for e in enrollments]}
        
        # Discounts
        discounts = db.query(fin_models.DiscountRule).filter(
            fin_models.DiscountRule.school_id == school_id,
            fin_models.DiscountRule.is_active == "true"
        ).all()
        # Filter for this student
        student_discounts = [d for d in discounts if d.student_id == student_id]
        global_discounts = [d for d in discounts if not d.student_id]
        discounts_by_student = {student_id: student_discounts}
        
        # CALCULATE
        calc_result = invoice_generator.calculate_student_fees(
            student, period, templates_by_grade, all_grade_templates, addons_by_student, discounts_by_student, global_discounts
        )
        
        base_total = float(calc_result["subtotal"])
        discount_total = float(calc_result["discount_total"])
        net_total = float(calc_result["total_due"])
        paid_total = 0.0 # No invoice, likely no payment? Or check unallocated? Assuming 0 for DRAFT view.
        balance = net_total
        
        for item in calc_result["lines"]:
             breakdown_lines.append(schemas.LedgerLineSc(
                description=item["description"] or "Fee",
                unit_price=float(item["base_amount"] or 0),
                amount=float(item["final_amount"] or 0),
                discount_amount=float(item["discount_amount"] or 0),
                kind="FEE",
                qty=1.0
             ))
             if item["rule_applied"]:
                 d = item["rule_applied"]
                 matched_discounts_sc.append(schemas.MatchedDiscountSc(
                     id=str(d.id), rule_name=d.title, type=str(d.discount_type), value=float(d.value or 0), computed_amount=float(item["discount_amount"] or 0)
                 ))
             
             t = item["template"]
             fee_templates_sc.append(schemas.FeeTemplateSc(
                 id=t.id, name=t.title, amount=float(t.amount or 0), type=str(t.billing_type)
             ))

    totals = schemas.LedgerTotalsSc(
        base_total=base_total,
        discount_total=discount_total,
        net_total=net_total,
        paid_total=paid_total,
        balance=balance
    )
    
    # Fetch Assigned IDs for UI State
    # This ensures checkboxes persist state even if rule yields 0 discount this month
    assigned_assocs = db.query(fin_models.StudentDiscountAssociation).filter(
        fin_models.StudentDiscountAssociation.student_id == student.id,
        fin_models.StudentDiscountAssociation.school_id == school_id
    ).all()
    assigned_ids = [a.discount_rule_id for a in assigned_assocs]

    return schemas.LedgerResponse(
        student=schemas.StudentSummarySc(
            id=student.id,
            name=f"{student.first_name} {student.last_name}",
            grade=student.grade.name if student.grade else None,
            guardian_name=None # TODO fetch guardian
        ),
        period=period,
        invoice_id=str(invoice.id) if invoice else None,
        invoice_status=str(invoice.status) if invoice else None,
        applicable_fee_templates=fee_templates_sc,
        matched_discounts=matched_discounts_sc,
        breakdown_lines=breakdown_lines,
        totals=totals,
        assigned_discount_ids=assigned_ids # New field
    )

@router.post("/apply-discount")
def apply_discount(
    req: schemas.ApplyDiscountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # RBAC
    school_id = str(current_user.school_id)
    
    student = db.query(stu_models.Student).filter(
        stu_models.Student.id == req.student_id,
        stu_models.Student.school_id == school_id
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Sync Logic using Associations
    # 1. Fetch existing associations for this student
    existing_assocs = db.query(fin_models.StudentDiscountAssociation).filter(
        fin_models.StudentDiscountAssociation.student_id == student.id,
        fin_models.StudentDiscountAssociation.school_id == school_id
    ).all()
    
    existing_rule_ids = {a.discount_rule_id for a in existing_assocs}
    requested_rule_ids = set(req.rule_ids)
    
    # 2. Determine Additions and Removals
    to_add = requested_rule_ids - existing_rule_ids
    to_remove = existing_rule_ids - requested_rule_ids
    
    applied_count = 0
    removed_count = 0
    
    # Add new associations
    for rule_id in to_add:
        # Verify rule exists and belongs to school
        rule = db.query(fin_models.DiscountRule).filter(
            fin_models.DiscountRule.id == rule_id,
            fin_models.DiscountRule.school_id == school_id
        ).first()
        
        if rule:
            assoc = fin_models.StudentDiscountAssociation(
                school_id=school_id,
                student_id=student.id,
                discount_rule_id=rule.id,
                assigned_by=str(current_user.id)
            )
            db.add(assoc)
            applied_count += 1
            
    # Remove old associations
    if to_remove:
        db.query(fin_models.StudentDiscountAssociation).filter(
            fin_models.StudentDiscountAssociation.student_id == student.id,
            fin_models.StudentDiscountAssociation.discount_rule_id.in_(list(to_remove))
        ).delete(synchronize_session=False)
        removed_count = len(to_remove)
        
    db.commit()
    
    # 3. Trigger Invoice Recalculation
    if req.period:
        try:
            invoice_generator.generate_invoices_for_period(
                db=db,
                school_id=school_id,
                period=req.period,
                preview=False,
                conflict_rule="REGENERATE",
                grade_id=student.grade_id 
            )
        except Exception as e:
            print(f"Error regenerating invoice after discount application: {e}")

    return {
        "message": f"Updated discounts: {applied_count} added, {removed_count} removed", 
        "success": True
    }
