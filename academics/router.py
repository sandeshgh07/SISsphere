from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from database import SessionLocal
from auth.dependencies import get_db, get_current_user, require_roles, TenantAccess, Roles
from students import models as student_models
from academics import models as academic_models
from academics import schemas as academic_schemas
from schools import models as school_models
from pydantic import BaseModel
import uuid
from audit.models import AuditLog
from audit.listeners import set_reason
import json
from datetime import datetime, timezone, date
from auth.subscription import require_subscription_feature

router = APIRouter(prefix="/academics", tags=["academics"])

# --- NEW ACADEMIC SETUP HUB ENDPOINTS ---

@router.get("/overview", response_model=academic_schemas.AcademicsOverview)
def get_academics_overview(
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    school_id = str(tenant.school_id)
    
    # Active Year
    active_year = db.query(academic_models.AcademicYear).filter(
        academic_models.AcademicYear.school_id == school_id,
        academic_models.AcademicYear.is_active == True
    ).first()
    
    # Current Term
    current_term = None
    if active_year:
        today = date.today()
        current_term = db.query(academic_models.Term).filter(
            academic_models.Term.school_id == school_id,
            academic_models.Term.academic_year_id == active_year.id,
            academic_models.Term.start_date <= today,
            academic_models.Term.end_date >= today
        ).first()
        
    # Counts
    grades_count = db.query(academic_models.Grade).filter(academic_models.Grade.school_id == school_id).count()
    sections_count = db.query(academic_models.Section).filter(academic_models.Section.school_id == school_id).count()
    subjects_count = db.query(academic_models.Subject).filter(academic_models.Subject.school_id == school_id).count()
    
    # Policy Summary
    policy_summary = "Not Configured"
    if active_year:
        policy = db.query(academic_models.GradingPolicy).filter(
            academic_models.GradingPolicy.school_id == school_id,
            academic_models.GradingPolicy.academic_year_id == active_year.id
        ).first()
        if policy:
             policy_summary = f"GPA Scale: {policy.gpa_scale}, Pass: {policy.pass_mark}%"
    
    # Alerts (Mock logic for v1, or basic queries)
    alerts = []
    # Example: Check for missing grades in published terms?
    # Keeping it simple for now
    
    return {
        "active_year": active_year,
        "current_term": current_term,
        "grades_count": grades_count,
        "sections_count": sections_count,
        "subjects_count": subjects_count,
        "policy_summary": policy_summary,
        "alerts": alerts
    }

# Academic Years
@router.post("/academic-years", response_model=academic_schemas.AcademicYearResponse)
def create_academic_year(
    ay: academic_schemas.AcademicYearCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER))
):
    # Check if active is being set, unset others
    if ay.is_active:
        db.query(academic_models.AcademicYear).filter(
            academic_models.AcademicYear.school_id == str(tenant.school_id)
        ).update({"is_active": False})
    
    new_ay = academic_models.AcademicYear(
        name=ay.name,
        start_date=ay.start_date,
        end_date=ay.end_date,
        is_active=ay.is_active,
        is_closed=ay.is_closed,
        school_id=str(tenant.school_id)
    )
    db.add(new_ay)
    db.commit()
    db.refresh(new_ay)
    return new_ay

@router.get("/academic-years", response_model=List[academic_schemas.AcademicYearResponse])
def list_academic_years(
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    return db.query(academic_models.AcademicYear).filter(
        academic_models.AcademicYear.school_id == str(tenant.school_id)
    ).order_by(academic_models.AcademicYear.start_date.desc()).all()

@router.patch("/academic-years/{ay_id}/set-active")
def set_active_year(
    ay_id: str,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    # Deactivate all
    db.query(academic_models.AcademicYear).filter(
        academic_models.AcademicYear.school_id == str(tenant.school_id)
    ).update({"is_active": False})
    
    # Activate target
    ay = db.query(academic_models.AcademicYear).filter(
        academic_models.AcademicYear.id == ay_id,
        academic_models.AcademicYear.school_id == str(tenant.school_id)
    ).first()
    if not ay:
        raise HTTPException(status_code=404, detail="Academic Year not found")
        
    ay.is_active = True
    db.commit()
    return {"message": "Active academic year updated"}

# Terms
@router.post("/terms", response_model=academic_schemas.TermResponse)
def create_term(
    term: academic_schemas.TermCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER))
):
    # Verify AY exists
    ay = db.query(academic_models.AcademicYear).filter(
        academic_models.AcademicYear.id == term.academic_year_id,
        academic_models.AcademicYear.school_id == str(tenant.school_id)
    ).first()
    if not ay:
        raise HTTPException(status_code=404, detail="Academic Year not found")

    new_term = academic_models.Term(
        name=term.name,
        academic_year_id=term.academic_year_id,
        start_date=term.start_date,
        end_date=term.end_date,
        weightage=term.weightage,
        school_id=str(tenant.school_id)
    )
    db.add(new_term)
    db.commit()
    db.refresh(new_term)
    return new_term

