from pydantic import BaseModel

class LoginRequest(BaseModel):
    username: str
    password: str

class PasswordResetRequest(BaseModel):
    old_password: str
    new_password: str
