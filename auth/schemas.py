from pydantic import BaseModel

class LoginRequest(BaseModel):
    username: str
    password: str

class PasswordResetRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str
