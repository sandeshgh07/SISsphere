from pydantic import BaseModel
from typing import Optional

class LoginRequest(BaseModel):
    username: str
    password: str
    school_id: Optional[str] = None

class PasswordResetRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str
