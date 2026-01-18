from fastapi import APIRouter, Depends, Request, status, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from .schemas import SchoolCreate, SchoolOut, SchoolWithPrincipalCreate, UserOut, UserCreate, UserUpdateRoles, PasswordReset
from .store import school_store
from auth.router import get_current_superuser
from auth.dependencies import get_current_user, require_roles, Roles
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

    # We need to pass logo_url to store. But store.create_school expects SchoolCreate
    # which doesn't have logo_url (it's not part of the input model, but is part of output).
    # I should probably update SchoolCreate to optionally accept it or handle it separately.
    # For now, let's update create_school in store to accept optional kwargs.

    return school_store.create_school(school_data, db, logo_url=logo_url)

@router.post("/schools/with-principal", response_model=SchoolOut, status_code=status.HTTP_201_CREATED)
async def create_school_with_principal(
    school_data: SchoolWithPrincipalCreate,
    db: Session = Depends(get_db),
    _payload: dict = Depends(get_current_superuser),
):
    return school_store.create_school_with_principal(school_data, db)

@router.patch("/schools/{school_id}/logo", response_model=SchoolOut)
async def update_school_logo(
    school_id: str,
    logo_url: str = Form(None),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user),
):
    # Enforce isolation
    if payload.get("role") != "superuser":
        token_school_id = payload.get("school_id")
        if token_school_id != school_id:
            log_forbidden_access(payload.get("sub"), token_school_id, school_id, f"update_school_logo {school_id}")
            raise HTTPException(status_code=403, detail="Access forbidden to other school data")

    # Frontend sends 'logo_url' in JSON body currently, but we want to support 'file' in FormData
    # If the frontend uses FormData, it will send 'file' (or whatever key we choose).
    # The current frontend code sends `logo_url` in JSON body.
    # We are changing frontend to send `logo_url` as file or separate field?
    # The plan says "Change handleSaveLogo to usage FormData".

    if file:
        saved_path = save_upload_file(file)
        return school_store.update_school_logo(db, school_id, saved_path)
    elif logo_url and logo_url.startswith("data:"):
        # Handle legacy base64 if needed, or just reject?
        # For this task, we want to move AWAY from base64.
        # But if we want backward compatibility...
        # Let's assume we strictly enforce file upload now.
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
    payload: dict = Depends(get_current_user),
):
    # Enforce isolation
    if payload.get("role") != "superuser":
        token_school_id = payload.get("school_id")
        if token_school_id != school_id:
            log_forbidden_access(payload.get("sub"), token_school_id, school_id, f"update_school {school_id}")
            raise HTTPException(status_code=403, detail="Access forbidden to other school data")

    logo_path = None
    if logo:
        logo_path = save_upload_file(logo)

    return school_store.update_school(db, school_id, name=name, country=country, type=type, logo_url=logo_path)

@router.get("/schools", response_model=list[SchoolOut])
async def list_schools(
    request: Request,
    status_filter: str | None = None,
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
    if current_user.role != "superuser" and current_user.role != Roles.SUPER_ADMIN:
        school_id_filter = current_user.school_id

    schools = school_store.list_schools(db, is_active=is_active, school_id=school_id_filter)
    print("DEBUG API schools: school count:", len(schools))
    return schools

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
async def get_dashboard_counts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from communication.models import Complaint, Notice, ComplaintStatus

    # 1. Unread/Open Complaints (Assigned to School)
    complaints_count = db.query(Complaint).filter(
        Complaint.school_id == str(current_user.school_id),
        Complaint.status == ComplaintStatus.OPEN
    ).count()

    # 2. Recent Notices (Last 7 days, or specific logic)
    # For now, let's just count all notices for simplicity or last 7 days
    from datetime import datetime, timedelta
    seven_days_ago = datetime.utcnow() - timedelta(days=7)

    notices_count = db.query(Notice).filter(
        Notice.school_id == str(current_user.school_id),
        Notice.created_at >= seven_days_ago
    ).count()

    return {
        "complaints_count": complaints_count,
        "notices_count": notices_count
    }

@router.get("/api/users", response_model=list[UserOut])
async def list_users(
    status: str | None = None,
    role: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.SUPER_ADMIN, Roles.PRINCIPAL, Roles.SCHOOL_ADMIN))
):
    query = db.query(User).filter(User.school_id == current_user.school_id)

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
            "phone": u.phone,
            "created_at": u.created_at,
            "roles": assigned
        })

    return results

@router.patch("/users/{user_id}/roles", response_model=UserOut)
async def update_user_roles(
    user_id: UUID,
    roles_in: UserUpdateRoles,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.PRINCIPAL))
):
    user = db.query(User).filter(User.id == user_id, User.school_id == current_user.school_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if str(user.id) == str(current_user.id):
         raise HTTPException(status_code=400, detail="Cannot modify your own roles")

    db.query(UserRole).filter(UserRole.user_id == user.id).delete()

    if not roles_in.roles:
         raise HTTPException(status_code=400, detail="At least one role required")

    primary_role = roles_in.roles[0]
    user.role = primary_role

    for r in roles_in.roles[1:]:
        db.add(UserRole(user_id=user.id, role_name=r))

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
    current_user: User = Depends(require_roles(Roles.PRINCIPAL))
):
    user = db.query(User).filter(User.id == user_id, User.school_id == current_user.school_id).first()
    if not user:
         raise HTTPException(status_code=404, detail="User not found")

    user.is_active = True
    db.commit()
    return {"message": "User enabled"}

@router.post("/users/{user_id}/disable")
async def disable_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.PRINCIPAL))
):
    user = db.query(User).filter(User.id == user_id, User.school_id == current_user.school_id).first()
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
    current_user: User = Depends(require_roles(Roles.PRINCIPAL))
):
    user = db.query(User).filter(User.id == user_id, User.school_id == current_user.school_id).first()
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
    current_user: User = Depends(require_roles(Roles.PRINCIPAL))
):
     user = db.query(User).filter(User.id == user_id, User.school_id == current_user.school_id).first()
     if not user:
         raise HTTPException(status_code=404, detail="User not found")

     if str(user.id) == str(current_user.id):
          raise HTTPException(status_code=400, detail="Cannot delete yourself")

     db.delete(user)
     db.commit()
     return {"message": "User deleted"}
