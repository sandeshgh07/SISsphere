from fastapi import APIRouter, Depends, Request, status, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from .schemas import SchoolCreate, SchoolOut, SchoolWithPrincipalCreate, UserOut
from .store import school_store
from auth.router import get_current_superuser
from auth.dependencies import get_current_user, require_roles, Roles
from schools.models import User, School
from schools.constants import SubscriptionTier
from database import SessionLocal
from utils.audit_logger import log_forbidden_access
import shutil
import os
import uuid
from datetime import datetime, timedelta
from pydantic import BaseModel

router = APIRouter()

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

@router.get("/api/users", response_model=list[UserOut])
async def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.SUPER_ADMIN, Roles.PRINCIPAL, Roles.SCHOOL_ADMIN))
):
    query = db.query(User).filter(User.school_id == current_user.school_id)
    users = query.all()
    # Compute full_name dynamic property or map it
    for u in users:
        u.full_name = f"{u.first_name} {u.last_name}"
    return users
