from pydantic import BaseModel, Field, EmailStr
from datetime import datetime

class SchoolCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    code: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")
    country: str = "Nepal"
    is_active: bool = True

class PrincipalCreate(BaseModel):
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)

class SchoolWithPrincipalCreate(BaseModel):
    school: SchoolCreate
    principal: PrincipalCreate

class SchoolOut(BaseModel):
    id: str
    name: str
    code: str
    country: str | None = "Nepal"
    is_active: bool
    logo_url: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
