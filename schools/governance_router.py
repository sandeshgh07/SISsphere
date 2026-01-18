from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, EmailStr, Field
from auth.dependencies import get_db, require_roles, Roles, get_current_user
from schools.models import User
from passlib.context import CryptContext
from audit.listeners import set_reason
from audit.models import AuditLog
from typing import Optional
from datetime import datetime, timezone
import json
import uuid

router = APIRouter(prefix="/api/governance", tags=["governance"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class BoardUserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str = Field(min_length=8)
    role: str = Roles.SUPER_ADMIN

class RoleUpdate(BaseModel):
    new_role: str
    justification: str = Field(min_length=20, description="Mandatory justification for role change")

@router.post("/users")
def create_board_user(
    user_data: BoardUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.SUPER_ADMIN))
):
    school_id = current_user.school_id

    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        email=user_data.email,
        hashed_password=pwd_context.hash(user_data.password),
        role=user_data.role,
        school_id=school_id,
        token_version=1
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created", "id": new_user.id}

@router.patch("/users/{user_id}/role")
def change_user_role(
    user_id: str,
    update_data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Roles.SUPER_ADMIN))
):
    try:
        uuid_id = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    target_user = db.query(User).filter(User.id == uuid_id, User.school_id == current_user.school_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if target_user.role == Roles.SUPER_ADMIN and update_data.new_role != Roles.SUPER_ADMIN:
        count = db.query(func.count(User.id)).filter(
            User.school_id == current_user.school_id,
            User.role == Roles.SUPER_ADMIN,
            User.is_active == True
        ).scalar()
        if count <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the last SuperAdmin of the school.")

    old_role = target_user.role

    # Update logic
    target_user.role = update_data.new_role
    if update_data.new_role == "INACTIVE":
        target_user.is_active = False

    target_user.token_version += 1

    # Manual Audit Log
    audit_entry = AuditLog(
        actor_id=str(current_user.id),
        action_type="EXECUTIVE_ROLE_CHANGE",
        table_name="users",
        record_id=str(target_user.id),
        before_state=json.dumps({"role": old_role}),
        after_state=json.dumps({"role": update_data.new_role}),
        reason=update_data.justification,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit_entry)

    set_reason(update_data.justification)

    db.commit()

    return {"message": "Role updated", "old_role": old_role, "new_role": target_user.role}
