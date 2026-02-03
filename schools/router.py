from fastapi import APIRouter, Depends, Request, status, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from .schemas import SchoolCreate, SchoolOut, SchoolWithPrincipalCreate, UserOut, UserCreate, UserUpdateRoles, PasswordReset, UserCreateRequest, SchoolSubscriptionUpdate, UserTerminateRequest
from .store import school_store
from audit.models import AuditLog
from audit.listeners import set_actor_id, set_reason
import json
from auth.router import get_current_superuser
from auth.dependencies import get_current_user, require_roles, Roles, TenantAccess
from schools.models import User, School, UserRole
from schools.constants import SubscriptionTier
from database import SessionLocal
from utils.audit_logger import log_forbidden_access
import shutil
import os
import uuid
from datetime import datetime, timedelta
from pydantic import BaseModel
from sqlalchemy import or_
from passlib.context import CryptContext
from uuid import UUID

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class ExtendSubscriptionRequest(BaseModel):
    days: int = 30

UPLOAD_DIR = "static/logos"

def save_upload_file(upload_file: UploadFile) -> str:
    if not upload_file:
        return None

    file_extension = os.path.splitext(upload_file.filename)[1]
    filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

    return f"/static/logos/{filename}"

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/public/schools")
async def list_public_schools(db: Session = Depends(get_db)):
    schools = school_store.list_schools(db, is_active=True)
    return [
        {
            "id": s.id,
            "name": s.name,
            "slug": s.code,
            "type": "school",
        }
        for s in schools
    ]

@router.get("/public/schools/by-slug/{school_slug}")
async def get_school_by_slug(school_slug: str, db: Session = Depends(get_db)):
    """Public endpoint to fetch school info by slug/code for login page branding."""
    school = db.query(School).filter(School.code == school_slug, School.is_active == True).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    return {
        "id": str(school.id),
        "name": school.name,
        "slug": school.code,
        "logo_url": school.logo_url,
        "country": school.country,
    }

@router.post("/schools", response_model=SchoolOut, status_code=status.HTTP_201_CREATED)
async def create_school(
    name: str = Form(...),
    code: str = Form(...),
    country: str = Form("Nepal"),
    is_active: bool = Form(True),
    type: str = Form("school"), # Added to match frontend request
    logo: UploadFile = File(None),
    db: Session = Depends(get_db),
    _payload: dict = Depends(get_current_superuser),
):
    logo_url = save_upload_file(logo) if logo else None

    # Validation logic here or manually construct Pydantic model
    school_data = SchoolCreate(name=name, code=code, country=country, is_active=is_active)

    return school_store.create_school(school_data, db, logo_url=logo_url)

@router.post("/schools/with-principal", response_model=SchoolOut, status_code=status.HTTP_201_CREATED)
async def create_school_with_principal(
    school_data: SchoolWithPrincipalCreate,
    role: str = "principal",
    db: Session = Depends(get_db),
    _payload: dict = Depends(get_current_superuser),
):
    if role not in [Roles.PRINCIPAL, Roles.SUPER_ADMIN]:
         raise HTTPException(status_code=400, detail="Invalid initial role. Must be principal or super_admin")
    return school_store.create_school_with_principal(school_data, db, role=role)

