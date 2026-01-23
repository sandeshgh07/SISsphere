from fastapi import APIRouter, Depends, Query, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, case, and_
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone

from auth.dependencies import get_db, get_current_user, Roles
from auth.subscription import require_subscription_feature
from schools import models as school_models
from students import models as student_models
from attendance import models as attendance_models
from academics import models as academic_models
from finance import models as finance_models
from analytics.service import StudentHealthService
from finance.analytics_service import FinanceAnalyticsService
from pydantic import BaseModel

router = APIRouter()

# --- Request/Response Schemas ---

class ScenarioRequest(BaseModel):
    tuition_increase_pct: Optional[float] = 0.0
    new_section_grade_id: Optional[str] = None

class ActionTakenRequest(BaseModel):
    action_taken: str

# --- Endpoints ---

@router.post("/early-warning/generate", dependencies=[Depends(require_subscription_feature("pro_analytics"))])
def generate_early_warning_alerts(
    db: Session = Depends(get_db),
    current_user: school_models.User = Depends(get_current_user)
):
    school_id = current_user.school_id
    alerts_generated = 0

    # 1. Fetch Students
    students = db.query(student_models.Student).filter(
        student_models.Student.school_id == school_id,
        student_models.Student.is_active == True
    ).all()

    # 2. Get Last 3 Exam Terms (sorted by date)
    terms = db.query(academic_models.ExamTerm).filter(
        academic_models.ExamTerm.school_id == school_id
    ).order_by(desc(academic_models.ExamTerm.start_date)).limit(3).all()

    terms.sort(key=lambda x: x.start_date if x.start_date else datetime.min.date(), reverse=True)

    term1 = terms[0] if len(terms) > 0 else None
    term2 = terms[1] if len(terms) > 1 else None
    term3 = terms[2] if len(terms) > 2 else None

    # 3. Analyze each student
    today = datetime.now(timezone.utc).date()
    cutoff_14 = today - timedelta(days=14)
    cutoff_28 = today - timedelta(days=28)

    for student in students:
        risk_types = []
        description = []

        # --- A. Attendance Drop ---
        days_last_14 = db.query(func.count(attendance_models.Attendance.id)).filter(
            attendance_models.Attendance.student_id == student.id,
            attendance_models.Attendance.date >= cutoff_14
        ).scalar()

        present_last_14 = 0
        if days_last_14 > 0:
            present_last_14 = db.query(func.count(attendance_models.Attendance.id)).filter(
                attendance_models.Attendance.student_id == student.id,
                attendance_models.Attendance.date >= cutoff_14,
                attendance_models.Attendance.status == attendance_models.AttendanceStatus.PRESENT
            ).scalar()

        rate_last_14 = (present_last_14 / days_last_14) if days_last_14 > 0 else 1.0

        days_prev_14 = db.query(func.count(attendance_models.Attendance.id)).filter(
            attendance_models.Attendance.student_id == student.id,
            attendance_models.Attendance.date >= cutoff_28,
            attendance_models.Attendance.date < cutoff_14
        ).scalar()

        present_prev_14 = 0
        if days_prev_14 > 0:
            present_prev_14 = db.query(func.count(attendance_models.Attendance.id)).filter(
                attendance_models.Attendance.student_id == student.id,
                attendance_models.Attendance.date >= cutoff_28,
                attendance_models.Attendance.date < cutoff_14,
                attendance_models.Attendance.status == attendance_models.AttendanceStatus.PRESENT
            ).scalar()

        rate_prev_14 = (present_prev_14 / days_prev_14) if days_prev_14 > 0 else 1.0

        if rate_last_14 < (rate_prev_14 * 0.8):
            risk_types.append("ATTENDANCE")
            description.append(f"Attendance dropped from {rate_prev_14*100:.1f}% to {rate_last_14*100:.1f}% in last 14 days.")

        # --- B. Performance Deceleration ---
        if term1 and term2 and term3:
            def get_avg(tid):
                avg = db.query(func.avg(academic_models.MarksEntry.marks_obtained)).filter(
                    academic_models.MarksEntry.student_id == student.id,
                    academic_models.MarksEntry.exam_term_id == tid
                ).scalar()
                return avg if avg is not None else 0.0

            avg1 = get_avg(term1.id)
            avg2 = get_avg(term2.id)
            avg3 = get_avg(term3.id)

            if avg3 > avg2 > avg1:
                risk_types.append("ACADEMIC")
                description.append(f"Grades trending down: {avg3:.1f} -> {avg2:.1f} -> {avg1:.1f}")

        if risk_types:
            existing_alert = db.query(student_models.StudentRiskAlert).filter(
                student_models.StudentRiskAlert.student_id == student.id,
                student_models.StudentRiskAlert.is_resolved == False
            ).first()

            if not existing_alert:
                alert = student_models.StudentRiskAlert(
                    student_id=student.id,
                    type=",".join(risk_types),
                    severity=student_models.RiskSeverity.HIGH,
                    description="; ".join(description),
                    school_id=school_id
                )
                db.add(alert)
                alerts_generated += 1

    db.commit()
    return {"message": "Analysis complete", "alerts_generated": alerts_generated}

