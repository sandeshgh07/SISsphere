from fastapi import APIRouter, HTTPException, Header, Depends
from sqlalchemy.orm import Session
from .schemas import LoginRequest, PasswordResetRequest
from .jwt import create_access_token, decode_access_token
from config import SUPERUSER_USERNAME, SUPERUSER_PASSWORD
from database import SessionLocal
from schools.models import User
from auth.dependencies import get_current_user, get_db
from passlib.context import CryptContext
import os
import hmac

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.post("/auth/login")
async def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    # Check if superuser login
    is_superuser = False
    if SUPERUSER_USERNAME and SUPERUSER_PASSWORD:
        username_match = hmac.compare_digest(credentials.username.encode(), SUPERUSER_USERNAME.encode())
        if username_match:
             password_match = hmac.compare_digest(credentials.password.encode(), SUPERUSER_PASSWORD.encode())
             if password_match:
                 is_superuser = True

    if is_superuser:
        access_token = create_access_token(
            data={"sub": credentials.username, "role": "superuser", "school_id": None},
            expires_minutes=60
        )
        return {"access_token": access_token, "token_type": "bearer"}

    # Regular user login
    user = db.query(User).filter(User.email == credentials.username).first()
    if not user or not pwd_context.verify(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(
        data={
            "sub": user.email,
            "role": user.role,
            "school_id": str(user.school_id),
            "token_version": user.token_version,
            "must_change_password": user.must_change_password
        },
        expires_minutes=60
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/auth/reset-first-password")
async def reset_first_password(
    reset_data: PasswordResetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not pwd_context.verify(reset_data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid old password")

    current_user.hashed_password = pwd_context.hash(reset_data.new_password)
    current_user.must_change_password = False
    current_user.token_version += 1

    db.commit()

    return {"message": "Password updated successfully"}

@router.post("/auth/superuser/login")
async def superuser_login(credentials: LoginRequest):
    if not SUPERUSER_USERNAME or not SUPERUSER_PASSWORD:
        raise HTTPException(status_code=500, detail="server misconfigured")

    username_match = hmac.compare_digest(
        credentials.username.encode(),
        SUPERUSER_USERNAME.encode()
    )
    password_match = hmac.compare_digest(
        credentials.password.encode(),
        SUPERUSER_PASSWORD.encode()
    )

    if not (username_match and password_match):
        raise HTTPException(status_code=401, detail="invalid credentials")

    access_token = create_access_token(
        data={"sub": credentials.username, "role": "superuser", "school_id": None},
        expires_minutes=60
    )

    return {"access_token": access_token, "token_type": "bearer"}


def get_current_superuser(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="invalid token")

    token = authorization[7:]
    payload = decode_access_token(token)

    if payload.get("role") != "superuser":
        raise HTTPException(status_code=403, detail="insufficient permissions")

    return payload


@router.get("/auth/me")
async def auth_me(payload: dict = Depends(get_current_superuser)):
    return {
        "username": payload["sub"],
        "role": payload["role"],
    }

print("🔥 AUTH ROUTER LOADED FROM:", __file__)

