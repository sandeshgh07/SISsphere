
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
@router.post("/period-structures", response_model=academic_schemas.PeriodStructureResponse)
def create_period_structure(
    structure: academic_schemas.PeriodStructureCreate,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    # Logic to handle defaults vs specific year
    new_struct = academic_models.PeriodStructure(
        academic_year_id=structure.academic_year_id,
        structure=structure.structure,
        school_id=str(tenant.school_id)
    )
    db.add(new_struct)
    db.commit()
    db.refresh(new_struct)
    return new_struct

@router.get("/period-structures", response_model=List[academic_schemas.PeriodStructureResponse])
def list_period_structures(
    academic_year_id: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant: TenantAccess = Depends(TenantAccess),
    user=Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER, Roles.TEACHER))
):
    query = db.query(academic_models.PeriodStructure).filter(
        academic_models.PeriodStructure.school_id == str(tenant.school_id)
    )
    if academic_year_id:
        query = query.filter(academic_models.PeriodStructure.academic_year_id == academic_year_id)
    return query.all()