@router.patch("/schools/{school_id}/logo", response_model=SchoolOut)
async def update_school_logo(
    school_id: str,
    logo_url: str = Form(None),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Enforce isolation
    if current_user.role != "superuser":
        token_school_id = str(current_user.school_id) if current_user.school_id else None
        if token_school_id != school_id:
            log_forbidden_access(current_user.email, token_school_id, school_id, f"update_school_logo {school_id}")
            raise HTTPException(status_code=403, detail="Access forbidden to other school data")

    if file:
        saved_path = save_upload_file(file)
        return school_store.update_school_logo(db, school_id, saved_path)
    elif logo_url and logo_url.startswith("data:"):
        pass

    raise HTTPException(status_code=400, detail="No logo file provided")

@router.patch("/schools/{school_id}", response_model=SchoolOut)
async def update_school(
    school_id: str,
    name: str = Form(None),
    country: str = Form(None),
    type: str = Form(None),
    logo: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Enforce isolation
    if current_user.role != "superuser":
        token_school_id = str(current_user.school_id) if current_user.school_id else None
        if token_school_id != school_id:
            log_forbidden_access(current_user.email, token_school_id, school_id, f"update_school {school_id}")
            raise HTTPException(status_code=403, detail="Access forbidden to other school data")

    logo_path = None
    if logo:
        logo_path = save_upload_file(logo)

    return school_store.update_school(db, school_id, name=name, country=country, type=type, logo_url=logo_path)

@router.get("/schools")
async def list_schools(
    request: Request,
    status_filter: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    print("DEBUG API schools: endpoint hit", request.method, request.url.path)

    if status_filter is None:
        is_active = None
    elif status_filter == "active":
        is_active = True
    elif status_filter == "inactive":
        is_active = False
    else:
        is_active = None

    # Filter by school_id if not superuser
    school_id_filter = None
    if current_user.role != "superuser" and current_user.role != Roles.SUPER_USER:
        school_id_filter = current_user.school_id

    schools = school_store.list_schools(db, is_active=is_active, school_id=school_id_filter, q=q)
    print("DEBUG API schools: school count:", len(schools))
    
    # Add admin count for each school
    result = []
    for s in schools:
        # Count super_admin users for this school
        admin_count = db.query(User).filter(
            User.school_id == s.id,
            User.role.in_(["super_admin", "SUPER_ADMIN", "principal"])
        ).count()
        
        result.append({
            "id": str(s.id),
            "name": s.name,
            "code": s.code,
            "country": s.country,
            "is_active": s.is_active,
            "logo_url": s.logo_url,
            "subscription_tier": s.subscription_tier.value if hasattr(s.subscription_tier, 'value') else s.subscription_tier,
            "subscription_expiry": s.subscription_expiry,
            "created_at": s.created_at,
            "has_admin": admin_count > 0,
            "admin_count": admin_count
        })
    
    return result

@router.post("/schools/{school_id}/subscription/extend")
async def extend_subscription(
    school_id: str,
    request: ExtendSubscriptionRequest,
    db: Session = Depends(get_db),
    _payload: dict = Depends(get_current_superuser),
):
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    now = datetime.utcnow()
    current_expiry = school.subscription_expiry if school.subscription_expiry else now

    if current_expiry < now:
        current_expiry = now

    school.subscription_expiry = current_expiry + timedelta(days=request.days)
    school.is_active = True

    db.commit()
    return {"message": "Subscription extended", "new_expiry": school.subscription_expiry}

@router.post("/schools/{school_id}/subscription/trial")
async def start_trial(
    school_id: str,
    db: Session = Depends(get_db),
    _payload: dict = Depends(get_current_superuser),
):
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    school.subscription_tier = SubscriptionTier.PRO
    school.subscription_expiry = datetime.utcnow() + timedelta(days=14)
    school.is_active = True

    db.commit()
    return {"message": "Trial started", "tier": "PRO", "expiry": school.subscription_expiry}

@router.post("/schools/{school_id}/subscription/freeze")
async def toggle_freeze(
    school_id: str,
    db: Session = Depends(get_db),
    _payload: dict = Depends(get_current_superuser),
):
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    school.is_active = not school.is_active
    db.commit()

    status_msg = "Active" if school.is_active else "Inactive"
    return {"message": f"School is now {status_msg}", "is_active": school.is_active}

@router.get("/stats/counts")
def get_dashboard_counts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from communication.models import Complaint, Notice, ComplaintStatus

    # 1. Unread/Open Complaints (Assigned to School)
    complaints_count = db.query(Complaint).filter(
        Complaint.school_id == str(current_user.school_id),
        Complaint.status == ComplaintStatus.OPEN
    ).count()

    # 2. Recent Notices
    from datetime import datetime, timedelta
    from communication.models import NoticeAck
    seven_days_ago = datetime.utcnow() - timedelta(days=7)

    # Subquery for notices seen/acked by this user
    seen_notices_subquery = db.query(NoticeAck.notice_id).filter(
        NoticeAck.user_id == str(current_user.id)
    ).subquery()

    notices_count = db.query(Notice).filter(
        Notice.school_id == str(current_user.school_id),
        Notice.created_at >= seven_days_ago,
        ~Notice.id.in_(seen_notices_subquery)
    ).count()

    # 3. Highest priority of recent notices (for sidebar color)
    from communication.models import NoticePriority
    highest_priority = None
    priority_order = ["CRITICAL", "IMPORTANT", "NORMAL"]
    for priority in priority_order:
        has_priority = db.query(Notice).filter(
            Notice.school_id == str(current_user.school_id),
            Notice.created_at >= seven_days_ago,
            Notice.priority == priority,
            ~Notice.id.in_(seen_notices_subquery) # Exclude read notices
        ).first()
        if has_priority:
            highest_priority = priority
            break

    return {
        "complaints_count": complaints_count,
        "notices_count": notices_count,
        "highest_notice_priority": highest_priority
    }

@router.get("/dashboard/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Universal Dashboard Summary API
    Returns role-appropriate summary data for the dashboard.
    """
    from students.models import Student, ParentStudentLink
    from finance.models import Invoice, Payment, PaymentStatus, Fee
    from communication.models import Notice
    from attendance.models import Attendance, AttendanceStatus
    from academics.models import Grade, ExamTerm
    from sqlalchemy import func
    from datetime import datetime, timedelta, timezone
    
    school_id = str(current_user.school_id)
    today = datetime.now(timezone.utc).date()
    
    # Get school info
    # Get school info
    # Ensure ID is UUID object for the query, as superuser might have string ID
    from uuid import UUID
    school_uuid = UUID(str(current_user.school_id)) if current_user.school_id else None
    school = db.query(School).filter(School.id == school_uuid).first()
    
    # Base response
    response = {
        "school_name": school.name if school else "School",
        "school_logo_url": school.logo_url if school else None,
        "school_type": school.subscription_tier.value if school and hasattr(school.subscription_tier, 'value') else "school",
    }
    
    # Role-specific data
    role = current_user.role
    
    if role == "parent":
        # Parent dashboard - show children info
        links = db.query(ParentStudentLink).filter(
            ParentStudentLink.parent_id == str(current_user.id)
        ).all()
        
        children = []
        total_outstanding = 0.0
        
        for link in links:
            student = db.query(Student).filter(Student.id == link.student_id).first()
            if student:
                # Get grade and section names
                grade = db.query(Grade).filter(Grade.id == student.grade_id).first() if student.grade_id else None
                
                # Calculate outstanding fees
                outstanding = db.query(func.sum(Fee.amount)).filter(
                    Fee.student_id == student.id,
                    Fee.status == "pending"
                ).scalar() or 0.0
                
                total_outstanding += outstanding
                
                children.append({
                    "id": student.id,
                    "first_name": student.first_name,
                    "last_name": student.last_name,
                    "grade_name": grade.name if grade else None,
                    "section_name": None,
                    "outstanding_fees": outstanding
                })
        
        response["children"] = children
        response["total_outstanding"] = total_outstanding
        
    else:
        # Staff/Admin dashboard
        # Student count
        student_count = db.query(func.count(Student.id)).filter(
            Student.school_id == school_id,
            Student.is_active == True
        ).scalar() or 0
        
        # Pending dues count
        pending_dues = db.query(func.count(Fee.id)).filter(
            Fee.school_id == school_id,
            Fee.status == "pending"
        ).scalar() or 0
        
        # Fees collected this month
        first_of_month = today.replace(day=1)
        fees_collected = db.query(func.sum(Payment.amount)).filter(
            Payment.school_id == school_id,
            Payment.status == PaymentStatus.SUCCEEDED,
            Payment.created_at >= datetime.combine(first_of_month, datetime.min.time()).replace(tzinfo=timezone.utc)
        ).scalar() or 0.0
        
        # Notices count
        seven_days_ago = today - timedelta(days=7)
        notices_count = db.query(func.count(Notice.id)).filter(
            Notice.school_id == school_id,
            Notice.created_at >= datetime.combine(seven_days_ago, datetime.min.time()).replace(tzinfo=timezone.utc)
        ).scalar() or 0
        
        response["student_count"] = student_count
        response["pending_dues_count"] = pending_dues
        response["fees_collected_this_month"] = fees_collected
        response["notices_count"] = notices_count
        
        # For principal, add additional analytics data
        if role in ["principal", "super_admin", "SUPER_ADMIN"]:
            # Average attendance (last 30 days)
            thirty_days_ago = today - timedelta(days=30)
            attendance_records = db.query(Attendance).filter(
                Attendance.school_id == school_id,
                Attendance.date >= thirty_days_ago
            ).all()
            
            total_records = len(attendance_records)
            present_records = sum(1 for a in attendance_records if a.status == AttendanceStatus.PRESENT)
            avg_attendance = (present_records / total_records * 100) if total_records > 0 else 0
            
            response["avg_attendance_rate"] = round(avg_attendance, 1)
            
            # Fee collection progress
            total_invoiced = db.query(func.sum(Invoice.total_amount)).filter(
                Invoice.school_id == school_id,
                Invoice.status.notin_(["CANCELLED", "REFUNDED"])
            ).scalar() or 0.0
            
            response["total_invoiced"] = total_invoiced
            response["collection_percent"] = round((fees_collected / total_invoiced * 100), 1) if total_invoiced > 0 else 0
            
            # Current term
            current_term = db.query(ExamTerm).filter(
                ExamTerm.school_id == school_id
            ).order_by(ExamTerm.start_date.desc()).first()
            
            response["current_term"] = current_term.name if current_term else "Current Term"
    
    return response

@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.SUPER_USER, Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    # Authorization checks for role assignment
    target_school_id = current_user.school_id

    # If Superuser, allow targeting specific school for admin creation
    if current_user.role == Roles.SUPER_USER or current_user.role == "superuser":
        if user_in.school_id:
            target_school_id = user_in.school_id
        elif not target_school_id:
             # If no school_id in token or payload, creates platform user?
             # If trying to create a SCHOOL role without school_id -> Error
             roles_to_check = user_in.roles if user_in.roles else ([user_in.role] if user_in.role else [])
             school_roles = [Roles.PRINCIPAL, Roles.SUPER_ADMIN, Roles.TEACHER, Roles.STUDENT, Roles.PARENT]
             if any(r in school_roles for r in roles_to_check):
                 raise HTTPException(status_code=400, detail="school_id required for this role")
             # If creating superuser, target_school_id stays None
    else:
        # Non-superusers cannot specify school_id (must match token)
        if user_in.school_id and str(user_in.school_id) != str(current_user.school_id):
             raise HTTPException(status_code=403, detail="Cannot create users for other schools")

    # Check permissions for admin/principal roles
    roles_to_check = user_in.roles if user_in.roles else ([user_in.role] if user_in.role else [])
    protected_roles = [Roles.SUPER_ADMIN, Roles.PRINCIPAL]
    if any(r in protected_roles for r in roles_to_check):
         if current_user.role not in [Roles.SUPER_USER, "superuser", Roles.SUPER_ADMIN]:
              raise HTTPException(status_code=403, detail="Insufficient permissions to create Admin/Principal roles")

    # Set audit context
    set_actor_id(str(current_user.id))
    set_reason("User Creation")

    return school_store.create_user(db, user_in, target_school_id)

@router.put("/schools/{school_id}/subscription", response_model=SchoolOut)
async def update_subscription_tier(
    school_id: str,
    update_data: SchoolSubscriptionUpdate,
    db: Session = Depends(get_db),
    _payload: dict = Depends(get_current_superuser),
):
    school = db.query(School).filter(School.id == UUID(school_id)).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    school.subscription_tier = update_data.tier
    if update_data.expiry_days is not None:
        school.subscription_expiry = datetime.utcnow() + timedelta(days=update_data.expiry_days)
    
    # If upgrading to paid tier, ensure active
    if update_data.tier != SubscriptionTier.FREE and update_data.tier != "demo":
         school.is_active = True

    db.commit()
    return SchoolOut.model_validate(school)

@router.get("/users", response_model=list[UserOut])
async def list_users(
    status: str | None = None,
    role: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.SUPER_USER, Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    target_school_id = UUID(str(current_user.school_id)) if current_user.school_id else None
    query = db.query(User).filter(User.school_id == target_school_id)

    if status == "active":
        query = query.filter(User.is_active == True)
    elif status == "inactive":
        query = query.filter(User.is_active == False)

    if role:
        query = query.outerjoin(UserRole).filter(or_(User.role == role, UserRole.role_name == role)).distinct()

    if q:
        search = f"%{q}%"
        query = query.filter(or_(
            User.first_name.ilike(search),
            User.last_name.ilike(search),
            User.email.ilike(search),
            User.phone.ilike(search)
        ))

    users = query.all()
    
    # Pre-fetch linked students for navigation
    from students.models import Student
    user_ids = [str(u.id) for u in users]
    student_map = {}
    if user_ids:
        students = db.query(Student.id, Student.user_id).filter(Student.user_id.in_(user_ids)).all()
        student_map = {str(s.user_id): s.id for s in students}

    results = []
    for u in users:
        # Collect roles
        assigned = [r.role_name for r in u.roles]
        if u.role not in assigned:
            assigned.append(u.role)

        results.append({
            "id": u.id,
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "full_name": f"{u.first_name} {u.last_name}",
            "role": u.role,
            "is_active": u.is_active,
            "school_id": u.school_id,
            "school_country": u.school.country if u.school else None,
            "phone": u.phone,
            "created_at": u.created_at,
            "roles": assigned,
            "related_student_id": student_map.get(str(u.id))
        })

    return results

@router.get("/users/{user_id}", response_model=UserOut)
async def get_user_profile(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.SUPER_USER, Roles.PRINCIPAL, Roles.SUPER_ADMIN, "school_admin"))
):
    # Enforce school isolation for non-superusers
    query = db.query(User).filter(User.id == user_id)
    if current_user.role not in [Roles.SUPER_USER, "superuser"]:
        target_school_id = UUID(str(current_user.school_id)) if current_user.school_id else None
        query = query.filter(User.school_id == target_school_id)
    
    user = query.first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Collect roles
    assigned = [r.role_name for r in user.roles]
    if user.role not in assigned:
        assigned.append(user.role)
    
    # Check if student
    related_student_id = None
    if "student" in assigned:
        from students.models import Student
        stu = db.query(Student.id).filter(Student.user_id == str(user.id)).first()
        if stu:
            related_student_id = stu.id

    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": f"{user.first_name} {user.last_name}",
        "role": user.role,
        "is_active": user.is_active,
        "school_id": user.school_id,
        "school_country": user.school.country if user.school else None,
        "phone": user.phone,
        "created_at": user.created_at,
        "roles": assigned,
        "related_student_id": related_student_id
    }

@router.patch("/users/{user_id}/roles", response_model=UserOut)
async def update_user_roles(
    user_id: UUID,
    roles_in: UserUpdateRoles,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    target_school_id = UUID(str(current_user.school_id)) if current_user.school_id else None
    user = db.query(User).filter(User.id == user_id, User.school_id == target_school_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if str(user.id) == str(current_user.id):
         raise HTTPException(status_code=400, detail="Cannot modify your own roles")

    old_role = user.role
    db.query(UserRole).filter(UserRole.user_id == user.id).delete()

    if not roles_in.roles:
         raise HTTPException(status_code=400, detail="At least one role required")

    primary_role = roles_in.roles[0]
    user.role = primary_role

    for r in roles_in.roles[1:]:
        db.add(UserRole(user_id=user.id, role_name=r))

    # Audit Log
    audit_entry = AuditLog(
        actor_id=str(current_user.id),
        action_type="ROLE_CHANGE",
        table_name="users",
        record_id=str(user.id),
        before_state=json.dumps({"role": old_role}),
        after_state=json.dumps({"role": primary_role}),
        reason=roles_in.reason
    )
    db.add(audit_entry)

    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": f"{user.first_name} {user.last_name}",
        "role": user.role,
        "is_active": user.is_active,
        "school_id": user.school_id,
        "phone": user.phone,
        "created_at": user.created_at,
        "roles": roles_in.roles
    }

@router.post("/users/{user_id}/enable")
async def enable_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    target_school_id = UUID(str(current_user.school_id)) if current_user.school_id else None
    user = db.query(User).filter(User.id == user_id, User.school_id == target_school_id).first()
    if not user:
         raise HTTPException(status_code=404, detail="User not found")

    user.is_active = True
    db.commit()
    return {"message": "User enabled"}

@router.post("/users/{user_id}/disable")
async def disable_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    target_school_id = UUID(str(current_user.school_id)) if current_user.school_id else None
    user = db.query(User).filter(User.id == user_id, User.school_id == target_school_id).first()
    if not user:
         raise HTTPException(status_code=404, detail="User not found")

    if str(user.id) == str(current_user.id):
         raise HTTPException(status_code=400, detail="Cannot disable yourself")

    user.is_active = False
    user.token_version += 1
    db.commit()
    return {"message": "User disabled"}

@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: UUID,
    payload: PasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    target_school_id = UUID(str(current_user.school_id)) if current_user.school_id else None
    user = db.query(User).filter(User.id == user_id, User.school_id == target_school_id).first()
    if not user:
         raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = pwd_context.hash(payload.new_password)
    user.must_change_password = True
    user.token_version += 1
    db.commit()
    return {"message": "Password reset successfully"}

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
     target_school_id = UUID(str(current_user.school_id)) if current_user.school_id else None
     user = db.query(User).filter(User.id == user_id, User.school_id == target_school_id).first()
     if not user:
         raise HTTPException(status_code=404, detail="User not found")

     if str(user.id) == str(current_user.id):
          raise HTTPException(status_code=400, detail="Cannot delete yourself")

     db.delete(user)
     db.commit()
     return {"message": "User deleted"}

@router.post("/users/{user_id}/terminate")
async def terminate_user(
    user_id: UUID,
    payload: UserTerminateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.PRINCIPAL, Roles.SUPER_ADMIN))
):
    target_school_id = UUID(str(current_user.school_id)) if current_user.school_id else None
    user = db.query(User).filter(User.id == user_id, User.school_id == target_school_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if str(user.id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="Cannot terminate yourself")

    old_role = user.role
    user.is_active = False
    user.role = f"terminated_{old_role}"
    user.token_version += 1

    # Audit Log
    audit_entry = AuditLog(
        actor_id=str(current_user.id),
        action_type="TERMINATION",
        table_name="users",
        record_id=str(user.id),
        before_state=json.dumps({"role": old_role, "is_active": True}),
        after_state=json.dumps({"role": user.role, "is_active": False}),
        reason=payload.reason
    )
    db.add(audit_entry)

    db.commit()
    return {"message": f"User terminated. Former role: {old_role}"}

# Schema for Audit Log output
class AuditLogListItem(BaseModel):
    id: str
    actor_id: str | None
    action_type: str
    table_name: str
    record_id: str | None
    timestamp: datetime
    reason: str | None
    actor_name: str | None = None
    before_state: str | None = None
    after_state: str | None = None

    class Config:
        from_attributes = True

@router.get("/audit-logs")
def list_school_audit_logs(
    search: str = None,
    limit: int = 50,
    cursor: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.SUPER_ADMIN, Roles.PRINCIPAL, "school_admin", Roles.ACCOUNTANT)),
    tenant: TenantAccess = Depends(TenantAccess)
):
    """
    School-scoped Audit Log Viewer with cursor-based pagination.
    Accessible to SuperAdmin, Principal, SchoolAdmin, Accountant.
    """
    from typing import Optional
    import base64
    
    # Cap limit
    limit = min(limit, 100)
    
    # Resolve School ID (String and UUID)
    target_school_id_str = str(tenant.school_id)
    try:
        target_school_uuid = uuid.UUID(target_school_id_str)
    except:
        target_school_uuid = None
        
    # Get all users in this school for filtering
    # Safe query: if uuid matches
    if target_school_uuid:
        school_users = db.query(User).filter(User.school_id == target_school_uuid).all()
        school_user_ids = [str(u.id) for u in school_users]
        user_name_map = {str(u.id): f"{u.first_name} {u.last_name}" for u in school_users}
    else:
        school_users = []
        school_user_ids = []
        user_name_map = {}
    
    # Base query
    # Include logs where school_id is set (new/fixed behaviour) OR actor matches (legacy)
    query = db.query(AuditLog).filter(
        or_(
            AuditLog.school_id == target_school_id_str,
            AuditLog.actor_id.in_(school_user_ids),
            # Keep null actor check if needed, but risky if not scoped
        )
    )
    
    # Apply search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                AuditLog.table_name.ilike(search_term),
                AuditLog.action_type.ilike(search_term),
                AuditLog.record_id.ilike(search_term),
                AuditLog.reason.ilike(search_term),
                AuditLog.actor_id.in_([
                    uid for uid, name in user_name_map.items() 
                    if search.lower() in name.lower()
                ])
            )
        )
    
    # Apply Cursor Logic (Keyset Pagination: timestamp DESC, id DESC)
    if cursor:
        try:
            decoded = base64.urlsafe_b64decode(cursor).decode()
            cursor_ts_str, cursor_id = decoded.split("||")
            cursor_ts = datetime.fromisoformat(cursor_ts_str)
            
            # (timestamp < cursor_ts) OR (timestamp == cursor_ts AND id < cursor_id)
            query = query.filter(
                or_(
                    AuditLog.timestamp < cursor_ts,
                    (AuditLog.timestamp == cursor_ts) & (AuditLog.id < cursor_id)
                )
            )
        except Exception:
            # Invalid cursor? Just ignore or validation error. Ignoring safer for reliability.
            pass

    # Order by timestamp descending (most recent first) then ID for deterministic tie-breaking
    # Fetch limit + 1 to check for next page
    logs = query.order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).limit(limit + 1).all()
    
    next_cursor = None
    if len(logs) > limit:
        next_item = logs[limit] # The +1 item
        logs = logs[:limit] # Truncate to limit
        
        # Create next cursor
        cursor_str = f"{next_item.timestamp.isoformat()}||{next_item.id}"
        next_cursor = base64.urlsafe_b64encode(cursor_str.encode()).decode()

    # Results building
    import json
    results = []
    for log in logs:
        # Check privacy
        if log.hidden_for_user_ids:
            try:
                hidden_ids = json.loads(log.hidden_for_user_ids)
                if str(current_user.id) in hidden_ids:
                    continue 
            except:
                pass 

        results.append({
            "id": log.id,
            "actor_id": log.actor_id,
            "actor_name": user_name_map.get(log.actor_id, "System"),
            "action_type": log.action_type,
            "table_name": log.table_name,
            "record_id": log.record_id,
            "timestamp": log.timestamp,
            "reason": log.reason,
            "before_state": log.before_state,
            "after_state": log.after_state
        })

    return {
        "items": results,
        "next_cursor": next_cursor
    }

@router.get("/staff-directory", response_model=list[UserOut])
def get_staff_directory(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Roles.TEACHER, Roles.PRINCIPAL, "school_admin", Roles.SECURITY_GUARD, Roles.SUPER_ADMIN, Roles.PARENT, Roles.STUDENT))
):
    """
    List staff members for complaint selection.
    """
    target_school_id = UUID(str(user.school_id)) if user.school_id else None
    return db.query(User).filter(
        User.school_id == target_school_id,
        User.role.in_([Roles.TEACHER, Roles.PRINCIPAL, "school_admin", Roles.SECURITY_GUARD, Roles.SUPER_ADMIN, Roles.ACCOUNTANT])
    ).all()