@router.get("/early-warning", dependencies=[Depends(require_subscription_feature("pro_analytics"))])
def get_early_warning_alerts(
    db: Session = Depends(get_db),
    current_user: school_models.User = Depends(get_current_user)
):
    school_id = current_user.school_id
    alerts = db.query(student_models.StudentRiskAlert).filter(
        student_models.StudentRiskAlert.school_id == school_id,
        student_models.StudentRiskAlert.is_resolved == False
    ).all()

    result = []
    for alert in alerts:
        student = db.query(student_models.Student).filter(student_models.Student.id == alert.student_id).first()
        result.append({
            "id": alert.id,
            "student_name": f"{student.first_name} {student.last_name}" if student else "Unknown",
            "type": alert.type,
            "severity": alert.severity,
            "description": alert.description,
            "action_taken": alert.action_taken,
            "created_at": alert.created_at
        })
    return result

@router.patch("/early-warning/{alert_id}/action", dependencies=[Depends(require_subscription_feature("pro_analytics"))])
def update_alert_action(
    alert_id: str,
    action: ActionTakenRequest,
    db: Session = Depends(get_db),
    current_user: school_models.User = Depends(get_current_user)
):
    school_id = current_user.school_id
    alert = db.query(student_models.StudentRiskAlert).filter(
        student_models.StudentRiskAlert.id == alert_id,
        student_models.StudentRiskAlert.school_id == school_id
    ).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.action_taken = action.action_taken
    db.commit()
    return {"message": "Action updated"}

@router.get("/financial-forecast", dependencies=[Depends(require_subscription_feature("pro_analytics"))])
def get_financial_forecast(
    db: Session = Depends(get_db),
    current_user: school_models.User = Depends(get_current_user)
):
    school_id = current_user.school_id

    # 1. Historical Payment Speed
    paid_fees = db.query(finance_models.Fee).filter(
        finance_models.Fee.school_id == school_id,
        finance_models.Fee.status == "paid",
        finance_models.Fee.paid_date != None,
        finance_models.Fee.due_date != None
    ).all()

    total_days = 0
    count = 0
    for fee in paid_fees:
        if fee.paid_date > fee.due_date:
            diff = (fee.paid_date - fee.due_date).days
            total_days += diff
            count += 1

    avg_delay_days = (total_days / count) if count > 0 else 0

    # 2. Attrition Impact
    high_risk_alerts = db.query(student_models.StudentRiskAlert).filter(
        student_models.StudentRiskAlert.school_id == school_id,
        student_models.StudentRiskAlert.is_resolved == False
    ).all()
    high_risk_student_ids = [a.student_id for a in high_risk_alerts]

    attrition_loss = db.query(func.sum(finance_models.Fee.amount)).filter(
        finance_models.Fee.school_id == school_id,
        finance_models.Fee.status == "pending",
        finance_models.Fee.student_id.in_(high_risk_student_ids)
    ).scalar() or 0.0

    # 3. Cash Flow Projection (6 months)
    projection = {}
    pending_fees = db.query(finance_models.Fee).filter(
        finance_models.Fee.school_id == school_id,
        finance_models.Fee.status == "pending",
        finance_models.Fee.due_date != None
    ).all()

    today = datetime.now(timezone.utc)

    for fee in pending_fees:
        expected_date = fee.due_date + timedelta(days=avg_delay_days)
        if expected_date.tzinfo is None:
            expected_date = expected_date.replace(tzinfo=timezone.utc)

        if expected_date < today:
            expected_date = today

        month_key = expected_date.strftime("%Y-%m")
        projection[month_key] = projection.get(month_key, 0.0) + fee.amount

    sorted_months = sorted(projection.keys())[:6]
    cash_flow = {m: projection[m] for m in sorted_months}

    # 4. Bad Debt Aging
    aging = {"30_days": 0.0, "60_days": 0.0, "90_plus_days": 0.0}

    for fee in pending_fees:
        due_date_aware = fee.due_date
        if due_date_aware.tzinfo is None:
            due_date_aware = due_date_aware.replace(tzinfo=timezone.utc)

        if due_date_aware < today:
            overdue_days = (today - due_date_aware).days
            if overdue_days >= 90:
                aging["90_plus_days"] += fee.amount
            elif overdue_days >= 60:
                aging["60_days"] += fee.amount
            elif overdue_days >= 30:
                aging["30_days"] += fee.amount

    return {
        "avg_payment_delay_days": avg_delay_days,
        "attrition_risk_amount": attrition_loss,
        "cash_flow_projection": cash_flow,
        "bad_debt_aging": aging
    }