@router.get("/terms", response_model=List[academic_schemas.TermResponse])
def list_terms(
    academic_year_id: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    query = db.query(academic_models.Term).filter(academic_models.Term.school_id == str(tenant.school_id))
    if academic_year_id:
        query = query.filter(academic_models.Term.academic_year_id == academic_year_id)
    
    return query.order_by(academic_models.Term.start_date).all()

@router.patch("/terms/{term_id}", response_model=academic_schemas.TermResponse)
def update_term(
    term_id: str,
    update: academic_schemas.TermUpdate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    term = db.query(academic_models.Term).filter(
        academic_models.Term.id == term_id,
        academic_models.Term.school_id == str(tenant.school_id)
    ).first()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(term, field, value)
    db.commit()
    db.refresh(term)
    return term

# Grading Policy
@router.post("/grading-policies", response_model=academic_schemas.GradingPolicyResponse)
def create_grading_policy(
    policy: academic_schemas.GradingPolicyCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    # Check if policy exists for this year
    existing = db.query(academic_models.GradingPolicy).filter(
        academic_models.GradingPolicy.academic_year_id == policy.academic_year_id,
        academic_models.GradingPolicy.school_id == str(tenant.school_id)
    ).first()
    if existing:
        # Update existing?
        existing.gpa_scale = policy.gpa_scale
        existing.grading_structure = policy.grading_structure
        existing.pass_mark = policy.pass_mark
        existing.full_mark = policy.full_mark
        existing.weight_rules = policy.weight_rules
        db.commit()
        db.refresh(existing)
        return existing
        
    new_policy = academic_models.GradingPolicy(
        academic_year_id=policy.academic_year_id,
        gpa_scale=policy.gpa_scale,
        grading_structure=policy.grading_structure,
        pass_mark=policy.pass_mark,
        full_mark=policy.full_mark,
        weight_rules=policy.weight_rules,
        school_id=str(tenant.school_id)
    )
    db.add(new_policy)
    db.commit()
    db.refresh(new_policy)
    return new_policy

@router.get("/grading-policies", response_model=List[academic_schemas.GradingPolicyResponse])
def list_grading_policies(
    academic_year_id: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    query = db.query(academic_models.GradingPolicy).filter(
        academic_models.GradingPolicy.school_id == str(tenant.school_id)
    )
    if academic_year_id:
        query = query.filter(academic_models.GradingPolicy.academic_year_id == academic_year_id)
    return query.all()



# Promotion Rules
@router.post("/promotion-rules", response_model=academic_schemas.PromotionRuleResponse)
def create_promotion_rules(
    rules: academic_schemas.PromotionRuleCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    # Check existing
    existing = db.query(academic_models.PromotionRule).filter(
        academic_models.PromotionRule.academic_year_id == rules.academic_year_id,
        academic_models.PromotionRule.school_id == str(tenant.school_id)
    ).first()

    if existing:
        existing.rules = rules.rules
        db.commit()
        db.refresh(existing)
        return existing
    
    new_rules = academic_models.PromotionRule(
        academic_year_id=rules.academic_year_id,
        rules=rules.rules,
        school_id=str(tenant.school_id)
    )
    db.add(new_rules)
    db.commit()
    db.refresh(new_rules)
    return new_rules

@router.get("/promotion-rules", response_model=List[academic_schemas.PromotionRuleResponse])
def list_promotion_rules(
    academic_year_id: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    query = db.query(academic_models.PromotionRule).filter(
        academic_models.PromotionRule.school_id == str(tenant.school_id)
    )
    if academic_year_id:
        query = query.filter(academic_models.PromotionRule.academic_year_id == academic_year_id)
    return query.all()

@router.post("/promotions/execute")
def execute_promotion(
    academic_year_id: str,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    # Logic to promote students based on rules
    # This is complex, will implement placeholder for now as per plan
    return {"message": "Promotion execution started (Logic pending implementation)"}

# Period Structures
# --- FLEXIBLE PERIOD STRUCTURE ENDPOINTS ---

# 1. Schedule Templates
@router.post("/schedule-templates", response_model=academic_schemas.ScheduleTemplateResponse)
def create_schedule_template(
    template: academic_schemas.ScheduleTemplateCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    # Validate structure
    for slot in template.structure:
        if "label" not in slot or "start" not in slot or "end" not in slot or "type" not in slot:
             raise HTTPException(status_code=400, detail="Invalid structure. Slots must have label, start, end, type.")

    new_tpl = academic_models.ScheduleTemplate(
        name=template.name,
        structure=template.structure,
        school_id=str(tenant.school_id)
    )
    
    # Audit
    audit = AuditLog(
        actor_id=str(user.id),
        action_type="CREATE_TEMPLATE",
        table_name="schedule_templates",
        school_id=str(tenant.school_id),
        metadata=json.dumps({"name": template.name}),
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit)
    
    db.add(new_tpl)
    db.commit()
    db.refresh(new_tpl)
    return new_tpl

@router.put("/schedule-templates/{template_id}", response_model=academic_schemas.ScheduleTemplateResponse)
def update_schedule_template(
    template_id: str,
    update: academic_schemas.ScheduleTemplateUpdate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    tpl = db.query(academic_models.ScheduleTemplate).filter(
        academic_models.ScheduleTemplate.id == template_id,
        academic_models.ScheduleTemplate.school_id == str(tenant.school_id)
    ).first()
    
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
        
    if update.name is not None:
        tpl.name = update.name
    if update.structure is not None:
         # Validate structure
        for slot in update.structure:
            if "label" not in slot or "start" not in slot or "end" not in slot or "type" not in slot:
                 raise HTTPException(status_code=400, detail="Invalid structure. Slots must have label, start, end, type.")
        tpl.structure = update.structure

    # Audit
    audit = AuditLog(
        actor_id=str(user.id),
        action_type="UPDATE_TEMPLATE",
        table_name="schedule_templates",
        record_id=template_id,
        school_id=str(tenant.school_id),
        metadata=json.dumps(update.dict(exclude_unset=True)),
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit)
    
    db.commit()
    db.refresh(tpl)
    return tpl

@router.get("/schedule-templates", response_model=List[academic_schemas.ScheduleTemplateResponse])
def list_schedule_templates(
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    return db.query(academic_models.ScheduleTemplate).filter(
        academic_models.ScheduleTemplate.school_id == str(tenant.school_id)
    ).all()

@router.delete("/schedule-templates/{template_id}")
def delete_schedule_template(
    template_id: str,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    tpl = db.query(academic_models.ScheduleTemplate).filter(
        academic_models.ScheduleTemplate.id == template_id,
        academic_models.ScheduleTemplate.school_id == str(tenant.school_id)
    ).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
        
    db.delete(tpl)
    db.commit()
    return {"message": "Template deleted"}


# 2. Weekly Rules
@router.post("/schedule-weekly-rules", response_model=academic_schemas.ScheduleWeeklyRuleResponse)
def update_weekly_rules(
    rules: academic_schemas.ScheduleWeeklyRuleCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    # Check if exists (singleton per school for now)
    existing = db.query(academic_models.ScheduleWeeklyRule).filter(
        academic_models.ScheduleWeeklyRule.school_id == str(tenant.school_id)
    ).first()
    
    if existing:
        existing.day_rules = rules.day_rules
        db.add(existing) # Mark modified
    else:
        existing = academic_models.ScheduleWeeklyRule(
            day_rules=rules.day_rules,
            school_id=str(tenant.school_id)
        )
        db.add(existing)

    # Audit
    audit = AuditLog(
        actor_id=str(user.id),
        action_type="UPDATE_WEEKLY_RULES",
        table_name="schedule_weekly_rules",
        school_id=str(tenant.school_id),
        metadata=json.dumps({"rules": rules.day_rules}),
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit)

    db.commit()
    db.refresh(existing)
    return existing

@router.get("/schedule-weekly-rules", response_model=Optional[academic_schemas.ScheduleWeeklyRuleResponse])
def get_weekly_rules(
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    return db.query(academic_models.ScheduleWeeklyRule).filter(
        academic_models.ScheduleWeeklyRule.school_id == str(tenant.school_id)
    ).first()


# 3. Grade Mappings
@router.post("/schedule-grade-mappings", response_model=academic_schemas.ScheduleGradeMappingResponse)
def update_grade_mapping(
    mapping: academic_schemas.ScheduleGradeMappingCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    existing = db.query(academic_models.ScheduleGradeMapping).filter(
        academic_models.ScheduleGradeMapping.grade_id == mapping.grade_id,
        academic_models.ScheduleGradeMapping.school_id == str(tenant.school_id)
    ).first()
    
    if existing:
        existing.inherit_weekly = mapping.inherit_weekly
        existing.default_template_id = mapping.default_template_id
        db.add(existing)
    else:
        existing = academic_models.ScheduleGradeMapping(
            grade_id=mapping.grade_id,
            inherit_weekly=mapping.inherit_weekly,
            default_template_id=mapping.default_template_id,
            school_id=str(tenant.school_id)
        )
        db.add(existing)
        
    db.commit()
    db.refresh(existing)
    return existing

@router.get("/schedule-grade-mappings", response_model=List[academic_schemas.ScheduleGradeMappingResponse])
def list_grade_mappings(
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    return db.query(academic_models.ScheduleGradeMapping).filter(
        academic_models.ScheduleGradeMapping.school_id == str(tenant.school_id)
    ).all()


# 4. Overrides
@router.post("/schedule-overrides", response_model=academic_schemas.ScheduleOverrideResponse)
def create_override(
    override: academic_schemas.ScheduleOverrideCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    # Check overlaps logic? Maybe warn but allow for now as requested "newest wins"
    
    new_override = academic_models.ScheduleOverride(
        name=override.name,
        start_date=override.start_date,
        end_date=override.end_date,
        target_grade_ids=override.target_grade_ids,
        rule_config=override.rule_config,
        school_id=str(tenant.school_id)
    )
    
     # Audit
    audit = AuditLog(
        actor_id=str(user.id),
        action_type="CREATE_OVERRIDE",
        table_name="schedule_overrides",
        school_id=str(tenant.school_id),
        metadata=json.dumps({"name": override.name, "range": f"{override.start_date} to {override.end_date}"}),
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit)
    
    db.add(new_override)
    db.commit()
    db.refresh(new_override)
    return new_override

@router.get("/schedule-overrides", response_model=List[academic_schemas.ScheduleOverrideResponse])
def list_overrides(
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    # Sort by created_at desc for priority
    return db.query(academic_models.ScheduleOverride).filter(
        academic_models.ScheduleOverride.school_id == str(tenant.school_id)
    ).order_by(academic_models.ScheduleOverride.created_at.desc()).all()
    
@router.delete("/schedule-overrides/{override_id}")
def delete_override(
    override_id: str,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    ov = db.query(academic_models.ScheduleOverride).filter(
        academic_models.ScheduleOverride.id == override_id,
        academic_models.ScheduleOverride.school_id == str(tenant.school_id)
    ).first()
    if not ov:
         raise HTTPException(status_code=404, detail="Override not found")
         
    db.delete(ov)
    db.commit()
    return {"message": "Override deleted"}


# 5. Preview Logic
@router.post("/schedule/preview", response_model=academic_schemas.SchedulePreviewResponse)
def preview_schedule(
    req: academic_schemas.SchedulePreviewRequest,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    school_id = str(tenant.school_id)
    target_date = req.date
    weekday_name = target_date.strftime("%A") # "Sunday", "Monday"...
    
    # 1. Fetch all relevant data (Optimized fetch strategies could be used, but keeping simple)
    
    # Fetch Overrides intersecting date
    overrides = db.query(academic_models.ScheduleOverride).filter(
        academic_models.ScheduleOverride.school_id == school_id,
        academic_models.ScheduleOverride.start_date <= target_date,
        academic_models.ScheduleOverride.end_date >= target_date
    ).order_by(academic_models.ScheduleOverride.created_at.desc()).all()
    
    # Fetch Grade Mapping if grade specified
    grade_mapping = None
    if req.grade_id:
        grade_mapping = db.query(academic_models.ScheduleGradeMapping).filter(
            academic_models.ScheduleGradeMapping.school_id == school_id,
            academic_models.ScheduleGradeMapping.grade_id == req.grade_id
        ).first()
        
    # Fetch Weekly Rules
    weekly_rules = db.query(academic_models.ScheduleWeeklyRule).filter(
        academic_models.ScheduleWeeklyRule.school_id == school_id
    ).first()
    
    # RESOLUTION LOGIC
    
    # A. Check Overrides (Newest first)
    resolved_template_id = None
    source = "Default"
    
    for ov in overrides:
        # Check scope
        if ov.target_grade_ids:
            # If specific grades are targeted
            if not req.grade_id: continue # Can't apply grade-specific override to generic preview
            if req.grade_id not in ov.target_grade_ids: continue
        
        # Check logic: days match?
        rule_config = ov.rule_config or {}
        # Example config: { "days": ["Friday", "Sunday"], "template_id": "xyz" } 
        # OR simple map: { "Monday": "xyz" } -> "Monday" in rule_config
        
        # Let's support the detailed config: { "days": [...], "template_id": "..." }
        if "days" in rule_config and "template_id" in rule_config:
            if weekday_name in rule_config["days"]:
                resolved_template_id = rule_config["template_id"]
                source = f"Override: {ov.name}"
                break
        
        # Support simple day map
        elif weekday_name in rule_config:
             resolved_template_id = rule_config[weekday_name]
             source = f"Override: {ov.name}"
             break
             
    # B. If no override, Check Grade Mapping
    if not resolved_template_id and grade_mapping:
        if not grade_mapping.inherit_weekly:
             # Use custom template
             if grade_mapping.default_template_id:
                 resolved_template_id = grade_mapping.default_template_id
                 source = "Grade Mapping (Custom)"
        # If inherit_weekly is True, we proceed to check weekly rules below
        
    # C. Check Weekly Rules
    if not resolved_template_id and weekly_rules:
        if weekly_rules.day_rules and weekday_name in weekly_rules.day_rules:
            resolved_template_id = weekly_rules.day_rules[weekday_name]
            source = "Weekly Pattern"
            
    # D. Fetch Template Content
    template_name = "None"
    periods = []
    
    if resolved_template_id:
        tpl = db.query(academic_models.ScheduleTemplate).filter(
            academic_models.ScheduleTemplate.id == resolved_template_id
        ).first()
        if tpl:
            template_name = tpl.name
            periods = tpl.structure
        else:
            source = f"{source} (Template {resolved_template_id} Not Found)"
            
    return {
        "date": target_date,
        "template_name": template_name,
        "periods": periods,
        "source": source
    }


# Update Subjects create/list to use new Schema
@router.post("/subjects", response_model=academic_schemas.SubjectResponse)
def create_subject(
    subject: academic_schemas.SubjectCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER))
):
    new_subject = academic_models.Subject(
        name=subject.name,
        code=subject.code,
        is_elective=subject.is_elective,
        grade_id=subject.grade_id,
        assigned_teacher_id=subject.assigned_teacher_id,
        school_id=str(tenant.school_id)
    )
    db.add(new_subject)
    db.commit()
    db.refresh(new_subject)
    return new_subject

@router.get("/subjects", response_model=List[academic_schemas.SubjectResponse])
def list_subjects(
    grade_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    query = db.query(academic_models.Subject).filter(academic_models.Subject.school_id == str(tenant.school_id))
    if grade_id:
        query = query.filter(academic_models.Subject.grade_id == grade_id)
    return query.all()



# 6. Section & Subject Timetable Mapping
@router.get("/timetable/section-subject", response_model=List[academic_schemas.SectionSubjectTimetableResponse])
def get_section_subject_timetable(
    academic_year_id: str,
    grade_id: str,
    section_id: str,
    day_pattern_key: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    query = db.query(academic_models.SectionSubjectTimetable).filter(
        academic_models.SectionSubjectTimetable.school_id == str(tenant.school_id),
        academic_models.SectionSubjectTimetable.academic_year_id == academic_year_id,
        academic_models.SectionSubjectTimetable.grade_id == grade_id,
        academic_models.SectionSubjectTimetable.section_id == section_id
    )
    if day_pattern_key:
        query = query.filter(academic_models.SectionSubjectTimetable.day_pattern_key == day_pattern_key)
        
    results = query.all()
    
    # Enrichment
    # Collect IDs
    subject_ids = set()
    grade_subject_ids = set()
    for r in results:
        if r.subject_id: subject_ids.add(r.subject_id)
        if r.grade_subject_id: grade_subject_ids.add(r.grade_subject_id)
        
    # Maps
    subject_map = {}
    if subject_ids:
        subjects = db.query(academic_models.Subject).filter(academic_models.Subject.id.in_(list(subject_ids))).all()
        subject_map = {s.id: s.name for s in subjects}
        
    grade_subject_map = {}
    book_map = {}
    if grade_subject_ids:
        gss = db.query(academic_models.GradeSubject).filter(academic_models.GradeSubject.id.in_(list(grade_subject_ids))).all()
        # Create map of GS ID -> Subject ID -> Name? Or just GS ID -> Name directly if GS implies subject
        # GS links to Subject, so we need Subject name from GS.subject_id
        # We can optimize this but let's just fetch subjects of these GSs if not already in subject_ids
        extra_subj_ids = [gs.subject_id for gs in gss if gs.subject_id not in subject_ids]
        if extra_subj_ids:
            extra_subjs = db.query(academic_models.Subject).filter(academic_models.Subject.id.in_(extra_subj_ids)).all()
            subject_map.update({s.id: s.name for s in extra_subjs})
            
        grade_subject_map = {gs.id: {'subject_id': gs.subject_id} for gs in gss}
        
        # Books
        books = db.query(academic_models.GradeSubjectBookVersion).filter(
            academic_models.GradeSubjectBookVersion.grade_subject_id.in_(list(grade_subject_ids)),
            academic_models.GradeSubjectBookVersion.is_active == True
        ).all()
        book_map = {b.grade_subject_id: b.title for b in books}
    
    response = []
    for r in results:
        resp = academic_schemas.SectionSubjectTimetableResponse.from_orm(r)
        
        # Determine Name
        if r.grade_subject_id and r.grade_subject_id in grade_subject_map:
            s_id = grade_subject_map[r.grade_subject_id]['subject_id']
            resp.subject_name = subject_map.get(s_id)
            resp.book_title = book_map.get(r.grade_subject_id)
        elif r.subject_id:
            resp.subject_name = subject_map.get(r.subject_id)
            
        response.append(resp)
        
    return response

@router.put("/timetable/section-subject")
def update_section_subject_timetable(
    mappings: List[academic_schemas.SectionSubjectTimetableBase],
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER))
):
    if not mappings:
        return {"message": "No mappings provided"}
        
    # Validation: Ensure all same school/grade/section/year request generally? 
    # Or allow mixed. Allowing mixed but must enforce school_id of tenant
    
    school_id = str(tenant.school_id)
    count = 0
    
    # Simple Bulk Upsert approach: Iterate and upsert
    # For efficiency in huge datasets we'd use bulk_save_objects with checking, but limited scope here
    
    # Pre-fetch grade_subjects to resolve subject_id
    gs_ids = [m.grade_subject_id for m in mappings if m.grade_subject_id]
    gs_map = {}
    if gs_ids:
        gss = db.query(academic_models.GradeSubject).filter(academic_models.GradeSubject.id.in_(gs_ids)).all()
        gs_map = {gs.id: gs.subject_id for gs in gss}

    for m in mappings:
        # Resolve subject_id
        resolved_subject_id = m.subject_id
        if m.grade_subject_id and m.grade_subject_id in gs_map:
            resolved_subject_id = gs_map[m.grade_subject_id]
            
        # Check uniqueness constraint fields
        existing = db.query(academic_models.SectionSubjectTimetable).filter(
            academic_models.SectionSubjectTimetable.school_id == school_id,
            academic_models.SectionSubjectTimetable.academic_year_id == m.academic_year_id,
            academic_models.SectionSubjectTimetable.grade_id == m.grade_id,
            academic_models.SectionSubjectTimetable.section_id == m.section_id,
            academic_models.SectionSubjectTimetable.day_pattern_key == m.day_pattern_key,
            academic_models.SectionSubjectTimetable.period_index == m.period_index
        ).first()
        
        if existing:
            existing.subject_id = resolved_subject_id
            existing.grade_subject_id = m.grade_subject_id
            existing.updated_by_user_id = str(user.id)
            db.add(existing)
        else:
            new_entry = academic_models.SectionSubjectTimetable(
                school_id=school_id,
                academic_year_id=m.academic_year_id,
                grade_id=m.grade_id,
                section_id=m.section_id,
                day_pattern_key=m.day_pattern_key,
                period_index=m.period_index,
                subject_id=resolved_subject_id,
                grade_subject_id=m.grade_subject_id,
                created_by_user_id=str(user.id),
                updated_by_user_id=str(user.id)
            )
            db.add(new_entry)
        count += 1
            
    # Audit (Summary)
    # We log a summary event
    audit = AuditLog(
        actor_id=str(user.id),
        action_type="UPDATE_TIMETABLE_MAPPING",
        table_name="section_subject_timetables",
        school_id=school_id,
        metadata=json.dumps({"count": count, "grade_id": mappings[0].grade_id if count > 0 else "unknown"}),
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit)
    
    db.commit()
    return {"message": f"Updated {count} mappings"}

# 7. Class Teacher Assignment logic
@router.post("/timetable/compute-class-teachers")
def compute_class_teachers(
    academic_year_id: str,
    grade_id: str,
    section_id: str,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER))
):
    school_id = str(tenant.school_id)
    
    # 1. Look up P1 subject for "REGULAR" day pattern
    p1_mapping = db.query(academic_models.SectionSubjectTimetable).filter(
        academic_models.SectionSubjectTimetable.school_id == school_id,
        academic_models.SectionSubjectTimetable.academic_year_id == academic_year_id,
        academic_models.SectionSubjectTimetable.grade_id == grade_id,
        academic_models.SectionSubjectTimetable.section_id == section_id,
        academic_models.SectionSubjectTimetable.day_pattern_key == "REGULAR", # Default convention
        academic_models.SectionSubjectTimetable.period_index == 1
    ).first()
    
    if not p1_mapping or not p1_mapping.subject_id:
        return {"message": "No subject found in Regular Day Period 1. Cannot auto-assign."}
        
    # 2. Find teacher assigned to that subject
    # Note: Subject model has assigned_teacher_id. 
    # If the system evolves to "SubjectTeacherAssignment" separate table, this needs update. 
    # Current Assumption: Subject.assigned_teacher_id holds the teacher.
    # WAIT: Existing Subject model has `assigned_teacher_id`. But is that per section? 
    # Previously `Subject` was per grade. If `Subject` is shared across sections, then `assigned_teacher_id` implies one teacher per grade. 
    # If we need different teachers per section, we need `TeacherAssignment` table (which exists).
    
    # Let's check TeacherAssignment table first for (grade, section, subject)
    teacher_assignment = db.query(academic_models.TeacherAssignment).filter(
        academic_models.TeacherAssignment.school_id == school_id,
        academic_models.TeacherAssignment.grade_id == grade_id,
        academic_models.TeacherAssignment.section_id == section_id,
        academic_models.TeacherAssignment.subject_id == p1_mapping.subject_id
    ).first()
    
    candidate_teacher_id = None
    if teacher_assignment:
        candidate_teacher_id = teacher_assignment.teacher_id
    else:
        # Fallback to Subject default
        subj = db.query(academic_models.Subject).filter(
            academic_models.Subject.id == p1_mapping.subject_id
        ).first()
        if subj and subj.assigned_teacher_id:
            candidate_teacher_id = subj.assigned_teacher_id
            
    if not candidate_teacher_id:
        return {"message": "Subject found but no teacher assigned to it. Cannot auto-assign."}
        
    # 3. Upsert ClassTeacherAssignment
    assignment = db.query(academic_models.ClassTeacherAssignment).filter(
        academic_models.ClassTeacherAssignment.school_id == school_id,
        academic_models.ClassTeacherAssignment.academic_year_id == academic_year_id,
        academic_models.ClassTeacherAssignment.grade_id == grade_id,
        academic_models.ClassTeacherAssignment.section_id == section_id
    ).first()
    
    if assignment:
        # If MANUAL_OVERRIDE, do not overwrite
        if assignment.source == "MANUAL_OVERRIDE":
            return {"message": "Class teacher is manually overridden. Skipping auto-assign.", "current_teacher_id": assignment.teacher_user_id}
        
        assignment.teacher_user_id = candidate_teacher_id
        assignment.source = "AUTO_FROM_P1" # Confirm source
        db.add(assignment)
    else:
        assignment = academic_models.ClassTeacherAssignment(
            school_id=school_id,
            academic_year_id=academic_year_id,
            grade_id=grade_id,
            section_id=section_id,
            teacher_user_id=candidate_teacher_id,
            source="AUTO_FROM_P1",
            derived_from_day_pattern_key="REGULAR"
        )
        db.add(assignment)
        
    # Audit
    audit = AuditLog(
        actor_id=str(user.id),
        action_type="AUTO_ASSIGN_CLASS_TEACHER",
        table_name="class_teacher_assignments",
        school_id=school_id,
        metadata=json.dumps({"grade_id": grade_id, "section_id": section_id, "teacher_id": candidate_teacher_id}),
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit)
    
    db.commit()
    return {"message": "Class teacher auto-assigned", "teacher_id": candidate_teacher_id}

@router.put("/class-teachers/override")
def override_class_teacher(
    req: academic_schemas.ClassTeacherOverrideRequest,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER))
):
    school_id = str(tenant.school_id)
    
    assignment = db.query(academic_models.ClassTeacherAssignment).filter(
        academic_models.ClassTeacherAssignment.school_id == school_id,
        academic_models.ClassTeacherAssignment.academic_year_id == req.academic_year_id,
        academic_models.ClassTeacherAssignment.grade_id == req.grade_id,
        academic_models.ClassTeacherAssignment.section_id == req.section_id
    ).first()
    
    if assignment:
        assignment.teacher_user_id = req.teacher_user_id
        assignment.source = "MANUAL_OVERRIDE"
        db.add(assignment)
    else:
        assignment = academic_models.ClassTeacherAssignment(
            school_id=school_id,
            academic_year_id=req.academic_year_id,
            grade_id=req.grade_id,
            section_id=req.section_id,
            teacher_user_id=req.teacher_user_id,
            source="MANUAL_OVERRIDE",
            derived_from_day_pattern_key="REGULAR" # Defaulting
        )
        db.add(assignment)

    # Audit
    audit = AuditLog(
        actor_id=str(user.id),
        action_type="OVERRIDE_CLASS_TEACHER",
        table_name="class_teacher_assignments",
        school_id=school_id,
        metadata=json.dumps(req.dict()),
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit)
    
    db.commit()
    return {"message": "Class teacher overridden"}
    
@router.get("/class-teachers", response_model=Optional[academic_schemas.ClassTeacherAssignmentResponse])
def get_class_teacher(
    academic_year_id: str,
    grade_id: str,
    section_id: str,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    assignment = db.query(academic_models.ClassTeacherAssignment).filter(
        academic_models.ClassTeacherAssignment.school_id == str(tenant.school_id),
        academic_models.ClassTeacherAssignment.academic_year_id == academic_year_id,
        academic_models.ClassTeacherAssignment.grade_id == grade_id,
        academic_models.ClassTeacherAssignment.section_id == section_id
    ).first()
    
    if not assignment:
        return None
        
    resp = academic_schemas.ClassTeacherAssignmentResponse.from_orm(assignment)
    
    # Fetch Teacher Name helper
    teacher = db.query(school_models.User).filter(school_models.User.id == uuid.UUID(assignment.teacher_user_id)).first()
    if teacher:
        resp.teacher_name = f"{teacher.first_name} {teacher.last_name}"
        
    return resp

# --- PHASE 2: SUBJECT SCOPING & BOOKS ---

@router.get("/grade-subjects", response_model=List[academic_schemas.GradeSubjectResponse])
def get_grade_subjects(
    academic_year_id: str,
    grade_id: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER, Roles.STUDENT, Roles.PARENT))
):
    query = db.query(academic_models.GradeSubject).filter(
        academic_models.GradeSubject.school_id == str(tenant.school_id),
        academic_models.GradeSubject.academic_year_id == academic_year_id
    )
    
    if grade_id:
        query = query.filter(academic_models.GradeSubject.grade_id == grade_id)
        
    grade_subjects = query.all()
    
    # Populate helpers
    results = []
    for gs in grade_subjects:
        resp = academic_schemas.GradeSubjectResponse.from_orm(gs)
        
        # Subject Info
        subject = db.query(academic_models.Subject).filter(academic_models.Subject.id == gs.subject_id).first()
        if subject:
            resp.subject_name = subject.name
            resp.subject_code = subject.code
            
        # Current Book
        active_book = db.query(academic_models.GradeSubjectBookVersion).filter(
            academic_models.GradeSubjectBookVersion.grade_subject_id == gs.id,
            academic_models.GradeSubjectBookVersion.is_active == True
        ).first()
        if active_book:
            resp.current_book_title = active_book.title
            
        results.append(resp)
        
    return results

class GradeSubjectCreateRequest(BaseModel):
    grade_id: str
    academic_year_id: str
    name: str # Subject Name
    code: Optional[str] = None
    type: str = "CORE"
    
    # Initial Book
    book_title: Optional[str] = None
    book_publisher: Optional[str] = None
    book_edition: Optional[str] = None

@router.post("/grade-subjects", response_model=academic_schemas.GradeSubjectResponse)
def create_grade_subject(
    req: GradeSubjectCreateRequest,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.ACADEMIC_ADMIN, Roles.SUPER_ADMIN))
):
    school_id = str(tenant.school_id)
    
    # 1. Resolve Subject Identity
    # Check if subject with name exists (case insensitive?)
    existing_subject = db.query(academic_models.Subject).filter(
        academic_models.Subject.school_id == school_id,
        academic_models.Subject.name == req.name
    ).first()
    
    if existing_subject:
        subject_id = existing_subject.id
        # Update code if not set?
        if req.code and not existing_subject.code:
            existing_subject.code = req.code
            db.add(existing_subject)
    else:
        new_subject = academic_models.Subject(
            school_id=school_id,
            name=req.name,
            code=req.code,
            grade_id=req.grade_id # Optional legacy field
        )
        db.add(new_subject)
        db.flush() # Get ID
        subject_id = new_subject.id
        
    # 2. Check if GradeSubject already exists
    existing_gs = db.query(academic_models.GradeSubject).filter(
        academic_models.GradeSubject.school_id == school_id,
        academic_models.GradeSubject.academic_year_id == req.academic_year_id,
        academic_models.GradeSubject.grade_id == req.grade_id,
        academic_models.GradeSubject.subject_id == subject_id
    ).first()
    
    if existing_gs:
        # Reactivate if inactive?
        if not existing_gs.is_active:
            existing_gs.is_active = True
            db.add(existing_gs)
            db.commit()
            db.refresh(existing_gs)
            # Fetch helpers and return
            # Simplified return for now
            resp = academic_schemas.GradeSubjectResponse.from_orm(existing_gs)
            resp.subject_name = req.name
            return resp
        else:
             raise HTTPException(status_code=400, detail="Subject already assigned to this grade")

    # 3. Create GradeSubject
    new_gs = academic_models.GradeSubject(
        school_id=school_id,
        academic_year_id=req.academic_year_id,
        grade_id=req.grade_id,
        subject_id=subject_id,
        type=req.type
    )
    db.add(new_gs)
    db.flush()
    
    # 4. Create Book Version (if provided)
    if req.book_title:
        book = academic_models.GradeSubjectBookVersion(
            school_id=school_id,
            grade_subject_id=new_gs.id,
            title=req.book_title,
            publisher=req.book_publisher,
            edition=req.book_edition,
            effective_from=date.today(),
            is_active=True
        )
        db.add(book)
        
    db.commit()
    db.refresh(new_gs)
    
    resp = academic_schemas.GradeSubjectResponse.from_orm(new_gs)
    resp.subject_name = req.name
    if req.book_title:
        resp.current_book_title = req.book_title
        
    return resp

@router.post("/grade-subjects/{id}/book-versions", response_model=academic_schemas.GradeSubjectBookVersionResponse)
def add_book_version(
    id: str,
    req: academic_schemas.GradeSubjectBookVersionCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.ACADEMIC_ADMIN, Roles.SUPER_ADMIN))
):
    school_id = str(tenant.school_id)
    
    gs = db.query(academic_models.GradeSubject).filter(
        academic_models.GradeSubject.id == id,
        academic_models.GradeSubject.school_id == school_id
    ).first()
    if not gs:
        raise HTTPException(status_code=404, detail="Grade Subject not found")
        
    # Deactivate current active version
    current_active = db.query(academic_models.GradeSubjectBookVersion).filter(
        academic_models.GradeSubjectBookVersion.grade_subject_id == id,
        academic_models.GradeSubjectBookVersion.is_active == True
    ).first()
    
    if current_active:
        current_active.is_active = False
        current_active.effective_to = req.effective_from
        db.add(current_active)
        
    # Add new version
    new_version = academic_models.GradeSubjectBookVersion(
        school_id=school_id,
        grade_subject_id=id,
        title=req.title,
        publisher=req.publisher,
        edition=req.edition,
        effective_from=req.effective_from,
        is_active=True
    )
    db.add(new_version)
    db.commit()
    db.refresh(new_version)
    
    return new_version

@router.get("/grade-subjects/{id}/book-versions", response_model=List[academic_schemas.GradeSubjectBookVersionResponse])
def get_book_versions(
    id: str,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.TEACHER, Roles.SUPER_ADMIN))
):
    return db.query(academic_models.GradeSubjectBookVersion).filter(
        academic_models.GradeSubjectBookVersion.grade_subject_id == id,
        academic_models.GradeSubjectBookVersion.school_id == str(tenant.school_id)
    ).order_by(academic_models.GradeSubjectBookVersion.created_at.desc()).all()


# --- TEACHING ASSIGNMENTS (Flexible) ---

@router.get("/teaching-assignments", response_model=List[academic_schemas.TeachingAssignmentResponse])
def get_teaching_assignments(
    academic_year_id: str,
    teacher_user_id: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.SCHOOL_ADMIN, Roles.ACADEMIC_ADMIN, Roles.TEACHER))
):
    school_id = str(tenant.school_id)
    
    # If teacher, enforce self? User said "read their own".
    # If admin, can list all.
    is_admin = user.role in [Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.SCHOOL_ADMIN, Roles.ACADEMIC_ADMIN]
    
    query = db.query(academic_models.TeachingAssignment).filter(
        academic_models.TeachingAssignment.school_id == school_id,
        academic_models.TeachingAssignment.academic_year_id == academic_year_id
    )
    
    if not is_admin:
        # Enforce self
        query = query.filter(academic_models.TeachingAssignment.teacher_user_id == str(user.id))
    elif teacher_user_id:
        query = query.filter(academic_models.TeachingAssignment.teacher_user_id == teacher_user_id)
        
    assignments = query.all()
    
    # Populate helpers
    results = []
    for assign in assignments:
        resp = academic_schemas.TeachingAssignmentResponse.from_orm(assign)
        
        # Details
        teacher = db.query(school_models.User).filter(school_models.User.id == uuid.UUID(assign.teacher_user_id)).first()
        if teacher:
            resp.teacher_name = f"{teacher.first_name} {teacher.last_name}"
            
        if assign.grade_subject_id:
             gs = db.query(academic_models.GradeSubject).filter(academic_models.GradeSubject.id == assign.grade_subject_id).first()
             if gs:
                 subj = db.query(academic_models.Subject).filter(academic_models.Subject.id == gs.subject_id).first()
                 if subj:
                     resp.subject_name = subj.name
        
        if assign.grade_id:
            grade = db.query(academic_models.Grade).filter(academic_models.Grade.id == assign.grade_id).first()
            if grade:
                resp.grade_name = grade.name
                
        if assign.section_id:
            section = db.query(academic_models.Section).filter(academic_models.Section.id == assign.section_id).first()
            if section:
                resp.section_name = section.name
                
        results.append(resp)
        
    return results

@router.post("/teaching-assignments", response_model=academic_schemas.TeachingAssignmentResponse)
def create_teaching_assignment(
    req: academic_schemas.TeachingAssignmentCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.ACADEMIC_ADMIN, Roles.SUPER_ADMIN))
):
    school_id = str(tenant.school_id)
    
    # Check if exists
    existing = db.query(academic_models.TeachingAssignment).filter(
        academic_models.TeachingAssignment.school_id == school_id,
        academic_models.TeachingAssignment.academic_year_id == req.academic_year_id,
        academic_models.TeachingAssignment.teacher_user_id == req.teacher_user_id,
        academic_models.TeachingAssignment.grade_id == req.grade_id,
        academic_models.TeachingAssignment.grade_subject_id == req.grade_subject_id,
        # Section might be null
        (academic_models.TeachingAssignment.section_id == req.section_id) if req.section_id else academic_models.TeachingAssignment.section_id.is_(None)
    ).first()
    
    if existing:
        return existing # Idempotent
        
    new_assign = academic_models.TeachingAssignment(
        school_id=school_id,
        academic_year_id=req.academic_year_id,
        teacher_user_id=req.teacher_user_id,
        grade_id=req.grade_id,
        section_id=req.section_id,
        grade_subject_id=req.grade_subject_id
    )
    db.add(new_assign)
    db.commit()
    db.refresh(new_assign)
    
    return academic_schemas.TeachingAssignmentResponse.from_orm(new_assign)

@router.delete("/teaching-assignments/{id}")
def delete_teaching_assignment(
    id: str,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SCHOOL_ADMIN, Roles.ACADEMIC_ADMIN, Roles.SUPER_ADMIN))
):
    assign = db.query(academic_models.TeachingAssignment).filter(
        academic_models.TeachingAssignment.id == id,
        academic_models.TeachingAssignment.school_id == str(tenant.school_id)
    ).first()
    
    if assign:
        db.delete(assign)
        db.commit()
        
    return {"message": "Assignment deleted"}
