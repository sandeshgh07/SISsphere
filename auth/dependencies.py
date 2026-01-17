from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from database import SessionLocal
from schools import models as school_models
from auth.jwt import SECRET_KEY, ALGORITHM
from typing import List, Optional
from audit.listeners import set_actor_id

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

    # Set context for audit logging
    set_actor_id(user.id)

    return user

def get_current_active_user(current_user: school_models.User = Depends(get_current_user)) -> school_models.User:
    # Check if active if User had is_active field (it doesn't currently, but School does)
    # Checking school active status
    # school = current_user.school # if relationship existed
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