@router.get("/resource-insights", dependencies=[Depends(require_subscription_feature("pro_analytics"))])
def get_resource_insights(
    db: Session = Depends(get_db),
    current_user: school_models.User = Depends(get_current_user)
):
    school_id = current_user.school_id
    assignments = db.query(academic_models.TeacherAssignment).filter(
        academic_models.TeacherAssignment.school_id == school_id
    ).all()

    teacher_stats = {}
    terms = db.query(academic_models.ExamTerm).filter(
        academic_models.ExamTerm.school_id == school_id
    ).order_by(desc(academic_models.ExamTerm.start_date)).limit(2).all()
    terms.sort(key=lambda x: x.start_date if x.start_date else datetime.min.date())

    if len(terms) == 2:
        t1 = terms[0]
        t2 = terms[1]

        for assign in assignments:
            if not (assign.grade_id and assign.section_id and assign.subject_id):
                continue

            students = db.query(student_models.Student).filter(
                student_models.Student.grade_id == assign.grade_id,
                student_models.Student.section_id == assign.section_id,
                student_models.Student.school_id == school_id
            ).all()

            deltas = []
            for s in students:
                m1 = db.query(academic_models.MarksEntry.marks_obtained).filter(
                    academic_models.MarksEntry.student_id == s.id,
                    academic_models.MarksEntry.exam_term_id == t1.id,
                    academic_models.MarksEntry.subject_id == assign.subject_id
                ).scalar()
                m2 = db.query(academic_models.MarksEntry.marks_obtained).filter(
                    academic_models.MarksEntry.student_id == s.id,
                    academic_models.MarksEntry.exam_term_id == t2.id,
                    academic_models.MarksEntry.subject_id == assign.subject_id
                ).scalar()

                if m1 is not None and m2 is not None:
                    deltas.append(m2 - m1)

            if deltas:
                avg_delta = sum(deltas) / len(deltas)
                teacher = db.query(school_models.User).filter(school_models.User.id == assign.teacher_id).first()
                t_name = f"{teacher.first_name} {teacher.last_name}" if teacher else "Unknown"
                subject = db.query(academic_models.Subject).filter(academic_models.Subject.id == assign.subject_id).first()
                s_name = subject.name if subject else "Unknown"

                teacher_stats[t_name] = teacher_stats.get(t_name, [])
                teacher_stats[t_name].append({
                    "subject": s_name,
                    "avg_improvement": avg_delta
                })

    sections = db.query(academic_models.Section).filter(academic_models.Section.school_id == school_id).all()
    ratio_alerts = []

    for section in sections:
        student_count = db.query(func.count(student_models.Student.id)).filter(
            student_models.Student.section_id == section.id,
            student_models.Student.school_id == school_id,
            student_models.Student.is_active == True
        ).scalar()

        if student_count > 35:
            ratio_alerts.append({
                "section": section.name,
                "ratio": f"{student_count}:1",
                "status": "OVERCROWDED"
            })

    return {
        "teacher_effectiveness": teacher_stats,
        "ratio_alerts": ratio_alerts
    }

