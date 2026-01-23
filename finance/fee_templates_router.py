"""
Fee Templates API Router

Endpoints for managing fee templates, student add-on enrollments, 
discount rules, and viewing auto-generated invoices.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from auth.dependencies import get_db, require_roles, TenantAccess, Roles, get_current_user
from finance import models as finance_models
from finance.fee_templates_schemas import (
    FeeTemplateCreate, FeeTemplateUpdate, FeeTemplateResponse,
    StudentAddonCreate, StudentAddonUpdate, StudentAddonResponse,
    DiscountRuleCreate, DiscountRuleUpdate, DiscountRuleResponse,
    StudentInvoiceResponse, InvoiceGenerateRequest, InvoiceSummary,
    InvoiceLineResponse
)
from schools import models as school_models
from students import models as student_models
from academics import models as academic_models
from auth.subscription import require_active_subscription
from datetime import datetime, timezone

router = APIRouter(prefix="/fees", tags=["Fee Templates"])


# ============================================
# Fee Template CRUD
# ============================================

@router.get("/templates", response_model=List[FeeTemplateResponse])
def list_fee_templates(
    grade_id: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(
        Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.ACCOUNTANT
    )),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """List all fee templates for the school"""
    query = db.query(finance_models.FeeItemTemplate).filter(
        finance_models.FeeItemTemplate.school_id == str(tenant.school_id)
    )
    
    if active_only:
        query = query.filter(finance_models.FeeItemTemplate.is_active == "true")
    
    if grade_id:
        # Include templates for specific grade OR all grades (NULL)
        query = query.filter(
            (finance_models.FeeItemTemplate.grade_id == grade_id) |
            (finance_models.FeeItemTemplate.grade_id.is_(None))
        )
    
    return query.order_by(finance_models.FeeItemTemplate.title).all()


@router.post("/templates", response_model=FeeTemplateResponse, dependencies=[Depends(require_active_subscription())])
def create_fee_template(
    data: FeeTemplateCreate,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """Create a new fee template"""
    # Validate recurrence is set for recurring fees
    if data.billing_type == "RECURRING" and not data.recurrence:
        raise HTTPException(status_code=400, detail="Recurrence is required for recurring fees")
    
    # Validate grade exists if specified
    if data.grade_id:
        grade = db.query(academic_models.Grade).filter(
            academic_models.Grade.id == data.grade_id,
            academic_models.Grade.school_id == str(tenant.school_id)
        ).first()
        if not grade:
            raise HTTPException(status_code=404, detail="Grade not found")
    
    template = finance_models.FeeItemTemplate(
        school_id=str(tenant.school_id),
        title=data.title,
        amount=data.amount,
        currency=data.currency or "NPR",
        grade_id=data.grade_id,
        billing_type=data.billing_type,
        recurrence=data.recurrence,
        start_period=data.start_period,
        end_period=data.end_period,
        is_optional_addon="true" if data.is_optional_addon else "false",
        is_active="true",
        created_by=str(user.id)
    )
    
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/templates/{template_id}", response_model=FeeTemplateResponse)
def get_fee_template(
    template_id: str,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(
        Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.ACCOUNTANT
    )),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """Get a single fee template by ID"""
    template = db.query(finance_models.FeeItemTemplate).filter(
        finance_models.FeeItemTemplate.id == template_id,
        finance_models.FeeItemTemplate.school_id == str(tenant.school_id)
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Fee template not found")
    return template


@router.put("/templates/{template_id}", response_model=FeeTemplateResponse, dependencies=[Depends(require_active_subscription())])
def update_fee_template(
    template_id: str,
    data: FeeTemplateUpdate,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """Update an existing fee template"""
    template = db.query(finance_models.FeeItemTemplate).filter(
        finance_models.FeeItemTemplate.id == template_id,
        finance_models.FeeItemTemplate.school_id == str(tenant.school_id)
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Fee template not found")
    
    # Apply updates
    if data.title is not None:
        template.title = data.title
    if data.amount is not None:
        template.amount = data.amount
    if data.currency is not None:
        template.currency = data.currency
    if data.grade_id is not None:
        # Validate grade
        if data.grade_id:
            grade = db.query(academic_models.Grade).filter(
                academic_models.Grade.id == data.grade_id,
                academic_models.Grade.school_id == str(tenant.school_id)
            ).first()
            if not grade:
                raise HTTPException(status_code=404, detail="Grade not found")
        template.grade_id = data.grade_id if data.grade_id else None
    if data.billing_type is not None:
        template.billing_type = data.billing_type
    if data.recurrence is not None:
        template.recurrence = data.recurrence
    if data.start_period is not None:
        template.start_period = data.start_period
    if data.end_period is not None:
        template.end_period = data.end_period
    if data.is_optional_addon is not None:
        template.is_optional_addon = "true" if data.is_optional_addon else "false"
    if data.is_active is not None:
        template.is_active = "true" if data.is_active else "false"
    
    db.commit()
    db.refresh(template)
    return template


@router.delete("/templates/{template_id}", dependencies=[Depends(require_active_subscription())])
def delete_fee_template(
    template_id: str,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """Soft-delete a fee template (set is_active=false)"""
    template = db.query(finance_models.FeeItemTemplate).filter(
        finance_models.FeeItemTemplate.id == template_id,
        finance_models.FeeItemTemplate.school_id == str(tenant.school_id)
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Fee template not found")
    
    template.is_active = "false"
    db.commit()
    return {"message": "Fee template deactivated"}


# ============================================
# Discount Rules CRUD
# ============================================

@router.get("/discounts", response_model=List[DiscountRuleResponse])
def list_discount_rules(
    student_id: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(
        Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.ACCOUNTANT
    )),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """List all discount rules for the school"""
    query = db.query(finance_models.DiscountRule).filter(
        finance_models.DiscountRule.school_id == str(tenant.school_id)
    )
    
    if active_only:
        query = query.filter(finance_models.DiscountRule.is_active == "true")
    
    if student_id:
        query = query.filter(finance_models.DiscountRule.student_id == student_id)
    
    return query.order_by(finance_models.DiscountRule.title).all()


@router.post("/discounts", response_model=DiscountRuleResponse, dependencies=[Depends(require_active_subscription())])
def create_discount_rule(
    data: DiscountRuleCreate,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """Create a new discount rule"""
    # Validate value for non-FULL_WAIVER types
    if data.discount_type in ["PERCENT", "FIXED_AMOUNT"] and data.value is None:
        raise HTTPException(status_code=400, detail="Value is required for percent and fixed amount discounts")
    
    # Validate percent is <= 100
    if data.discount_type == "PERCENT" and data.value is not None and data.value > 100:
        raise HTTPException(status_code=400, detail="Percent discount cannot exceed 100%")
    
    # Validate student exists
    if data.student_id:
        student = db.query(student_models.Student).filter(
            student_models.Student.id == data.student_id,
            student_models.Student.school_id == str(tenant.school_id)
        ).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
    
    # Validate fee template exists
    if data.applies_to_fee_template_id:
        template = db.query(finance_models.FeeItemTemplate).filter(
            finance_models.FeeItemTemplate.id == data.applies_to_fee_template_id,
            finance_models.FeeItemTemplate.school_id == str(tenant.school_id)
        ).first()
        if not template:
            raise HTTPException(status_code=404, detail="Fee template not found")
    
    discount = finance_models.DiscountRule(
        school_id=str(tenant.school_id),
        title=data.title,
        discount_type=data.discount_type,
        value=data.value,
        applies_to_fee_template_id=data.applies_to_fee_template_id,
        scope_type=finance_models.DiscountScope.STUDENT_SPECIFIC,
        student_id=data.student_id,
        billing_type=data.billing_type,
        recurrence=data.recurrence,
        start_period=data.start_period,
        end_period=data.end_period,
        is_active="true",
        created_by=str(user.id)
    )
    
    db.add(discount)
    db.commit()
    db.refresh(discount)
    return discount


@router.put("/discounts/{discount_id}", response_model=DiscountRuleResponse, dependencies=[Depends(require_active_subscription())])
def update_discount_rule(
    discount_id: str,
    data: DiscountRuleUpdate,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """Update an existing discount rule"""
    discount = db.query(finance_models.DiscountRule).filter(
        finance_models.DiscountRule.id == discount_id,
        finance_models.DiscountRule.school_id == str(tenant.school_id)
    ).first()
    
    if not discount:
        raise HTTPException(status_code=404, detail="Discount rule not found")
    
    # Apply updates
    if data.title is not None:
        discount.title = data.title
    if data.discount_type is not None:
        discount.discount_type = data.discount_type
    if data.value is not None:
        discount.value = data.value
    if data.applies_to_fee_template_id is not None:
        discount.applies_to_fee_template_id = data.applies_to_fee_template_id if data.applies_to_fee_template_id else None
    if data.billing_type is not None:
        discount.billing_type = data.billing_type
    if data.recurrence is not None:
        discount.recurrence = data.recurrence
    if data.start_period is not None:
        discount.start_period = data.start_period
    if data.end_period is not None:
        discount.end_period = data.end_period
    if data.is_active is not None:
        discount.is_active = "true" if data.is_active else "false"
    
    db.commit()
    db.refresh(discount)
    return discount


@router.delete("/discounts/{discount_id}", dependencies=[Depends(require_active_subscription())])
def delete_discount_rule(
    discount_id: str,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """Soft-delete a discount rule"""
    discount = db.query(finance_models.DiscountRule).filter(
        finance_models.DiscountRule.id == discount_id,
        finance_models.DiscountRule.school_id == str(tenant.school_id)
    ).first()
    
    if not discount:
        raise HTTPException(status_code=404, detail="Discount rule not found")
    
    discount.is_active = "false"
    db.commit()
    return {"message": "Discount rule deactivated"}


# ============================================
# Student Invoices (Read-only for now)
# ============================================

@router.get("/invoices", response_model=List[StudentInvoiceResponse])
def list_invoices(
    period: Optional[str] = None,
    student_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(
        Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.ACCOUNTANT, Roles.PARENT
    )),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """List student invoices with optional filters"""
    query = db.query(finance_models.StudentInvoice).filter(
        finance_models.StudentInvoice.school_id == str(tenant.school_id)
    )
    
    # Parents can only see their children's invoices
    if user.role == Roles.PARENT:
        # Get students linked to this parent
        from students.models import ParentStudentLink
        links = db.query(ParentStudentLink).filter(
            ParentStudentLink.parent_id == str(user.id),
            ParentStudentLink.school_id == str(tenant.school_id)
        ).all()
        child_ids = [link.student_id for link in links]
        query = query.filter(finance_models.StudentInvoice.student_id.in_(child_ids))
    
    if period:
        query = query.filter(finance_models.StudentInvoice.period == period)
    if student_id:
        query = query.filter(finance_models.StudentInvoice.student_id == student_id)
    if status:
        query = query.filter(finance_models.StudentInvoice.status == status)
    
    return query.order_by(finance_models.StudentInvoice.period.desc()).limit(100).all()


@router.get("/invoices/{invoice_id}", response_model=StudentInvoiceResponse)
def get_invoice_detail(
    invoice_id: str,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(
        Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.ACCOUNTANT, Roles.PARENT
    )),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """Get invoice details with line items"""
    invoice = db.query(finance_models.StudentInvoice).filter(
        finance_models.StudentInvoice.id == invoice_id,
        finance_models.StudentInvoice.school_id == str(tenant.school_id)
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Parents can only see their children's invoices
    if user.role == Roles.PARENT:
        from students.models import ParentStudentLink
        link = db.query(ParentStudentLink).filter(
            ParentStudentLink.parent_id == str(user.id),
            ParentStudentLink.student_id == invoice.student_id,
            ParentStudentLink.school_id == str(tenant.school_id)
        ).first()
        if not link:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Get line items
    lines = db.query(finance_models.InvoiceLine).filter(
        finance_models.InvoiceLine.invoice_id == invoice_id
    ).all()
    
    # Build response with lines
    response = StudentInvoiceResponse.model_validate(invoice)
    response.lines = [InvoiceLineResponse.model_validate(line) for line in lines]
    return response


@router.get("/invoices/summary", response_model=InvoiceSummary)
def get_invoice_summary(
    period: Optional[str] = None,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(
        Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.ACCOUNTANT
    )),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """Get invoice summary statistics"""
    from sqlalchemy import func
    
    query = db.query(finance_models.StudentInvoice).filter(
        finance_models.StudentInvoice.school_id == str(tenant.school_id)
    )
    
    if period:
        query = query.filter(finance_models.StudentInvoice.period == period)
    
    invoices = query.all()
    
    total_due = sum(float(inv.total_due or 0) for inv in invoices)
    total_paid = sum(float(inv.paid_total or 0) for inv in invoices)
    
    by_status = {}
    for inv in invoices:
        status_str = str(inv.status.value) if hasattr(inv.status, 'value') else str(inv.status)
        by_status[status_str] = by_status.get(status_str, 0) + 1
    
    return InvoiceSummary(
        total_invoices=len(invoices),
        total_due=total_due,
        total_paid=total_paid,
        total_outstanding=total_due - total_paid,
        by_status=by_status
    )


# ============================================
# Invoice Generation (Admin only)
# ============================================

@router.post("/invoices/generate", dependencies=[Depends(require_active_subscription())])
def generate_invoices(
    request: InvoiceGenerateRequest,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """
    Trigger invoice generation for a specific period.
    This is idempotent - running twice won't duplicate invoices.
    """
    from finance.invoice_generator import generate_invoices_for_period
    
    try:
        result = generate_invoices_for_period(db, str(tenant.school_id), request.period)
        return {
            "message": "Invoice generation completed",
            "period": request.period,
            "invoices_created": result.get("created", 0),
            "invoices_updated": result.get("updated", 0),
            "errors": result.get("errors", [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invoice generation failed: {str(e)}")
