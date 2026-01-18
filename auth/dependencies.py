from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from database import SessionLocal
from schools import models as school_models
from schools.utils import calculate_subscription_status, SubscriptionStatus
from auth.jwt import SECRET_KEY, ALGORITHM
from typing import List, Optional
from audit.listeners import set_actor_id
from datetime import datetime, timedelta
import logging

log = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

class Roles:
    SUPER_ADMIN = "super_admin"
    PRINCIPAL = "principal"
    SCHOOL_ADMIN = "school_admin"
    ACCOUNTANT = "accountant"
    TEACHER = "teacher"
    PARENT = "parent"
    STUDENT = "student"
    SECURITY_GUARD = "security_guard"
    BOARD = "board"

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> school_models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        # We can also get school_id from payload if we put it there
    except JWTError:
        raise credentials_exception

    # Handle superuser virtual user
    role = payload.get("role")
    if role == "superuser":
        # Create a transient superuser object (not in DB usually, or strictly check)
        # But dependencies expect a User model or similar interface
        # We can construct a fake User object or handle it.
        # Given strict typing in return, we might need a real object or a mock.
        # Let's see if we can query for a superuser or create a dummy one.
        # Existing code `db.query...` would fail if superuser is not in DB.

        # We will create a dummy User object representing superuser
        superuser = school_models.User(
            id="superuser",
            email=username,
            role=Roles.SUPER_ADMIN,
            school_id="system", # Or None, but schema might require string
            is_active=True
        )
        set_actor_id("superuser")
        return superuser

    user = db.query(school_models.User).filter(school_models.User.email == username).first()
    if user is None:
        raise credentials_exception

    # Session Kill-Switch: Validate token version
    token_version = payload.get("token_version")
    # If token_version is missing (old tokens), we might want to allow it momentarily or reject.
    # For strict security, we reject if version mismatches.
    # If token has no version, assume 0 or handle backward compatibility?
    # Since we just added it, all new tokens have it. Old tokens (if any exist) have None.
    # User defaults to 1. So old tokens (None) != 1. They will be invalid. This is good (force logout).
    if token_version != user.token_version:
        log.warning(f"Kill-switch triggered for user {user.id}. Token version {token_version} vs DB {user.token_version}")
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Check Subscription Status
    if user.school_id:
        school = db.query(school_models.School).filter(school_models.School.id == user.school_id).first()
        if school:
            sub_status = calculate_subscription_status(school)
            if sub_status["status"] == SubscriptionStatus.LOCKED:
                 raise HTTPException(status_code=403, detail="Account Suspended: " + sub_status["message"])

    # Set context for audit logging
    set_actor_id(user.id)

    return user

def get_current_active_user(current_user: school_models.User = Depends(get_current_user)) -> school_models.User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Subscription "Lockdown" Check
    # Skip for SuperAdmin
    if current_user.role == Roles.SUPER_ADMIN:
        return current_user

    # Access school
    school = current_user.school
    if not school:
        # Should not happen if foreign key integrity is maintained
        # But if querying manually without join, might trigger lazy load (which needs session)
        # OR if we didn't eager load it.
        # Since 'get_current_user' returns a User attached to a session (db dependency),
        # accessing .school should trigger a lazy load if not detached.
        # But let's be safe. If we can't get it, we fail securely.
        # NOTE: SQLAlchemy async might be issue but this is synchronous.
        raise HTTPException(status_code=403, detail="School context missing")

    # 1. Is School Active? (Frozen)
    if not school.is_active:
         raise HTTPException(
             status_code=403,
             detail="Account Suspended: Please contact Classa Support to reactivate your services."
         )

    # 2. Subscription Expiry (with 3-day Grace Period)
    if school.subscription_expiry:
        grace_period_end = school.subscription_expiry + timedelta(days=3)
        if datetime.utcnow() > grace_period_end:
             raise HTTPException(
                 status_code=403,
                 detail="Account Suspended: Please contact Classa Support to reactivate your services."
             )

    return current_user

class TenantAccess:
    def __init__(self, user: school_models.User = Depends(get_current_active_user)):
        self.user = user
        self.school_id = user.school_id

    def verify_school_access(self, school_id: str):
        if self.school_id != school_id and self.user.role != Roles.SUPER_ADMIN:
             raise HTTPException(status_code=403, detail="Cross-tenant access forbidden")

def require_roles(*allowed_roles: str):
    def role_checker(user: school_models.User = Depends(get_current_active_user)):
        if user.role not in allowed_roles and user.role != Roles.SUPER_ADMIN:
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role {user.role} is not authorized. Required: {allowed_roles}"
            )
        return user
    return role_checker
