from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from uuid import UUID
from schools.constants import SubscriptionTier

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
    id: UUID
    name: str
    code: str
    country: str | None = "Nepal"
    is_active: bool
    logo_url: str | None = None
    subscription_tier: SubscriptionTier
    subscription_expiry: Optional[datetime]
    created_at: datetime
    subscription_tier: SubscriptionTier | None = None
    subscription_expiry: datetime | None = None

    class Config:
        from_attributes = True

class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    first_name: str
    last_name: str
    full_name: str | None = None
    role: str
    is_active: bool
    school_id: UUID

    class Config:
        from_attributes = True