# Keeping them below to maintain functionality

class SectionCreate(BaseModel):
    name: str

class SectionResponse(BaseModel):
    id: str
    name: str
    school_id: str
    class Config:
        from_attributes = True

class GradeCreate(BaseModel):
    name: str
    sequence: int

class GradeResponse(BaseModel):
    id: str
    name: str
    sequence: int
    school_id: str
    class Config:
        from_attributes = True

class GradeSectionLink(BaseModel):
    grade_id: str
    section_id: str

class TeacherAssignmentCreate(BaseModel):
    teacher_id: str
    grade_id: Optional[str] = None
    section_id: Optional[str] = None
    subject_id: Optional[str] = None

class ExamTermCreate(BaseModel):
    name: str

class ExamTermResponse(BaseModel):
    id: str
    name: str
    is_active: bool
    school_id: str
    class Config:
        orm_mode = True

class MarksEntryCreate(BaseModel):
    student_id: str
    subject_id: str
    exam_term_id: str
    marks_obtained: int
    total_marks: int
    reason: Optional[str] = None

class MarksEntryResponse(BaseModel):
    id: str
    student_id: str
    subject_id: str
    exam_term_id: str
    marks_obtained: int
    total_marks: int
    is_published: bool
    school_id: str

    class Config:
        orm_mode = True