@router.post("/scenario", dependencies=[Depends(require_subscription_feature("pro_analytics"))])
def run_scenario(
    request: ScenarioRequest,
    db: Session = Depends(get_db),
    current_user: school_models.User = Depends(get_current_user)
):
    school_id = current_user.school_id
    result = {}

    if request.tuition_increase_pct > 0:
        pending_amount = db.query(func.sum(finance_models.Fee.amount)).filter(
            finance_models.Fee.school_id == school_id,
            finance_models.Fee.status == "pending"
        ).scalar() or 0.0

        increase_amount = pending_amount * (request.tuition_increase_pct / 100.0)
        result["revenue_impact"] = {
            "current_pending": pending_amount,
            "projected_increase": increase_amount,
            "total_projected": pending_amount + increase_amount
        }

    if request.new_section_grade_id:
        grade = db.query(academic_models.Grade).filter(
            academic_models.Grade.id == request.new_section_grade_id,
            academic_models.Grade.school_id == school_id
        ).first()

        if grade:
            active_subjects = db.query(academic_models.TeacherAssignment.subject_id).filter(
                academic_models.TeacherAssignment.grade_id == grade.id,
                academic_models.TeacherAssignment.school_id == school_id
            ).distinct().count()

            result["workload_impact"] = f"Adding a section to {grade.name} will require coverage for {active_subjects} subjects/classes."
        else:
            result["workload_impact"] = "Grade not found."

    return result

