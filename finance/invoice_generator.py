"""
Invoice Generation Service

Generates student invoices automatically based on fee templates and discount rules.
Designed for batch operations with idempotency and tenant isolation.
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from decimal import Decimal
import logging

from finance import models as finance_models
from students import models as student_models
from academics import models as academic_models

logger = logging.getLogger(__name__)


def generate_invoices_for_period(db: Session, school_id: str, period: str) -> Dict[str, Any]:
    """
    Generate invoices for all students in a school for a given period.
    
    This is idempotent - running twice won't create duplicate invoices due to
    the unique constraint on (school_id, student_id, period).
    
    Args:
        db: SQLAlchemy session
        school_id: School ID (tenant scope)
        period: Billing period in YYYY-MM format
        
    Returns:
        Dict with counts: created, updated, errors
    """
    result = {
        "created": 0,
        "updated": 0,
        "errors": []
    }
    
    try:
        # Step 1: Get all active students for the school
        students = db.query(student_models.Student).filter(
            student_models.Student.school_id == school_id,
            student_models.Student.is_active == True
        ).all()
        
        if not students:
            logger.info(f"No active students for school {school_id}")
            return result
        
        # Step 2: Get all active fee templates for the school
        templates = db.query(finance_models.FeeItemTemplate).filter(
            finance_models.FeeItemTemplate.school_id == school_id,
            finance_models.FeeItemTemplate.is_active == "true"
        ).all()
        
        if not templates:
            logger.info(f"No active fee templates for school {school_id}")
            return result
        
        # Build template lookup by grade
        templates_by_grade = _build_templates_by_grade(templates)
        all_grade_templates = [t for t in templates if t.grade_id is None]
        
        # Step 3: Get all add-on enrollments
        addon_enrollments = db.query(finance_models.StudentAddonEnrollment).filter(
            finance_models.StudentAddonEnrollment.school_id == school_id,
            finance_models.StudentAddonEnrollment.status == "active"
        ).all()
        addons_by_student = _build_addons_by_student(addon_enrollments)
        
        # Step 4: Get all active discount rules
        discounts = db.query(finance_models.DiscountRule).filter(
            finance_models.DiscountRule.school_id == school_id,
            finance_models.DiscountRule.is_active == "true"
        ).all()
        discounts_by_student = _build_discounts_by_student(discounts)
        global_discounts = [d for d in discounts if d.student_id is None]
        
        # Step 5: Generate invoice for each student
        for student in students:
            try:
                invoice_result = _generate_student_invoice(
                    db=db,
                    school_id=school_id,
                    student=student,
                    period=period,
                    templates_by_grade=templates_by_grade,
                    all_grade_templates=all_grade_templates,
                    addons_by_student=addons_by_student,
                    discounts_by_student=discounts_by_student,
                    global_discounts=global_discounts
                )
                
                if invoice_result == "created":
                    result["created"] += 1
                elif invoice_result == "updated":
                    result["updated"] += 1
                    
            except Exception as e:
                error_msg = f"Student {student.id}: {str(e)}"
                logger.error(f"Invoice generation error: {error_msg}")
                result["errors"].append(error_msg)
        
        db.commit()
        logger.info(f"Invoice generation complete for {school_id}/{period}: {result}")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Invoice generation failed for {school_id}/{period}: {e}")
        raise
    
    return result


def _build_templates_by_grade(templates: List[finance_models.FeeItemTemplate]) -> Dict[str, List]:
    """Build lookup of templates by grade_id"""
    result = {}
    for t in templates:
        if t.grade_id:
            if t.grade_id not in result:
                result[t.grade_id] = []
            result[t.grade_id].append(t)
    return result


def _build_addons_by_student(enrollments: List[finance_models.StudentAddonEnrollment]) -> Dict[str, List[str]]:
    """Build lookup of addon template IDs by student_id"""
    result = {}
    for e in enrollments:
        if e.student_id not in result:
            result[e.student_id] = []
        result[e.student_id].append(e.fee_template_id)
    return result


def _build_discounts_by_student(discounts: List[finance_models.DiscountRule]) -> Dict[str, List]:
    """Build lookup of discounts by student_id"""
    result = {}
    for d in discounts:
        if d.student_id:
            if d.student_id not in result:
                result[d.student_id] = []
            result[d.student_id].append(d)
    return result


def _generate_student_invoice(
    db: Session,
    school_id: str,
    student: student_models.Student,
    period: str,
    templates_by_grade: Dict,
    all_grade_templates: List,
    addons_by_student: Dict,
    discounts_by_student: Dict,
    global_discounts: List
) -> str:
    """
    Generate or update invoice for a single student.
    
    Returns "created", "updated", or "skipped"
    """
    # Check if invoice already exists
    existing_invoice = db.query(finance_models.StudentInvoice).filter(
        finance_models.StudentInvoice.school_id == school_id,
        finance_models.StudentInvoice.student_id == student.id,
        finance_models.StudentInvoice.period == period
    ).first()
    
    is_new = existing_invoice is None
    
    if is_new:
        invoice = finance_models.StudentInvoice(
            school_id=school_id,
            student_id=student.id,
            period=period,
            status=finance_models.StudentInvoiceStatus.DRAFT
        )
        db.add(invoice)
        db.flush()  # Get the ID
    else:
        invoice = existing_invoice
        # Delete existing lines to regenerate
        db.query(finance_models.InvoiceLine).filter(
            finance_models.InvoiceLine.invoice_id == invoice.id
        ).delete()
    
    # Get applicable templates for this student
    applicable_templates = _get_applicable_templates(
        student=student,
        period=period,
        templates_by_grade=templates_by_grade,
        all_grade_templates=all_grade_templates,
        addons_by_student=addons_by_student
    )
    
    # Get applicable discounts
    student_discounts = discounts_by_student.get(student.id, [])
    all_discounts = student_discounts + global_discounts
    
    # Create invoice lines
    subtotal = Decimal("0")
    discount_total = Decimal("0")
    
    for template in applicable_templates:
        base_amount = Decimal(str(template.amount))
        discount_amount = _calculate_discount(template, base_amount, all_discounts)
        final_amount = base_amount - discount_amount
        
        line = finance_models.InvoiceLine(
            school_id=school_id,
            invoice_id=invoice.id,
            fee_template_id=template.id,
            description=template.title,
            base_amount=base_amount,
            discount_amount=discount_amount,
            final_amount=final_amount,
            line_metadata={}
        )
        db.add(line)
        
        subtotal += base_amount
        discount_total += discount_amount
    
    # Update invoice totals
    invoice.subtotal = subtotal
    invoice.discount_total = discount_total
    invoice.total_due = subtotal - discount_total
    invoice.balance = invoice.total_due - Decimal(str(invoice.paid_total or 0))
    
    return "created" if is_new else "updated"


def _get_applicable_templates(
    student: student_models.Student,
    period: str,
    templates_by_grade: Dict,
    all_grade_templates: List,
    addons_by_student: Dict
) -> List[finance_models.FeeItemTemplate]:
    """
    Determine which fee templates apply to this student for the period.
    """
    applicable = []
    
    # Get templates for student's grade
    grade_templates = templates_by_grade.get(student.grade_id, [])
    
    # Combine with all-grade templates
    all_templates = grade_templates + all_grade_templates
    
    # Get student's addon enrollments
    enrolled_addons = set(addons_by_student.get(student.id, []))
    
    for template in all_templates:
        # Skip if period is outside the template's range
        if template.start_period and period < template.start_period:
            continue
        if template.end_period and period > template.end_period:
            continue
        
        # For optional addons, check enrollment
        if template.is_optional_addon == "true":
            if template.id not in enrolled_addons:
                continue
        
        # Check recurrence - for now, apply monthly templates every month
        # Quarterly and yearly logic can be enhanced later
        if template.recurrence:
            if template.recurrence == finance_models.RecurrenceType.QUARTERLY:
                month = int(period.split("-")[1])
                if month not in [1, 4, 7, 10]:  # Quarter boundaries
                    continue
            elif template.recurrence == finance_models.RecurrenceType.YEARLY:
                month = int(period.split("-")[1])
                if month != 1:  # Only January for yearly
                    continue
        
        applicable.append(template)
    
    return applicable


def _calculate_discount(
    template: finance_models.FeeItemTemplate,
    base_amount: Decimal,
    discounts: List[finance_models.DiscountRule]
) -> Decimal:
    """
    Calculate total discount for a fee template.
    Only one discount per template (highest value) is applied for now.
    """
    best_discount = Decimal("0")
    
    for discount in discounts:
        # Check if discount applies to this template
        if discount.applies_to_fee_template_id:
            if discount.applies_to_fee_template_id != template.id:
                continue
        
        # Calculate discount amount
        if discount.discount_type == finance_models.DiscountType.FULL_WAIVER:
            discount_amount = base_amount
        elif discount.discount_type == finance_models.DiscountType.PERCENT:
            percent = Decimal(str(discount.value or 0)) / Decimal("100")
            discount_amount = base_amount * percent
        elif discount.discount_type == finance_models.DiscountType.FIXED_AMOUNT:
            discount_amount = min(Decimal(str(discount.value or 0)), base_amount)
        else:
            discount_amount = Decimal("0")
        
        best_discount = max(best_discount, discount_amount)
    
    return best_discount