class MarksOverride(BaseModel):
    marks_obtained: int
    reason: str

class PerformanceTrend(BaseModel):
    exam_term_name: str
    average_score: float

class LessonPlanCreate(BaseModel):
    subject_id: str
    content: Dict[str, Any]
    date: date

class LessonPlanResponse(BaseModel):
    id: str
    teacher_id: str
    subject_id: str
    content: Dict[str, Any]
    date: date
    status: academic_models.LessonPlanStatus
    school_id: str
    class Config:
        orm_mode = True

class SyllabusCoverage(BaseModel):
    subject_name: str
    teacher_name: str
    planned_lessons: int
    completed_lessons: int
    completed_lessons: int
    coverage_percent: float

# Flexible Grading Schemas
class AssessmentTypeCreate(BaseModel):
    name: str

class AssessmentTypeResponse(BaseModel):
    id: str
    name: str
    school_id: str
    class Config:
        orm_mode = True

class AssessmentCreate(BaseModel):
    name: str
    subject_id: str
    exam_term_id: str
    max_marks: int
    assessment_type_id: Optional[str] = None

class AssessmentResponse(BaseModel):
    id: str
    name: str
    subject_id: str
    exam_term_id: str
    max_marks: int
    assessment_type_id: Optional[str] = None
    school_id: str
    class Config:
        orm_mode = True

