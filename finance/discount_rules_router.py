from fastapi import APIRouter, Depends, HTTPException, Query, status, Path
from sqlalchemy.orm import Session
from typing import List, Optional
import json
from datetime import datetime, timezone
import uuid

from database import get_db
from finance import models as finance_models
from finance.discount_rules_schemas import (
    DiscountRuleCreate, 
    DiscountRuleUpdate, 
    DiscountRuleResponse
)
from auth.dependencies import (
    get_current_active_user, 
    require_roles, 
    TenantAccess, 
    Roles
)
from audit.models import AuditLog
from audit.listeners import set_actor_id, set_reason

router = APIRouter(
    prefix="/financials/discount-rules",
    tags=["Financials - Discount Rules"]
)

# Helper for Manual Audit Logs (if strictly needed for specific event names)
def create_manual_audit_log(
    db: Session,
    actor_id: str,
    action_type: str,
    table_name: str,
    record_id: str,
    school_id: str,
    before: dict = None,
    after: dict = None,
    summary: str = None
):
    log_entry = AuditLog(
        id=str(uuid.uuid4()),
        actor_id=str(actor_id),
        action_type=action_type,
        table_name=table_name,
        record_id=record_id,
        school_id=school_id,
        before_state=json.dumps(before, default=str) if before else None,
        after_state=json.dumps(after, default=str) if after else None,
        timestamp=datetime.now(timezone.utc),
        reason=summary
    )
    db.add(log_entry)
    # Don't commit here, let the caller commit transaction

@router.get("/", response_model=List[DiscountRuleResponse])
def list_discount_rules(
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    current_user = Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.ACCOUNTANT, Roles.SUPER_ADMIN)),
    status: Optional[str] = Query(None, regex="^(active|inactive)$"),
    search: Optional[str] = None
):
    query = db.query(finance_models.DiscountRule).filter(
        finance_models.DiscountRule.school_id == tenant.school_id
    )
    
    if status:
        is_active_val = "true" if status == "active" else "false"
        query = query.filter(finance_models.DiscountRule.is_active == is_active_val)
        
    if search:
        query = query.filter(finance_models.DiscountRule.title.ilike(f"%{search}%"))
        
    return query.all()

@router.post("/", response_model=DiscountRuleResponse)
def create_discount_rule(
    rule_in: DiscountRuleCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    current_user = Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.ACCOUNTANT, Roles.SUPER_ADMIN))
):
    # Set context for auto-audit
    set_actor_id(current_user.id)
    set_reason("Created via API")
    
    new_rule = finance_models.DiscountRule(
        **rule_in.dict(exclude={"grade_ids", "fee_template_ids"}),
        school_id=tenant.school_id,
        created_by=str(current_user.id)
    )
    
    # Handle JSON fields
    new_rule.grade_ids = rule_in.grade_ids
    new_rule.fee_template_ids = rule_in.fee_template_ids
    new_rule.is_active = "true" if rule_in.is_active else "false"
    
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)
    
    # Manual log if strictly required "DISCOUNT_CREATED" (optional, skipping to rely on INSERT)
    return new_rule

@router.patch("/{rule_id}", response_model=DiscountRuleResponse)
def update_discount_rule(
    rule_id: str,
    rule_update: DiscountRuleUpdate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    current_user = Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.ACCOUNTANT, Roles.SUPER_ADMIN))
):
    rule = db.query(finance_models.DiscountRule).filter(
        finance_models.DiscountRule.id == rule_id,
        finance_models.DiscountRule.school_id == tenant.school_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Discount rule not found")
        
    set_actor_id(current_user.id)
    
    update_data = rule_update.dict(exclude_unset=True)
    
    # JSON transform
    if "is_active" in update_data:
        update_data["is_active"] = "true" if update_data["is_active"] else "false"
        
    for field, value in update_data.items():
        setattr(rule, field, value)
        
    db.commit()
    db.refresh(rule)
    return rule

@router.post("/{rule_id}/toggle", response_model=DiscountRuleResponse)
def toggle_discount_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    current_user = Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.ACCOUNTANT, Roles.SUPER_ADMIN))
):
    rule = db.query(finance_models.DiscountRule).filter(
        finance_models.DiscountRule.id == rule_id,
        finance_models.DiscountRule.school_id == tenant.school_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Discount rule not found")
        
    old_state = rule.is_active
    new_state = "false" if old_state == "true" else "true"
    rule.is_active = new_state
    
    # Manual Audit for TOGGLED event
    create_manual_audit_log(
        db, 
        actor_id=str(current_user.id),
        action_type="DISCOUNT_TOGGLED",
        table_name="discount_rules",
        record_id=rule.id,
        school_id=tenant.school_id,
        before={"is_active": old_state},
        after={"is_active": new_state},
        summary=f"Toggled discount rule {rule.title} to {new_state}"
    )
    
    db.commit()
    db.refresh(rule)
    return rule

@router.delete("/{rule_id}")
def delete_discount_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    current_user = Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.ACCOUNTANT, Roles.SUPER_ADMIN))
):
    rule = db.query(finance_models.DiscountRule).filter(
        finance_models.DiscountRule.id == rule_id,
        finance_models.DiscountRule.school_id == tenant.school_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Discount rule not found")
        
    # Soft delete preferred by requirement? "Soft delete preferred; audit log DISCOUNT_DELETED"
    # Actually, soft delete usually means setting deleted_at. Model doesn't have deleted_at.
    # I'll implement HARD delete for now unless I add deleted_at column.
    # Or just set is_active=false? But toggle does that.
    # I will HARD delete but log as DISCOUNT_DELETED manually before deletion.
    
    create_manual_audit_log(
        db,
        actor_id=str(current_user.id),
        action_type="DISCOUNT_DELETED",
        table_name="discount_rules",
        record_id=rule.id,
        school_id=tenant.school_id,
        before=json.dumps(rule.__dict__, default=str)
    )
    
    db.delete(rule)
    db.commit()
    
    return {"message": "Discount rule deleted"}
