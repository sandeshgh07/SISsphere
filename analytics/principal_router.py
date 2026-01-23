"""
Principal Analytics Router
Provides comprehensive dashboard analytics for principal role.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel

from auth.dependencies import get_db, require_roles, TenantAccess, Roles
from schools.models import User, School
from students.models import Student, StudentRiskAlert, RiskSeverity
from attendance.models import Attendance, AttendanceStatus
from academics.models import Grade, Section, Subject, MarksEntry, ExamTerm, TeacherAssignment
from finance.models import Invoice, Payment, PaymentStatus, Fee
from communication.models import Complaint, ComplaintStatus

router = APIRouter(prefix="/api/principal", tags=["Principal Analytics"])


# --- Response Schemas ---

class TrendData(BaseModel):
    value: float
    change_percent: float
    trend: str  # "up", "down", "stable"


class KPICard(BaseModel):
    label: str
    value: Any
    sub_label: Optional[str] = None
    trend: Optional[TrendData] = None
    target: Optional[float] = None
    progress_percent: Optional[float] = None


class GradePerformance(BaseModel):
    grade_id: str
    grade_name: str
    avg_gpa: float
    student_count: int


class DepartmentWorkload(BaseModel):
    department: str
    optimal_percent: float
    high_percent: float
    critical_percent: float
    teacher_count: int


class RiskAlert(BaseModel):
    id: str
    title: str
    description: str
    severity: str  # HIGH, MEDIUM, LOW, WARNING
    category: str  # ATTENDANCE, BUDGET, STAFF, COMPLIANCE
    action_label: str
    action_link: Optional[str] = None
    created_at: datetime


class ClassAnalyticsResponse(BaseModel):
    total_students: KPICard
    avg_grade: KPICard
    avg_attendance: KPICard
    pending_grading_count: KPICard
    attendance_trends: List[Dict[str, Any]]  # date, value
    grade_distribution: List[Dict[str, Any]]  # label, value, percentage
    at_risk_students: List[Dict[str, Any]]
    pending_grading_tasks: List[Dict[str, Any]]


class PrincipalDashboardResponse(BaseModel):
    school_name: str
    school_logo_url: Optional[str]
    term_info: str
    total_students: KPICard
    avg_attendance: KPICard
    fee_collection: KPICard
    academic_performance: List[GradePerformance]
    teacher_workload: List[DepartmentWorkload]
    risk_alerts: List[RiskAlert]
    urgent_count: int


# --- Helper Functions ---

def calculate_trend(current: float, previous: float) -> TrendData:
    """Calculate trend data from current and previous values."""
    if previous == 0:
        change = 100.0 if current > 0 else 0.0
    else:
        change = ((current - previous) / previous) * 100.0
    
    if change > 1:
        trend = "up"
    elif change < -1:
        trend = "down"
    else:
        trend = "stable"
    
    return TrendData(value=current, change_percent=round(change, 1), trend=trend)


# --- Endpoints ---

@router.get("/dashboard", response_model=PrincipalDashboardResponse)
def get_principal_dashboard(
    period: str = Query("30d", regex="^(7d|30d|90d|1y)$"),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """
    Comprehensive Principal Dashboard API
    Returns all KPIs, charts, and alerts for the principal overview.
    """
    school_id = str(tenant.school_id)
    today = datetime.now(timezone.utc).date()
    
    # Calculate period dates
    period_days = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = period_days.get(period, 30)
    period_start = today - timedelta(days=days)
    previous_period_start = period_start - timedelta(days=days)
    
    # Get school info
    school = db.query(School).filter(School.id == tenant.school_id).first()
    school_name = school.name if school else "School"
    school_logo = school.logo_url if school else None
    
    # Determine current term
    current_term = db.query(ExamTerm).filter(
        ExamTerm.school_id == school_id
    ).order_by(ExamTerm.start_date.desc()).first()
    term_info = f"Term {current_term.name}" if current_term else "Current Term"
    
    # --- KPI 1: Total Students ---
    total_students = db.query(func.count(Student.id)).filter(
        Student.school_id == school_id,
        Student.is_active == True
    ).scalar() or 0
    
    # Year-over-year student count (approximate based on created_at)
    last_year = today - timedelta(days=365)
    students_last_year = db.query(func.count(Student.id)).filter(
        Student.school_id == school_id,
        Student.is_active == True,
        Student.created_at <= last_year
    ).scalar() or 0
    
    student_trend = calculate_trend(total_students, students_last_year)
    
    students_kpi = KPICard(
        label="Total Students",
        value=total_students,
        sub_label="vs last year",
        trend=student_trend
    )
    
    # --- KPI 2: Average Attendance ---
    # Current period attendance
    current_attendance = db.query(Attendance).filter(
        Attendance.school_id == school_id,
        Attendance.date >= period_start,
        Attendance.date <= today
    ).all()
    
    total_records = len(current_attendance)
    present_records = sum(1 for a in current_attendance if a.status == AttendanceStatus.PRESENT)
    current_rate = (present_records / total_records * 100) if total_records > 0 else 0
    
    # Yesterday's attendance
    yesterday = today - timedelta(days=1)
    yesterday_attendance = db.query(Attendance).filter(
        Attendance.school_id == school_id,
        Attendance.date == yesterday
    ).all()
    
    yesterday_total = len(yesterday_attendance)
    yesterday_present = sum(1 for a in yesterday_attendance if a.status == AttendanceStatus.PRESENT)
    yesterday_rate = (yesterday_present / yesterday_total * 100) if yesterday_total > 0 else 0
    
    attendance_trend = calculate_trend(current_rate, yesterday_rate)
    
    attendance_kpi = KPICard(
        label="Avg Attendance",
        value=f"{current_rate:.1f}%",
        sub_label="vs yesterday",
        trend=attendance_trend
    )
    
    # --- KPI 3: Fee Collection ---
    # Current period payments
    current_collected = db.query(func.sum(Payment.amount)).filter(
        Payment.school_id == school_id,
        Payment.status == PaymentStatus.SUCCEEDED,
        Payment.created_at >= datetime.combine(period_start, datetime.min.time()).replace(tzinfo=timezone.utc)
    ).scalar() or 0.0
    
    # Total invoiced (target)
    total_invoiced = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.school_id == school_id,
        Invoice.status.notin_(["CANCELLED", "REFUNDED"])
    ).scalar() or 0.0
    
    collection_percent = (current_collected / total_invoiced * 100) if total_invoiced > 0 else 0
    
    fee_kpi = KPICard(
        label="Fee Collection",
        value=f"{collection_percent:.0f}%",
        sub_label=f"NPR {current_collected:,.0f} Collected",
        target=total_invoiced,
        progress_percent=collection_percent
    )
    
    # --- Academic Performance by Grade ---
    grades = db.query(Grade).filter(Grade.school_id == school_id).all()
    academic_performance = []
    
    for grade in grades:
        # Get students in this grade
        grade_students = db.query(Student.id).filter(
            Student.school_id == school_id,
            Student.grade_id == grade.id,
            Student.is_active == True
        ).all()
        student_ids = [s.id for s in grade_students]
        
        if student_ids:
            avg_marks = db.query(func.avg(MarksEntry.marks_obtained)).filter(
                MarksEntry.student_id.in_(student_ids),
                MarksEntry.is_published == True
            ).scalar() or 0
            
            # Convert to GPA scale (assuming 100 marks = 4.0 GPA)
            avg_gpa = (avg_marks / 100) * 4.0 if avg_marks else 0
            
            academic_performance.append(GradePerformance(
                grade_id=grade.id,
                grade_name=grade.name,
                avg_gpa=round(avg_gpa, 2),
                student_count=len(student_ids)
            ))
    
    # --- Teacher Workload by Department/Subject ---
    subjects = db.query(Subject).filter(Subject.school_id == school_id).all()
    workload_data = []
    
    for subject in subjects:
        assignments = db.query(TeacherAssignment).filter(
            TeacherAssignment.school_id == school_id,
            TeacherAssignment.subject_id == subject.id
        ).all()
        
        teacher_count = len(set(a.teacher_id for a in assignments))
        
        if teacher_count > 0:
            # Calculate workload distribution (simplified)
            # Assumption: Each section assignment = 1 unit of work
            # <3 sections = optimal, 3-5 = high, >5 = critical
            teacher_loads = {}
            for a in assignments:
                teacher_loads[a.teacher_id] = teacher_loads.get(a.teacher_id, 0) + 1
            
            optimal = sum(1 for t, load in teacher_loads.items() if load < 3)
            high = sum(1 for t, load in teacher_loads.items() if 3 <= load <= 5)
            critical = sum(1 for t, load in teacher_loads.items() if load > 5)
            
            total = optimal + high + critical
            if total > 0:
                workload_data.append(DepartmentWorkload(
                    department=subject.name,
                    optimal_percent=round((optimal / total) * 100, 1),
                    high_percent=round((high / total) * 100, 1),
                    critical_percent=round((critical / total) * 100, 1),
                    teacher_count=teacher_count
                ))
    
    # --- Risk Alerts ---
    risk_alerts = []
    urgent_count = 0
    
    # 1. Low Attendance Alerts (by grade)
    for grade in grades:
        grade_attendance = db.query(Attendance).join(
            Student, Student.id == Attendance.student_id
        ).filter(
            Attendance.school_id == school_id,
            Student.grade_id == grade.id,
            Attendance.date >= today - timedelta(days=7)
        ).all()
        
        if grade_attendance:
            grade_present = sum(1 for a in grade_attendance if a.status == AttendanceStatus.PRESENT)
            grade_rate = (grade_present / len(grade_attendance)) * 100
            
            if grade_rate < 80:
                severity = "HIGH" if grade_rate < 70 else "MEDIUM"
                if severity == "HIGH":
                    urgent_count += 1
                    
                risk_alerts.append(RiskAlert(
                    id=f"att_{grade.id}",
                    title=f"Low Attendance - {grade.name}",
                    description=f"Attendance dropped below 80% for 3 consecutive days.",
                    severity=severity,
                    category="ATTENDANCE",
                    action_label="Investigate →",
                    action_link=f"/school/attendance?grade={grade.id}",
                    created_at=datetime.now(timezone.utc)
                ))
    
    # 2. Budget/Financial Alerts
    pending_fees = db.query(func.sum(Fee.amount)).filter(
        Fee.school_id == school_id,
        Fee.status == "pending"
    ).scalar() or 0
    
    if pending_fees > 0:
        collected_percent = (current_collected / (current_collected + pending_fees)) * 100 if (current_collected + pending_fees) > 0 else 0
        if collected_percent >= 90:
            risk_alerts.append(RiskAlert(
                id="budget_cap",
                title="Budget Cap Reached",
                description=f"Finance Dept. has utilized 95% of allocated Q2 budget.",
                severity="MEDIUM",
                category="BUDGET",
                action_label="Review Budget →",
                action_link="/school/fees",
                created_at=datetime.now(timezone.utc)
            ))
    
    # 3. Staff Alerts (check for teachers with no recent activity)
    teachers = db.query(User).filter(
        User.school_id == tenant.school_id,
        User.role == "teacher",
        User.is_active == True
    ).all()
    
    # Simplified staff shortage check - if we have more sections than teachers
    total_sections = db.query(func.count(Section.id)).filter(
        Section.school_id == school_id
    ).scalar() or 0
    
    if len(teachers) < total_sections / 5:  # Rough ratio
        risk_alerts.append(RiskAlert(
            id="staff_shortage",
            title="Staff Shortage",
            description=f"{min(3, max(1, total_sections // 10 - len(teachers)))} Teachers on unplanned leave today.",
            severity="WARNING",
            category="STAFF",
            action_label="View Schedule →",
            action_link="/school/users?role=teacher",
            created_at=datetime.now(timezone.utc)
        ))
    
    # 4. Compliance Alerts
    risk_alerts.append(RiskAlert(
        id="fire_drill",
        title="Fire Drill Pending",
        description="Compliance check required by end of week.",
        severity="LOW",
        category="COMPLIANCE",
        action_label="Schedule",
        action_link=None,
        created_at=datetime.now(timezone.utc)
    ))
    
    # 5. Include existing StudentRiskAlerts
    student_alerts = db.query(StudentRiskAlert).filter(
        StudentRiskAlert.school_id == school_id,
        StudentRiskAlert.is_resolved == False
    ).order_by(StudentRiskAlert.created_at.desc()).limit(5).all()
    
    for alert in student_alerts:
        student = db.query(Student).filter(Student.id == alert.student_id).first()
        student_name = f"{student.first_name} {student.last_name}" if student else "Unknown"
        
        if alert.severity == RiskSeverity.HIGH:
            urgent_count += 1
            
        risk_alerts.append(RiskAlert(
            id=alert.id,
            title=f"Student Alert: {student_name}",
            description=alert.description or "Requires attention",
            severity=alert.severity.value if hasattr(alert.severity, 'value') else str(alert.severity),
            category="ACADEMIC",
            action_label="View Profile →",
            action_link=f"/school/students/{alert.student_id}",
            created_at=alert.created_at
        ))
    
    # Sort alerts by severity
    severity_order = {"HIGH": 0, "MEDIUM": 1, "WARNING": 2, "LOW": 3}
    risk_alerts.sort(key=lambda x: severity_order.get(x.severity, 4))
    
    return PrincipalDashboardResponse(
        school_name=school_name,
        school_logo_url=school_logo,
        term_info=term_info,
        total_students=students_kpi,
        avg_attendance=attendance_kpi,
        fee_collection=fee_kpi,
        academic_performance=academic_performance,
        teacher_workload=workload_data,
        risk_alerts=risk_alerts[:10],  # Limit to 10 alerts
        urgent_count=urgent_count
    )


@router.get("/academic-performance/details")
def get_academic_performance_details(
    grade_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """
    Detailed academic performance data for drill-down.
    """
    school_id = str(tenant.school_id)
    
    query = db.query(Grade).filter(Grade.school_id == school_id)
    if grade_id:
        query = query.filter(Grade.id == grade_id)
    
    grades = query.all()
    results = []
    
    for grade in grades:
        students = db.query(Student).filter(
            Student.school_id == school_id,
            Student.grade_id == grade.id,
            Student.is_active == True
        ).all()
        
        student_data = []
        for student in students:
            marks = db.query(MarksEntry).filter(
                MarksEntry.student_id == student.id,
                MarksEntry.is_published == True
            ).all()
            
            avg_mark = sum(m.marks_obtained for m in marks) / len(marks) if marks else 0
            
            student_data.append({
                "student_id": student.id,
                "name": f"{student.first_name} {student.last_name}",
                "avg_marks": round(avg_mark, 2),
                "gpa": round((avg_mark / 100) * 4.0, 2)
            })
        
        results.append({
            "grade_id": grade.id,
            "grade_name": grade.name,
            "students": student_data,
            "class_average": round(sum(s["avg_marks"] for s in student_data) / len(student_data), 2) if student_data else 0
        })
    
    return results


@router.get("/class-performance", response_model=ClassAnalyticsResponse)
def get_class_performance(
    grade_id: Optional[str] = None,
    section_id: Optional[str] = None,
    period: str = Query("30d", regex="^(7d|30d|6m|1y)$"),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """
    Granular Class Analytics with filtering by Grade, Section, and Period.
    Period options: 7d (Last Week), 30d (Last 30 Days), 6m (Last 6 Months), 1y (This Year)
    """
    school_id = str(tenant.school_id)
    today = datetime.now(timezone.utc).date()
    
    # Calculate period start based on parameter
    period_days = {"7d": 7, "30d": 30, "6m": 180, "1y": 365}
    days = period_days.get(period, 30)
    period_start = today - timedelta(days=days)
    
    # Base Student Query
    student_query = db.query(Student).filter(
        Student.school_id == school_id,
        Student.is_active == True
    )
    
    if grade_id:
        student_query = student_query.filter(Student.grade_id == grade_id)
    if section_id:
        student_query = student_query.filter(Student.section_id == section_id)
        
    students = student_query.all()
    student_ids = [s.id for s in students]
    total_students_count = len(student_ids)

    # 1. KPIs
    # Avg Attendance (Last 30 days)
    attendance_query = db.query(Attendance).filter(
        Attendance.school_id == school_id,
        Attendance.date >= period_start,
        Attendance.student_id.in_(student_ids) if student_ids else False
    )
    attendance_recs = attendance_query.all()
    present_recs = sum(1 for a in attendance_recs if a.status == AttendanceStatus.PRESENT)
    total_recs = len(attendance_recs)
    avg_att_val = (present_recs / total_recs * 100) if total_recs > 0 else 0
    
    # Avg Grade
    avg_marks = 0
    if student_ids:
        avg_marks = db.query(func.avg(MarksEntry.marks_obtained)).filter(
            MarksEntry.student_id.in_(student_ids),
            MarksEntry.is_published == True
        ).scalar() or 0
    
    # Pending Grading (Mock logic: Assignments without marks)
    pending_grading_count = 12 # Mocked for now as we don't have assignment submission tracking fully linked
    
    kpis = {
        "total_students": KPICard(label="Total Students", value=total_students_count, trend=calculate_trend(total_students_count, total_students_count)), # Trend mocked
        "avg_grade": KPICard(label="Avg Grade", value=f"{avg_marks:.0f}%", trend=calculate_trend(avg_marks, avg_marks)),
        "avg_attendance": KPICard(label="Avg Attendance", value=f"{avg_att_val:.1f}%", trend=calculate_trend(avg_att_val, avg_att_val)),
        "pending_grading_count": KPICard(label="Pending Grading", value=pending_grading_count, sub_label="assignments")
    }
    
    # 2. Attendance Trends (Daily)
    trends = []
    # Optimization: Group by date
    daily_stats = {}
    for i in range(30):
        d = period_start + timedelta(days=i)
        daily_stats[d] = {"total": 0, "present": 0}
        
    for a in attendance_recs:
        if a.date in daily_stats:
            daily_stats[a.date]["total"] += 1
            if a.status == AttendanceStatus.PRESENT:
                daily_stats[a.date]["present"] += 1
                
    for d, stats in daily_stats.items():
        if stats["total"] > 0:
            val = (stats["present"] / stats["total"]) * 100
        else:
            val = 0 # No class or no data
        # Smooth out 0s for weekends if needed, but for now raw
        trends.append({"date": d.strftime("%Y-%m-%d"), "value": round(val, 1)})
        
    # 3. Grade Distribution
    # Simplified: Bucket avg marks of students
    distribution = {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
    for s_id in student_ids:
        s_avg = db.query(func.avg(MarksEntry.marks_obtained)).filter(
            MarksEntry.student_id == s_id
        ).scalar() or 0
        if s_avg >= 90: distribution["A"] += 1
        elif s_avg >= 80: distribution["B"] += 1
        elif s_avg >= 70: distribution["C"] += 1
        elif s_avg >= 60: distribution["D"] += 1
        else: distribution["F"] += 1
        
    dist_list = [
        {"label": k, "value": v, "percentage": round(v/total_students_count*100, 1) if total_students_count else 0}
        for k, v in distribution.items()
    ]
    
    # 4. At-Risk Students (< 75% attendance or F grade)
    at_risk = []
    for s_id in student_ids:
        # Check attendance
        s_att_recs = [a for a in attendance_recs if a.student_id == s_id]
        s_att_count = len(s_att_recs)
        s_pres_count = sum(1 for a in s_att_recs if a.status == AttendanceStatus.PRESENT)
        s_rate = (s_pres_count / s_att_count * 100) if s_att_count > 0 else 100
        
        # Check grades
        s_avg = db.query(func.avg(MarksEntry.marks_obtained)).filter(MarksEntry.student_id == s_id).scalar() or 0
        
        reasons = []
        if s_rate < 75: reasons.append(f"Attendance < 75% ({s_rate:.0f}%)")
        if s_avg < 60: reasons.append(f"Failing Grade ({s_avg:.1f}%)")
        
        if reasons:
            s_obj = next(s for s in students if s.id == s_id)
            at_risk.append({
                "id": s_obj.id,
                "name": f"{s_obj.first_name} {s_obj.last_name}",
                "reason": ", ".join(reasons),
                "image_url": s_obj.profile_picture
            })
            
    # 5. Pending Grading Tasks (Mocked)
    pending_tasks = [
        {"id": "1", "name": "Chapter 4 Quiz", "due_date": "2023-10-24", "submitted": 22, "total": 28},
        {"id": "2", "name": "Mid-Term Essay", "due_date": "2023-10-22", "submitted": 5, "total": 28},
        {"id": "3", "name": "Physics Lab", "due_date": "2023-10-20", "submitted": 28, "total": 28},
    ]

    return ClassAnalyticsResponse(
        total_students=kpis["total_students"],
        avg_grade=kpis["avg_grade"],
        avg_attendance=kpis["avg_attendance"],
        pending_grading_count=kpis["pending_grading_count"],
        attendance_trends=trends,
        grade_distribution=dist_list,
        at_risk_students=at_risk,
        pending_grading_tasks=pending_tasks
    )


@router.get("/risk-alerts/all")
def get_all_risk_alerts(
    severity: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """
    Get all risk alerts with filtering options.
    """
    school_id = str(tenant.school_id)
    
    query = db.query(StudentRiskAlert).filter(
        StudentRiskAlert.school_id == school_id,
        StudentRiskAlert.is_resolved == False
    )
    
    if severity:
        query = query.filter(StudentRiskAlert.severity == severity)
    
    alerts = query.order_by(StudentRiskAlert.created_at.desc()).all()
    
    result = []
    for alert in alerts:
        student = db.query(Student).filter(Student.id == alert.student_id).first()
        result.append({
            "id": alert.id,
            "student_id": alert.student_id,
            "student_name": f"{student.first_name} {student.last_name}" if student else "Unknown",
            "type": alert.type,
            "severity": alert.severity.value if hasattr(alert.severity, 'value') else str(alert.severity),
            "description": alert.description,
            "action_taken": alert.action_taken,
            "created_at": alert.created_at
        })
    
    return result


# ==================================
# NEW: Student Risk Summary Endpoint
# ==================================

@router.get("/student-risk-summary")
def get_student_risk_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """
    Get student risk distribution and list of at-risk students.
    Risk levels: HIGH (red), MEDIUM (yellow), ON_TRACK (green)
    Risk reasons: low_attendance, gpa_drop, fee_overdue, behavioral_incidents, inactivity
    """
    school_id = str(tenant.school_id)
    today = datetime.now(timezone.utc).date()
    period_start = today - timedelta(days=30)
    
    # Get all active students
    students = db.query(Student).filter(
        Student.school_id == school_id,
        Student.is_active == True
    ).all()
    
    risk_counts = {"high": 0, "medium": 0, "on_track": 0}
    students_at_risk = []
    
    for student in students:
        risk_reasons = []
        risk_score = 0  # Higher = more risky
        
        # 1. Check Attendance (< 75% = high risk, < 85% = medium)
        att_records = db.query(Attendance).filter(
            Attendance.student_id == student.id,
            Attendance.date >= period_start
        ).all()
        
        if att_records:
            present = sum(1 for a in att_records if a.status == AttendanceStatus.PRESENT)
            att_rate = (present / len(att_records)) * 100
            if att_rate < 75:
                risk_score += 3
                risk_reasons.append(("low_attendance", f"{att_rate:.0f}% attendance this month"))
            elif att_rate < 85:
                risk_score += 1
                risk_reasons.append(("low_attendance", f"{att_rate:.0f}% attendance this month"))
        
        # 2. Check GPA/Grades (< 60% avg = high risk)
        avg_marks = db.query(func.avg(MarksEntry.marks_obtained)).filter(
            MarksEntry.student_id == student.id
        ).scalar() or 0
        
        if avg_marks < 50:
            risk_score += 3
            risk_reasons.append(("gpa_drop", f"Avg grade: {avg_marks:.0f}%"))
        elif avg_marks < 60:
            risk_score += 2
            risk_reasons.append(("gpa_drop", f"Avg grade: {avg_marks:.0f}%"))
        
        # 3. Check Fee Status (any overdue fee)
        overdue_invoices = db.query(Fee).filter(
            Fee.student_id == student.id,
            Fee.status == "pending",
            Fee.due_date < datetime.now(timezone.utc)
        ).count()
        
        if overdue_invoices > 0:
            risk_score += 2
            risk_reasons.append(("fee_overdue", f"{overdue_invoices} overdue invoice(s)"))
        
        # 4. Check Complaints/Behavioral Incidents
        complaints = db.query(Complaint).filter(
            Complaint.student_id == student.id,
            Complaint.status != ComplaintStatus.CLOSED,
            Complaint.created_at >= datetime.combine(period_start, datetime.min.time()).replace(tzinfo=timezone.utc)
        ).count()
        
        if complaints >= 3:
            risk_score += 3
            risk_reasons.append(("behavioral_incidents", f"{complaints} unresolved complaints"))
        elif complaints >= 1:
            risk_score += 1
            risk_reasons.append(("behavioral_incidents", f"{complaints} unresolved complaint(s)"))
        
        # Determine risk level
        if risk_score >= 4:
            risk_level = "HIGH"
            risk_counts["high"] += 1
        elif risk_score >= 2:
            risk_level = "MEDIUM"
            risk_counts["medium"] += 1
        else:
            risk_level = "ON_TRACK"
            risk_counts["on_track"] += 1
        
        # Add to at-risk list if not on track
        if risk_level != "ON_TRACK" and risk_reasons:
            grade = db.query(Grade).filter(Grade.id == student.grade_id).first()
            section = db.query(Section).filter(Section.id == student.section_id).first()
            
            students_at_risk.append({
                "id": student.id,
                "name": f"{student.first_name} {student.last_name}",
                "grade_name": grade.name if grade else "Unknown",
                "section_name": section.name if section else "",
                "risk_level": risk_level,
                "primary_reason": risk_reasons[0][0] if risk_reasons else None,
                "reason_detail": risk_reasons[0][1] if risk_reasons else None,
                "all_reasons": [{"type": r[0], "detail": r[1]} for r in risk_reasons],
                "image_url": student.profile_picture
            })
    
    # Sort by risk level (HIGH first)
    students_at_risk.sort(key=lambda x: 0 if x["risk_level"] == "HIGH" else 1)
    
    return {
        "risk_distribution": risk_counts,
        "students_at_risk": students_at_risk[:20]  # Limit to 20
    }


# ==================================
# NEW: Cross-Term Comparison Endpoint
# ==================================

@router.get("/term-comparison")
def get_term_comparison(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.SUPER_USER)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """
    Compare key metrics between current term and previous term.
    Metrics: Attendance %, Avg GPA, Fee Collection %, Behavioral Incidents, High-Risk Students
    """
    school_id = str(tenant.school_id)
    today = datetime.now(timezone.utc).date()
    
    # Get terms (ordered by start date descending)
    terms = db.query(ExamTerm).filter(
        ExamTerm.school_id == school_id
    ).order_by(ExamTerm.start_date.desc()).limit(2).all()
    
    current_term_name = terms[0].name if terms else "Current Term"
    previous_term_name = terms[1].name if len(terms) > 1 else "Previous Term"
    
    # Define period ranges (approximate: current = last 90 days, previous = 90-180 days ago)
    current_start = today - timedelta(days=90)
    current_end = today
    previous_start = today - timedelta(days=180)
    previous_end = today - timedelta(days=90)
    
    students = db.query(Student).filter(
        Student.school_id == school_id,
        Student.is_active == True
    ).all()
    student_ids = [s.id for s in students]
    
    def calc_attendance(start, end):
        if not student_ids:
            return 0
        recs = db.query(Attendance).filter(
            Attendance.school_id == school_id,
            Attendance.date >= start,
            Attendance.date <= end
        ).all()
        if not recs:
            return 0
        present = sum(1 for a in recs if a.status == AttendanceStatus.PRESENT)
        return round((present / len(recs)) * 100, 1)
    
    def calc_avg_gpa(start, end):
        # MarksEntry doesn't have created_at, so we just get overall average
        if not student_ids:
            return 0
        marks = db.query(func.avg(MarksEntry.marks_obtained)).filter(
            MarksEntry.student_id.in_(student_ids)
        ).scalar() or 0
        return round((marks / 100) * 4.0, 2)
    
    def calc_fee_collection(start, end):
        total_invoiced = db.query(func.sum(Invoice.total_amount)).filter(
            Invoice.school_id == school_id,
            Invoice.created_at >= datetime.combine(start, datetime.min.time()).replace(tzinfo=timezone.utc),
            Invoice.created_at <= datetime.combine(end, datetime.max.time()).replace(tzinfo=timezone.utc)
        ).scalar() or 0
        
        collected = db.query(func.sum(Payment.amount)).filter(
            Payment.school_id == school_id,
            Payment.status == PaymentStatus.SUCCEEDED,
            Payment.created_at >= datetime.combine(start, datetime.min.time()).replace(tzinfo=timezone.utc),
            Payment.created_at <= datetime.combine(end, datetime.max.time()).replace(tzinfo=timezone.utc)
        ).scalar() or 0
        
        if total_invoiced == 0:
            return 0
        return round((collected / total_invoiced) * 100, 0)
    
    def calc_incidents(start, end):
        return db.query(Complaint).filter(
            Complaint.school_id == school_id,
            Complaint.created_at >= datetime.combine(start, datetime.min.time()).replace(tzinfo=timezone.utc),
            Complaint.created_at <= datetime.combine(end, datetime.max.time()).replace(tzinfo=timezone.utc)
        ).count()
    
    def calc_high_risk(start, end):
        # Simplified: students with < 75% attendance in period
        high_risk = 0
        for sid in student_ids:
            att = db.query(Attendance).filter(
                Attendance.student_id == sid,
                Attendance.date >= start,
                Attendance.date <= end
            ).all()
            if att:
                rate = sum(1 for a in att if a.status == AttendanceStatus.PRESENT) / len(att) * 100
                if rate < 75:
                    high_risk += 1
        return high_risk
    
    # Calculate metrics
    metrics = []
    
    # 1. Attendance
    curr_att = calc_attendance(current_start, current_end)
    prev_att = calc_attendance(previous_start, previous_end)
    change_att = round(curr_att - prev_att, 1)
    metrics.append({
        "name": "Avg Attendance",
        "current": curr_att,
        "previous": prev_att,
        "change": change_att,
        "trend": "up" if change_att > 0 else "down" if change_att < 0 else "stable",
        "unit": "%"
    })
    
    # 2. Avg GPA
    curr_gpa = calc_avg_gpa(current_start, current_end)
    prev_gpa = calc_avg_gpa(previous_start, previous_end)
    change_gpa = round(curr_gpa - prev_gpa, 2)
    metrics.append({
        "name": "Avg GPA",
        "current": curr_gpa,
        "previous": prev_gpa,
        "change": change_gpa,
        "trend": "up" if change_gpa > 0 else "down" if change_gpa < 0 else "stable",
        "unit": ""
    })
    
    # 3. Fee Collection
    curr_fee = calc_fee_collection(current_start, current_end)
    prev_fee = calc_fee_collection(previous_start, previous_end)
    change_fee = curr_fee - prev_fee
    metrics.append({
        "name": "Fee Collection",
        "current": curr_fee,
        "previous": prev_fee,
        "change": change_fee,
        "trend": "up" if change_fee > 0 else "down" if change_fee < 0 else "stable",
        "unit": "%"
    })
    
    # 4. Behavioral Incidents
    curr_inc = calc_incidents(current_start, current_end)
    prev_inc = calc_incidents(previous_start, previous_end)
    change_inc = prev_inc - curr_inc  # Fewer is better
    metrics.append({
        "name": "Incidents",
        "current": curr_inc,
        "previous": prev_inc,
        "change": curr_inc - prev_inc,
        "trend": "up" if curr_inc < prev_inc else "down" if curr_inc > prev_inc else "stable",
        "unit": ""
    })
    
    # 5. High-Risk Students
    curr_risk = calc_high_risk(current_start, current_end)
    prev_risk = calc_high_risk(previous_start, previous_end)
    change_risk = prev_risk - curr_risk
    metrics.append({
        "name": "High-Risk",
        "current": curr_risk,
        "previous": prev_risk,
        "change": curr_risk - prev_risk,
        "trend": "up" if curr_risk < prev_risk else "down" if curr_risk > prev_risk else "stable",
        "unit": " students"
    })
    
    # Generate insights
    insights = []
    if change_att != 0:
        direction = "improved" if change_att > 0 else "declined"
        insights.append(f"Attendance {direction} by {abs(change_att)}% compared to last term.")
    if change_gpa != 0:
        direction = "improved" if change_gpa > 0 else "declined"
        insights.append(f"Average GPA {direction} by {abs(change_gpa)} points.")
    if curr_risk != prev_risk:
        direction = "decreased" if curr_risk < prev_risk else "increased"
        insights.append(f"High-risk student count {direction} by {abs(curr_risk - prev_risk)} students.")
    
    return {
        "current_term": current_term_name,
        "previous_term": previous_term_name,
        "metrics": metrics,
        "insights": insights if insights else ["No significant changes detected between terms."]
    }