class ScoreEntry(BaseModel):
    student_id: str
    score: float

class BulkScoreInput(BaseModel):
    assessment_id: str
    scores: List[ScoreEntry]

# Endpoints for Lesson Plans

@router.post("/lesson-plans", response_model=LessonPlanResponse)
def create_lesson_plan(
    plan: LessonPlanCreate,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("LESSON_PLANNER"))
):
    # If teacher, enforce teacher_id = user.id
    teacher_id = user.id
    if user.role != Roles.TEACHER:
        pass

    new_plan = academic_models.LessonPlan(
        school_id=str(tenant.school_id),
        teacher_id=teacher_id,
        subject_id=plan.subject_id,
        content=plan.content,
        date=plan.date,
        status=academic_models.LessonPlanStatus.PLANNED
    )
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)
    return new_plan

@router.get("/lesson-plans", response_model=List[LessonPlanResponse])
def list_lesson_plans(
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("LESSON_PLANNER"))
):
    query = db.query(academic_models.LessonPlan).filter(
        academic_models.LessonPlan.school_id == str(tenant.school_id)
    )
    if user.role == Roles.TEACHER:
        query = query.filter(academic_models.LessonPlan.teacher_id == user.id)

    return query.order_by(academic_models.LessonPlan.date.desc()).all()