@router.get("/student/{student_id}/profile", dependencies=[Depends(require_subscription_feature("pro_analytics"))])
def get_student_profile(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: school_models.User = Depends(get_current_user)
):
    school_id = current_user.school_id
    service = StudentHealthService(db, school_id)

    student = db.query(student_models.Student).filter(
        student_models.Student.id == student_id,
        student_models.Student.school_id == school_id
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    is_admin = current_user.role in ["superuser", "principal", "super_admin"]
    is_teacher = current_user.role == "teacher"
    is_parent = current_user.role == "parent"
    is_student = current_user.role == "student"

    if is_parent:
        link = db.query(student_models.ParentStudentLink).filter(
            student_models.ParentStudentLink.parent_id == current_user.id,
            student_models.ParentStudentLink.student_id == student_id
        ).first()
        if not link:
            raise HTTPException(status_code=403, detail="Access denied")
    elif is_student:
        if student.email != current_user.email:
             raise HTTPException(status_code=403, detail="Access denied")
    elif is_teacher:
        pass
    elif not is_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    response = {
        "student_info": {
            "name": f"{student.first_name} {student.last_name}",
            "id": student.id
        }
    }

    response["academic_trend"] = service.get_academic_trend(student_id)
    response["attendance_heatmap"] = service.get_attendance_heatmap(student_id)

    risk_score = service.calculate_risk_score(student_id)

    if is_admin or is_teacher:
        response["risk_score"] = risk_score
    else:
        label = "Excellent"
        if risk_score < 40: label = "Critical"
        elif risk_score < 60: label = "Needs Improvement"
        elif risk_score < 80: label = "Good"

        response["progress_level"] = {"score": risk_score, "label": label}

    if is_admin:
        response["teacher_value_add"] = service.get_teacher_value_add(student_id)

    if is_admin or is_teacher:
        response["subject_comparison"] = service.get_subject_comparison(student_id)

    if is_admin or is_parent or is_student:
        response["fee_invoices"] = service.get_fee_invoices(student_id)

    return response

@router.get("/student-health")
def get_my_student_health(
    db: Session = Depends(get_db),
    current_user: school_models.User = Depends(get_current_user)
):
    # If Admin, return a generic dashboard view
    if current_user.role in [Roles.SUPER_USER, Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.TEACHER]:
        return {
            "student_info": {"name": f"{current_user.first_name} (Admin)", "id": current_user.id},
            "academic_trend": [],
            "attendance_heatmap": [],
            "progress_level": None,
            "fee_invoices": []
        }

    student_id = None

    if current_user.role == Roles.STUDENT:
        student = db.query(student_models.Student).filter(
            student_models.Student.email == current_user.email,
            student_models.Student.school_id == current_user.school_id
        ).first()
        if student:
            student_id = student.id

    elif current_user.role == Roles.PARENT:
        link = db.query(student_models.ParentStudentLink).filter(
            student_models.ParentStudentLink.parent_id == current_user.id
        ).first()
        if link:
            student_id = link.student_id

    if not student_id:
        return {
             "student_info": {"name": "No Student Linked", "id": ""},
             "academic_trend": [],
             "attendance_heatmap": [],
             "fee_invoices": []
        }

    return get_student_profile(student_id, db, current_user)

@router.get("/admin/analytics/overview", dependencies=[Depends(require_subscription_feature("pro_analytics"))])
def get_admin_overview(
    db: Session = Depends(get_db),
    current_user: school_models.User = Depends(get_current_user)
):
    if current_user.role not in ["superuser", "principal", "super_admin"]:
         raise HTTPException(status_code=403, detail="Access denied")

    school_id = current_user.school_id

    total_students = db.query(func.count(student_models.Student.id)).filter(
        student_models.Student.school_id == school_id,
        student_models.Student.is_active == True
    ).scalar()

    at_risk_count = db.query(func.count(student_models.StudentRiskAlert.id)).filter(
        student_models.StudentRiskAlert.school_id == school_id,
        student_models.StudentRiskAlert.is_resolved == False,
        student_models.StudentRiskAlert.severity == student_models.RiskSeverity.HIGH
    ).scalar()

    paid_fees = db.query(finance_models.Fee).filter(
        finance_models.Fee.school_id == school_id,
        finance_models.Fee.status == "paid",
        finance_models.Fee.paid_date != None,
        finance_models.Fee.due_date != None
    ).all()

    total_days = 0
    count = 0
    for fee in paid_fees:
        if fee.paid_date > fee.due_date:
            diff = (fee.paid_date - fee.due_date).days
            total_days += diff
            count += 1

    avg_velocity = (total_days / count) if count > 0 else 0

    return {
        "school_pulse": {
            "total_students": total_students,
            "at_risk_students": at_risk_count
        },
        "financial_velocity": {
            "average_payment_days": avg_velocity
        }
    }

@router.get("/finance/snapshot", dependencies=[Depends(require_subscription_feature("pro_analytics"))])
def get_finance_snapshot(
    db: Session = Depends(get_db),
    current_user: school_models.User = Depends(get_current_user)
):
    # Allow Board (Principal/Admin) and Accountant
    allowed_roles = ["superuser", "principal", "super_admin", "accountant"]
    if current_user.role not in allowed_roles:
         raise HTTPException(status_code=403, detail="Access denied")

    service = FinanceAnalyticsService(db, current_user.school_id)
    return service.get_triple_day_snapshot()

@router.get("/finance/revenue-velocity", dependencies=[Depends(require_subscription_feature("pro_analytics"))])
def get_revenue_velocity(
    period: str = Query("monthly", regex="^(weekly|monthly|yearly)$"),
    db: Session = Depends(get_db),
    current_user: school_models.User = Depends(get_current_user)
):
    allowed_roles = ["superuser", "principal", "super_admin", "accountant"]
    if current_user.role not in allowed_roles:
         raise HTTPException(status_code=403, detail="Access denied")

    service = FinanceAnalyticsService(db, current_user.school_id)
    return service.get_revenue_velocity(period)

@router.get("/finance/velocity", dependencies=[Depends(require_subscription_feature("pro_analytics"))])
def get_finance_velocity(
    db: Session = Depends(get_db),
    current_user: school_models.User = Depends(get_current_user)
):
    # Allow Board (Principal/Admin) and Accountant
    allowed_roles = ["superuser", "principal", "super_admin", "accountant"]
    if current_user.role not in allowed_roles:
         raise HTTPException(status_code=403, detail="Access denied")

    service = FinanceAnalyticsService(db, current_user.school_id)
    return service.get_financial_velocity()
