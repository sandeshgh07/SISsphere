
from sqlalchemy.orm import Session
from database import SessionLocal
from finance import models as fin_models
from students import models as stu_models
from finance import invoice_generator
import json

def debug():
    db = SessionLocal()
    try:
        # 1. Find Student
        # Searching by name for "prakriti lc"
        student = db.query(stu_models.Student).filter(
            stu_models.Student.first_name.ilike("%prakriti%"),
            stu_models.Student.last_name.ilike("%lc%")
        ).first()
        
        if not student:
            print("Student 'prakriti lc' not found.")
            return

        print(f"Found Student: {student.first_name} {student.last_name} ({student.id})")
        print(f"Grade: {student.grade_id}")

        # 2. Find the Applied Rule
        rule = db.query(fin_models.DiscountRule).filter(
            fin_models.DiscountRule.title.ilike("%manual 10% (Applied)%"),
            fin_models.DiscountRule.student_id == student.id
        ).first()

        if not rule:
            print("Applied discount rule not found for student.")
            # List all rules for student to be sure
            rules = db.query(fin_models.DiscountRule).filter(fin_models.DiscountRule.student_id == student.id).all()
            print(f"Student has {len(rules)} other rules: {[r.title for r in rules]}")
            return

        print(f"\n--- Rule Details ---")
        print(f"ID: {rule.id}")
        print(f"Title: {rule.title}")
        print(f"Type: {rule.discount_type}")
        print(f"Value: {rule.value}")
        print(f"ApplyTo: {rule.apply_to_fee_templates}")
        print(f"Template IDs: {rule.fee_template_ids}")
        print(f"Legacy Template ID: {rule.applies_to_fee_template_id}")
        print(f"Scope: {rule.scope_type}")
        print(f"Active: {rule.is_active}")
        print(f"Start: {rule.start_date}, End: {rule.end_date}")

        # 3. Simulate Calculation for 2026-02
        period = "2026-02"
        print(f"\n--- Simulating Calculation for {period} ---")
        
        # Fetch templates like router does
        all_templates = db.query(fin_models.FeeItemTemplate).filter(
            fin_models.FeeItemTemplate.school_id == student.school_id,
            fin_models.FeeItemTemplate.is_active == "true"
        ).all()
        
        templates_by_grade = {}
        all_grade_templates = []
        for t in all_templates:
            if t.grade_id:
                templates_by_grade.setdefault(t.grade_id, []).append(t)
            else:
                all_grade_templates.append(t)
                
        addons_by_student = {student.id: []} # Assuming no addons for checking core calc first
        discounts_by_student = {student.id: [rule]}
        global_discounts = [] 

        result = invoice_generator.calculate_student_fees(
            student, period, templates_by_grade, all_grade_templates, addons_by_student, discounts_by_student, global_discounts
        )
        
        print(f"Subtotal: {result['subtotal']}")
        print(f"Discount Total: {result['discount_total']}")
        
        print("\n--- Line Items ---")
        for line in result["lines"]:
            print(f"Template: {line['description']} (ID: {line['template'].id})")
            print(f"Base: {line['base_amount']}")
            print(f"Discount: {line['discount_amount']}")
            if line['rule_applied']:
                print(f"  MATCHED RULE: {line['rule_applied'].title}")
            else:
                print(f"  NO MATCH. Analysis:")
                # Analyze why no match against our rule
                t = line['template']
                # Re-run logic checks manually for visibility
                print(f"  Checking against rule {rule.title}...")
                
                # Check 3. Fee Template
                match_template = True
                if rule.apply_to_fee_templates == fin_models.DiscountApplyTo.SELECTED_TEMPLATES:
                    allowed = rule.fee_template_ids if isinstance(rule.fee_template_ids, list) else []
                    if str(t.id) not in allowed:
                        print(f"    FAIL: Template ID {t.id} not in allowed list {allowed}")
                        match_template = False
                
                if rule.applies_to_fee_template_id and rule.applies_to_fee_template_id != str(t.id):
                     print(f"    FAIL: Legacy ID mismatch {rule.applies_to_fee_template_id} != {t.id}")
                     match_template = False
                     
                if match_template:
                    print("    PASS: Template Check passed. Why no discount?")
                    print(f"    Value: {rule.value}, Type: {rule.discount_type}")

    finally:
        db.close()

if __name__ == "__main__":
    debug()