@router.patch("/lesson-plans/{plan_id}/complete", response_model=LessonPlanResponse)
def complete_lesson_plan(
    plan_id: str,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.TEACHER)),
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("LESSON_PLANNER"))
):
    plan = db.query(academic_models.LessonPlan).filter(
        academic_models.LessonPlan.id == plan_id,
        academic_models.LessonPlan.school_id == str(tenant.school_id),
        academic_models.LessonPlan.teacher_id == user.id
    ).first()

    if not plan:
        raise HTTPException(status_code=404, detail="Lesson Plan not found")

    plan.status = academic_models.LessonPlanStatus.COMPLETED
    db.commit()
    db.refresh(plan)
    return plan

@router.get("/reports/syllabus-coverage", response_model=List[SyllabusCoverage])
def get_syllabus_coverage(
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess),
    _ = Depends(require_subscription_feature("LESSON_PLANNER"))
):
    from sqlalchemy import func, case

    results = db.query(
        academic_models.LessonPlan.teacher_id,
        academic_models.LessonPlan.subject_id,
        func.count(academic_models.LessonPlan.id).label('total'),
        func.sum(case((academic_models.LessonPlan.status == academic_models.LessonPlanStatus.COMPLETED, 1), else_=0)).label('completed')
    ).filter(
        academic_models.LessonPlan.school_id == str(tenant.school_id)
    ).group_by(academic_models.LessonPlan.teacher_id, academic_models.LessonPlan.subject_id).all()

    report = []
    for r in results:
        teacher = db.query(school_models.User).get(uuid.UUID(r.teacher_id))
        subject = db.query(academic_models.Subject).get(r.subject_id)

        planned = r.total
        completed = r.completed or 0
        coverage = (completed / planned * 100) if planned > 0 else 0

        report.append(SyllabusCoverage(
            subject_name=subject.name if subject else "Unknown",
            teacher_name=f"{teacher.first_name} {teacher.last_name}" if teacher else "Unknown",
            planned_lessons=planned,
            completed_lessons=completed,
            coverage_percent=round(coverage, 2)
        ))

    return report

@router.post("/sections", response_model=SectionResponse)
def create_section(
    section: SectionCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    existing = db.query(academic_models.Section).filter(
        academic_models.Section.school_id == str(tenant.school_id),
        academic_models.Section.name == section.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Section already exists")

    new_section = academic_models.Section(
        name=section.name,
        school_id=str(tenant.school_id)
    )
    db.add(new_section)
    db.commit()
    db.refresh(new_section)
    return new_section

@router.get("/sections", response_model=List[SectionResponse])
def list_sections(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    return db.query(academic_models.Section).filter(academic_models.Section.school_id == str(tenant.school_id)).all()

@router.post("/grades", response_model=GradeResponse)
def create_grade(
    grade: GradeCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    try:
        new_grade = academic_models.Grade(
            name=grade.name,
            sequence=grade.sequence,
            school_id=str(tenant.school_id)
        )
        db.add(new_grade)
        db.commit()
        db.refresh(new_grade)
        return new_grade
    except Exception as e:
        if "unique constraint" in str(e).lower():
             raise HTTPException(status_code=400, detail="Grade with this name or data already exists info.")
        raise HTTPException(status_code=500, detail=f"Backend Error: {str(e)}")

@router.get("/grades", response_model=List[GradeResponse])
def list_grades(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER, Roles.PARENT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    return db.query(academic_models.Grade).filter(academic_models.Grade.school_id == str(tenant.school_id)).order_by(academic_models.Grade.sequence).all()

class StructureItem(BaseModel):
    grade: GradeResponse
    sections: List[SectionResponse]

@router.get("/structure", response_model=List[StructureItem])
def get_academic_structure(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER, Roles.PARENT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    grades = db.query(academic_models.Grade).filter(academic_models.Grade.school_id == str(tenant.school_id)).order_by(academic_models.Grade.sequence).all()
    sections = db.query(academic_models.Section).filter(academic_models.Section.school_id == str(tenant.school_id)).all()
    links = db.query(academic_models.GradeSection).filter(academic_models.GradeSection.school_id == str(tenant.school_id)).all()

    section_map = {s.id: s for s in sections}
    grade_section_map = {}
    for link in links:
        if link.grade_id not in grade_section_map:
            grade_section_map[link.grade_id] = []
        grade_section_map[link.grade_id].append(link.section_id)

    structure = []
    for grade in grades:
        grade_sections = []
        if grade.id in grade_section_map:
            for sid in grade_section_map[grade.id]:
                if sid in section_map:
                    grade_sections.append(section_map[sid])
        
        structure.append({
            "grade": grade,
            "sections": grade_sections
        })

    return structure

# Grade With Sections (Optimized for Dropdowns)
class SectionSimple(BaseModel):
    id: str
    name: str

class GradeWithSections(BaseModel):
    id: str
    name: str
    sections: List[SectionSimple]

@router.get("/grades-with-sections", response_model=List[GradeWithSections])
def list_grades_with_sections(
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    grades = db.query(academic_models.Grade).filter(
        academic_models.Grade.school_id == str(tenant.school_id)
    ).order_by(academic_models.Grade.sequence).all()
    
    sections = db.query(academic_models.Section).filter(
        academic_models.Section.school_id == str(tenant.school_id)
    ).all()
    
    links = db.query(academic_models.GradeSection).filter(
        academic_models.GradeSection.school_id == str(tenant.school_id)
    ).all()
    
    section_map = {s.id: s for s in sections}
    grade_section_map = {}
    for link in links:
        if link.grade_id not in grade_section_map:
            grade_section_map[link.grade_id] = []
        grade_section_map[link.grade_id].append(link.section_id)
        
    result = []
    for grade in grades:
        g_sections = []
        if grade.id in grade_section_map:
             for s_id in grade_section_map[grade.id]:
                 if s_id in section_map:
                     s = section_map[s_id]
                     g_sections.append(SectionSimple(id=s.id, name=s.name))
        
        result.append(GradeWithSections(
            id=grade.id,
            name=grade.name,
            sections=g_sections
        ))
        
    return result

@router.post("/grades/{grade_id}/sections")
def link_grade_section(
    grade_id: str,
    link_data: GradeSectionLink,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    grade = db.query(academic_models.Grade).filter(academic_models.Grade.id == grade_id, academic_models.Grade.school_id == str(tenant.school_id)).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Grade not found")

    section = db.query(academic_models.Section).filter(academic_models.Section.id == link_data.section_id, academic_models.Section.school_id == str(tenant.school_id)).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    existing = db.query(academic_models.GradeSection).filter(
        academic_models.GradeSection.grade_id == grade_id,
        academic_models.GradeSection.section_id == link_data.section_id,
        academic_models.GradeSection.school_id == str(tenant.school_id)
    ).first()

    if existing:
        return {"message": "Link already exists"}

    new_link = academic_models.GradeSection(
        grade_id=grade_id,
        section_id=link_data.section_id,
        school_id=str(tenant.school_id)
    )
    db.add(new_link)
    db.commit()
    return {"message": "Grade linked to Section successfully"}

@router.post("/assignments")
def assign_teacher(
    assignment: TeacherAssignmentCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    teacher = db.query(school_models.User).filter(
        school_models.User.id == uuid.UUID(assignment.teacher_id),
        school_models.User.school_id == uuid.UUID(tenant.school_id),
        school_models.User.role == Roles.TEACHER
    ).first()

    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    if assignment.grade_id:
        if not db.query(academic_models.Grade).filter(academic_models.Grade.id == assignment.grade_id, academic_models.Grade.school_id == str(tenant.school_id)).first():
            raise HTTPException(status_code=404, detail="Grade not found")

    if assignment.section_id:
        if not db.query(academic_models.Section).filter(academic_models.Section.id == assignment.section_id, academic_models.Section.school_id == str(tenant.school_id)).first():
            raise HTTPException(status_code=404, detail="Section not found")

    if assignment.subject_id:
         if not db.query(academic_models.Subject).filter(academic_models.Subject.id == assignment.subject_id, academic_models.Subject.school_id == str(tenant.school_id)).first():
            raise HTTPException(status_code=404, detail="Subject not found")

    new_assignment = academic_models.TeacherAssignment(
        teacher_id=assignment.teacher_id,
        grade_id=assignment.grade_id,
        section_id=assignment.section_id,
        subject_id=assignment.subject_id,
        school_id=str(tenant.school_id)
    )
    db.add(new_assignment)
    db.commit()
    return {"message": "Teacher assigned successfully"}

@router.post("/promote")
def promote_students(
    target_academic_year_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    target_ay = db.query(academic_models.AcademicYear).filter(
        academic_models.AcademicYear.id == target_academic_year_id,
        academic_models.AcademicYear.school_id == str(tenant.school_id)
    ).first()
    if not target_ay:
        raise HTTPException(status_code=404, detail="Target Academic Year not found")

    students = db.query(student_models.Student).filter(
        student_models.Student.school_id == str(tenant.school_id),
        student_models.Student.is_active == True
    ).all()

    promoted_count = 0
    retained_count = 0
    graduated_count = 0

    grades = db.query(academic_models.Grade).filter(academic_models.Grade.school_id == str(tenant.school_id)).all()
    grade_map = {g.id: g for g in grades}
    
    for student in students:
        if student.retention_flag:
            student.academic_year_id = target_academic_year_id
            student.retention_flag = False
            retained_count += 1
        else:
            if not student.grade_id:
                continue 

            current_grade = grade_map.get(student.grade_id)



            if not current_grade:
                continue

            possible_next_grades = [g for g in grades if g.sequence > current_grade.sequence]
            possible_next_grades.sort(key=lambda x: x.sequence)

            if not possible_next_grades:
                graduated_count += 1
                student.is_active = False
                student.grade_id = None
                student.section_id = None
            else:
                next_grade = possible_next_grades[0]
                student.grade_id = next_grade.id
                student.academic_year_id = target_academic_year_id

                link = db.query(academic_models.GradeSection).filter(
                    academic_models.GradeSection.grade_id == next_grade.id,
                    academic_models.GradeSection.section_id == student.section_id
                ).first()
                if not link:
                    student.section_id = None 

                promoted_count += 1

    db.commit()
    return {
        "message": "Promotion cycle completed",
        "promoted": promoted_count,
        "retained": retained_count,
        "graduated_or_max_grade": graduated_count
    }

@router.post("/students/{student_id}/retain")
def retain_student(
    student_id: str,
    reason: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    student = db.query(student_models.Student).filter(
        student_models.Student.id == student_id,
        student_models.Student.school_id == str(tenant.school_id)
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student.retention_flag = True

    audit_entry = AuditLog(
        actor_id=user.id,
        action_type="MANUAL_RETENTION",
        table_name="students",
        record_id=student.id,
        school_id=student.school_id, # Added school_id
        after_state=json.dumps({"retention_flag": True, "reason": reason}),
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit_entry)

    db.commit()
    return {"message": "Student flagged for retention"}

# Exam Management Endpoints

@router.post("/exams/terms", response_model=ExamTermResponse)
def create_exam_term(
    term: ExamTermCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    new_term = academic_models.ExamTerm(
        name=term.name,
        school_id=str(tenant.school_id)
    )
    db.add(new_term)
    db.commit()
    db.refresh(new_term)
    return new_term

@router.get("/exams/terms", response_model=List[ExamTermResponse])
def list_exam_terms(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    return db.query(academic_models.ExamTerm).filter(academic_models.ExamTerm.school_id == str(tenant.school_id)).all()

@router.post("/exams/marks", response_model=MarksEntryResponse)
def enter_marks(
    marks_data: MarksEntryCreate,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    student = db.query(student_models.Student).filter(student_models.Student.id == marks_data.student_id, student_models.Student.school_id == str(tenant.school_id)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    exam_term = db.query(academic_models.ExamTerm).filter(
        academic_models.ExamTerm.id == marks_data.exam_term_id,
        academic_models.ExamTerm.school_id == str(tenant.school_id)
    ).first()
    if not exam_term:
        raise HTTPException(status_code=404, detail="Exam Term not found")

    if user.role == Roles.TEACHER:
        if not student.grade_id:
             raise HTTPException(status_code=400, detail="Student not assigned to a grade")

        assignment = db.query(academic_models.TeacherAssignment).filter(
            academic_models.TeacherAssignment.teacher_id == user.id,
            academic_models.TeacherAssignment.subject_id == marks_data.subject_id,
            academic_models.TeacherAssignment.school_id == str(tenant.school_id)
        ).all()

        valid_assignment = False
        for asn in assignment:
            if asn.grade_id == student.grade_id:
                if asn.section_id is None or asn.section_id == student.section_id:
                    valid_assignment = True
                    break

        if not valid_assignment:
             raise HTTPException(status_code=403, detail="Teacher not assigned to this student's grade/subject")

    existing_marks = db.query(academic_models.MarksEntry).filter(
        academic_models.MarksEntry.student_id == marks_data.student_id,
        academic_models.MarksEntry.subject_id == marks_data.subject_id,
        academic_models.MarksEntry.exam_term_id == marks_data.exam_term_id,
        academic_models.MarksEntry.school_id == str(tenant.school_id)
    ).first()

    if existing_marks:
        if existing_marks.is_published:
            raise HTTPException(status_code=403, detail="Marks are locked (Published). Contact Admin for override.")

        reason_text = marks_data.reason or "No justification provided"
        set_reason(reason_text)

        existing_marks.marks_obtained = marks_data.marks_obtained
        existing_marks.total_marks = marks_data.total_marks
        db.commit()
        db.refresh(existing_marks)
        return existing_marks
    else:
        new_marks = academic_models.MarksEntry(
            student_id=marks_data.student_id,
            subject_id=marks_data.subject_id,
            exam_term_id=marks_data.exam_term_id,
            marks_obtained=marks_data.marks_obtained,
            total_marks=marks_data.total_marks,
            school_id=str(tenant.school_id)
        )
        db.add(new_marks)
        db.commit()
        db.refresh(new_marks)
        return new_marks

@router.post("/exams/marks/{marks_id}/publish")
def publish_marks(
    marks_id: str,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    marks = db.query(academic_models.MarksEntry).filter(
        academic_models.MarksEntry.id == marks_id,
        academic_models.MarksEntry.school_id == str(tenant.school_id)
    ).first()

    if not marks:
        raise HTTPException(status_code=404, detail="Marks entry not found")

    if user.role == Roles.TEACHER:
        student = db.query(student_models.Student).filter(student_models.Student.id == marks.student_id).first()
        if not student or not student.grade_id:
             raise HTTPException(status_code=400, detail="Student invalid or unassigned")

        assignment = db.query(academic_models.TeacherAssignment).filter(
            academic_models.TeacherAssignment.teacher_id == user.id,
            academic_models.TeacherAssignment.subject_id == marks.subject_id,
            academic_models.TeacherAssignment.school_id == str(tenant.school_id)
        ).all()

        valid_assignment = False
        for asn in assignment:
            if asn.grade_id == student.grade_id:
                if asn.section_id is None or asn.section_id == student.section_id:
                    valid_assignment = True
                    break

        if not valid_assignment:
             raise HTTPException(status_code=403, detail="Not authorized to publish marks for this student/subject")

    marks.is_published = True
    db.commit()
    return {"message": "Marks published and locked"}

@router.put("/exams/marks/{marks_id}/override", response_model=MarksEntryResponse)
def override_marks(
    marks_id: str,
    override_data: MarksOverride,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    marks = db.query(academic_models.MarksEntry).filter(
        academic_models.MarksEntry.id == marks_id,
        academic_models.MarksEntry.school_id == str(tenant.school_id)
    ).first()

    if not marks:
        raise HTTPException(status_code=404, detail="Marks entry not found")

    set_reason(override_data.reason)

    marks.marks_obtained = override_data.marks_obtained
    db.commit()
    db.refresh(marks)
    return marks

@router.get("/exams/results", response_model=List[MarksEntryResponse])
def get_exam_results(
    student_id: Optional[str] = None,
    exam_term_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.STUDENT, Roles.PARENT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    target_student_id = None
    if user.role == Roles.STUDENT:
        student = db.query(student_models.Student).filter(student_models.Student.email == user.email, student_models.Student.school_id == str(tenant.school_id)).first()
        if not student:
             raise HTTPException(status_code=404, detail="Student profile not found")
        target_student_id = student.id
    elif user.role == Roles.PARENT:
        if not student_id:
            raise HTTPException(status_code=400, detail="student_id required")
        link = db.query(student_models.ParentStudentLink).filter(
            student_models.ParentStudentLink.parent_id == user.id,
            student_models.ParentStudentLink.student_id == student_id,
            student_models.ParentStudentLink.school_id == str(tenant.school_id)
        ).first()
        if not link:
             raise HTTPException(status_code=403, detail="Not authorized for this student")
        target_student_id = student_id

    query = db.query(academic_models.MarksEntry).filter(
        academic_models.MarksEntry.student_id == target_student_id,
        academic_models.MarksEntry.school_id == str(tenant.school_id),
        academic_models.MarksEntry.is_published == True 
    )

    if exam_term_id:
        query = query.filter(academic_models.MarksEntry.exam_term_id == exam_term_id)

    return query.all()

@router.get("/performance/trends", response_model=List[PerformanceTrend])
def get_performance_trends(
    student_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.STUDENT, Roles.PARENT, Roles.TEACHER, Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    target_student_id = None
    if user.role == Roles.STUDENT:
        student = db.query(student_models.Student).filter(student_models.Student.email == user.email, student_models.Student.school_id == str(tenant.school_id)).first()
        if not student:
             raise HTTPException(status_code=404, detail="Student profile not found")
        target_student_id = student.id
    elif user.role == Roles.PARENT:
        if not student_id:
            raise HTTPException(status_code=400, detail="student_id required")
        link = db.query(student_models.ParentStudentLink).filter(
            student_models.ParentStudentLink.parent_id == user.id,
            student_models.ParentStudentLink.student_id == student_id,
            student_models.ParentStudentLink.school_id == str(tenant.school_id)
        ).first()
        if not link:
             raise HTTPException(status_code=403, detail="Not authorized")
        target_student_id = student_id
    elif user.role == Roles.TEACHER:
        if not student_id:
            raise HTTPException(status_code=400, detail="student_id required")
        student = db.query(student_models.Student).filter(student_models.Student.id == student_id, student_models.Student.school_id == str(tenant.school_id)).first()
        if not student:
             raise HTTPException(status_code=404, detail="Student not found")

        assignment = db.query(academic_models.TeacherAssignment).filter(
            academic_models.TeacherAssignment.teacher_id == user.id,
            academic_models.TeacherAssignment.grade_id == student.grade_id,
            academic_models.TeacherAssignment.school_id == str(tenant.school_id)
        ).all()
        valid = False
        for asn in assignment:
            if asn.section_id is None or asn.section_id == student.section_id:
                valid = True
                break
        if not valid:
             raise HTTPException(status_code=403, detail="Not authorized")
        target_student_id = student_id
    else: 
         if not student_id:
             raise HTTPException(status_code=400, detail="student_id required")
         target_student_id = student_id

    from sqlalchemy import func

    results = db.query(
        academic_models.ExamTerm.name,
        func.avg(academic_models.MarksEntry.marks_obtained).label('average')
    ).join(academic_models.ExamTerm, academic_models.ExamTerm.id == academic_models.MarksEntry.exam_term_id).filter(
        academic_models.MarksEntry.student_id == target_student_id,
        academic_models.MarksEntry.is_published == True,
        academic_models.MarksEntry.school_id == str(tenant.school_id)
    ).group_by(academic_models.ExamTerm.name, academic_models.ExamTerm.id).all()

    trends = []
    for r in results:
        trends.append(PerformanceTrend(exam_term_name=r.name, average_score=round(r.average, 2)))

    return trends

@router.post("/assessment-types", response_model=AssessmentTypeResponse)
def create_assessment_type(
    type_data: AssessmentTypeCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    new_type = academic_models.AssessmentType(
        name=type_data.name,
        school_id=str(tenant.school_id)
    )
    db.add(new_type)
    db.commit()
    db.refresh(new_type)
    return new_type

@router.get("/assessment-types", response_model=List[AssessmentTypeResponse])
def list_assessment_types(
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    return db.query(academic_models.AssessmentType).filter(academic_models.AssessmentType.school_id == str(tenant.school_id)).all()

@router.post("/assessments", response_model=AssessmentResponse)
def create_assessment(
    data: AssessmentCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    new_assessment = academic_models.Assessment(
        name=data.name,
        subject_id=data.subject_id,
        exam_term_id=data.exam_term_id,
        max_marks=data.max_marks,
        assessment_type_id=data.assessment_type_id,
        school_id=str(tenant.school_id)
    )
    db.add(new_assessment)
    db.commit()
    db.refresh(new_assessment)
    return new_assessment

@router.get("/assessments", response_model=List[AssessmentResponse])
def list_assessments(
    subject_id: Optional[str] = None,
    exam_term_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    query = db.query(academic_models.Assessment).filter(academic_models.Assessment.school_id == str(tenant.school_id))
    if subject_id:
        query = query.filter(academic_models.Assessment.subject_id == subject_id)
    if exam_term_id:
        query = query.filter(academic_models.Assessment.exam_term_id == exam_term_id)
    return query.all()

@router.post("/assessments/scores")
def bulk_enter_scores(
    input_data: BulkScoreInput,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    assessment = db.query(academic_models.Assessment).filter(
        academic_models.Assessment.id == input_data.assessment_id,
        academic_models.Assessment.school_id == str(tenant.school_id)
    ).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    updated_student_ids = []

    for item in input_data.scores:
        if item.score > assessment.max_marks:
             raise HTTPException(status_code=400, detail=f"Score {item.score} exceeds max marks {assessment.max_marks} for student {item.student_id}")

        existing = db.query(academic_models.StudentAssessmentScore).filter(
            academic_models.StudentAssessmentScore.assessment_id == assessment.id,
            academic_models.StudentAssessmentScore.student_id == item.student_id,
            academic_models.StudentAssessmentScore.school_id == str(tenant.school_id)
        ).first()

        if existing:
            existing.score = item.score
        else:
            new_score = academic_models.StudentAssessmentScore(
                assessment_id=assessment.id,
                student_id=item.student_id,
                score=item.score,
                school_id=str(tenant.school_id)
            )
            db.add(new_score)
        
        if item.student_id not in updated_student_ids:
            updated_student_ids.append(item.student_id)

    db.commit()

    term_assessments = db.query(academic_models.Assessment).filter(
        academic_models.Assessment.subject_id == assessment.subject_id,
        academic_models.Assessment.exam_term_id == assessment.exam_term_id,
        academic_models.Assessment.school_id == str(tenant.school_id)
    ).all()
    
    total_possible_marks = sum(a.max_marks for a in term_assessments)
    assessment_ids = [a.id for a in term_assessments]

    for student_id in updated_student_ids:
        scores = db.query(academic_models.StudentAssessmentScore).filter(
            academic_models.StudentAssessmentScore.student_id == student_id,
            academic_models.StudentAssessmentScore.assessment_id.in_(assessment_ids)
        ).all()
        
        total_score = sum(s.score for s in scores)
        
        marks_entry = db.query(academic_models.MarksEntry).filter(
            academic_models.MarksEntry.student_id == student_id,
            academic_models.MarksEntry.subject_id == assessment.subject_id,
            academic_models.MarksEntry.exam_term_id == assessment.exam_term_id,
            academic_models.MarksEntry.school_id == str(tenant.school_id)
        ).first()
        
        if marks_entry:
            if marks_entry.is_published and user.role == Roles.TEACHER:
                 pass
            else:
                marks_entry.marks_obtained = int(total_score)
                marks_entry.total_marks = total_possible_marks
        else:
             new_entry = academic_models.MarksEntry(
                student_id=student_id,
                subject_id=assessment.subject_id,
                exam_term_id=assessment.exam_term_id,
                marks_obtained=int(total_score),
                total_marks=total_possible_marks,
                school_id=str(tenant.school_id),
                is_published=False
             )
             db.add(new_entry)

    db.commit()
    return {"message": "Scores updated and final grades recalculated"}

# --- STUDENT ASSESSMENTS ENDPOINT ---

class StudentAssessmentView(BaseModel):
    id: str
    title: str
    description: Optional[str]
    subject_name: str
    due_date: Optional[datetime]
    max_marks: int
    status: str = "PENDING" # Placeholder for future submission status
    
@router.get("/assessments/student/me", response_model=List[StudentAssessmentView])
def get_my_assessments(
    range: str = Query("upcoming", enum=["upcoming", "past", "all"]),
    db: Session = Depends(get_db),
    user: school_models.User = Depends(require_roles(Roles.STUDENT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """
    Get assessments for the logged-in student.
    Filters by student's grade/section scope.
    """
    # 1. Resolve Student
    student = db.query(student_models.Student).filter(
        student_models.Student.user_id == str(user.id),
        student_models.Student.school_id == str(tenant.school_id)
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    # 2. Base Query
    query = db.query(academic_models.Assessment, academic_models.Subject).join(
        academic_models.Subject, academic_models.Subject.id == academic_models.Assessment.subject_id
    ).filter(
        academic_models.Assessment.school_id == str(tenant.school_id)
    )

    # 3. Apply Scoping Rules
    # Logic: Assessment must target (My Section OR My Grade OR Global)
    # AND Subject must match? Usually subject is implicitly scoped by grade.
    
    # Clause: 
    # (section_id == student.section_id) OR (section_id IS NULL AND grade_id == student.grade_id) OR (section_id IS NULL AND grade_id IS NULL)
    
    from sqlalchemy import or_, and_
    
    scope_filter = or_(
        academic_models.Assessment.section_id == student.section_id,
        and_(academic_models.Assessment.section_id == None, academic_models.Assessment.grade_id == student.grade_id),
        and_(academic_models.Assessment.section_id == None, academic_models.Assessment.grade_id == None)
    )
    query = query.filter(scope_filter)

    # 4. Date Filter
    time_filter = None
    now = datetime.now(timezone.utc)
    
    if range == "upcoming":
        time_filter = or_(academic_models.Assessment.due_date >= now, academic_models.Assessment.due_date == None)
        query = query.filter(time_filter).order_by(academic_models.Assessment.due_date.asc().nullsfirst())
    elif range == "past":
        time_filter = academic_models.Assessment.due_date < now
        query = query.filter(time_filter).order_by(academic_models.Assessment.due_date.desc())
    else:
        query = query.order_by(academic_models.Assessment.due_date.desc())

    results = query.all()
    
    # 5. Transform
    response = []
    for assess, subj in results:
        response.append(StudentAssessmentView(
            id=assess.id,
            title=assess.name,
            description=assess.description,
            subject_name=subj.name,
            due_date=assess.due_date,
            max_marks=assess.max_marks,
            status="PENDING" # To be implemented with submissions table
        ))
        
    return response
