from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from uuid import UUID
from typing import Optional
from schools.constants import SubscriptionTier

class SchoolCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    code: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")
    country: str = Field(..., min_length=2, description="Country is mandatory")
    is_active: bool = True
    logo_url: Optional[str] = None
    description: Optional[str] = None
    contact_request_id: Optional[str] = None  # Link to SaaS lead when creating from Contact Request

    class Config:
        extra = "ignore"

class PrincipalCreate(BaseModel):
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)

class SchoolWithPrincipalCreate(BaseModel):
    school: SchoolCreate
    principal: PrincipalCreate
    initial_deposit: float = 0.0  # Optional, defaults to 0 for Free Tier
    subscription_plan_id: str = "FREE_TIER"  # Optional, defaults to Free Tier

class SchoolOut(BaseModel):
    id: UUID
    name: str
    code: str
    country: str | None = "Nepal"
    is_active: bool
    logo_url: str | None = None
    subscription_tier: SubscriptionTier | None = None
    subscription_expiry: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True

class StudentAssignment(BaseModel):
    grade_id: str
    section_id: str
    roll_number: Optional[str] = None
    admission_number: Optional[str] = None

class UserCreateRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    full_name: str | None = None 
    email: EmailStr
    password: str = Field(min_length=8)
    role: str | None = None
    roles: list[str] = []
    phone: str | None = None
    school_id: UUID | None = None
    children_ids: list[UUID] = []
    student_assignment: Optional[StudentAssignment] = None

    class Config:
        extra = "ignore"
        json_schema_extra = {
            "example": {
                "full_name": "John Doe",
                "email": "john@example.com",
                "password": "strongpassword",
                "role": "teacher"
            }
        }

    # Validator to clean empty strings (Pydantic V1/V2 compat attempt)
    from pydantic import validator
    @validator('school_id', 'phone', 'first_name', 'last_name', 'full_name', pre=True)
    def empty_str_to_none(cls, v):
        if v == "":
            return None
        return v

class SchoolSubscriptionUpdate(BaseModel):
    tier: SubscriptionTier
    expiry_days: int | None = None


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str
    phone: str | None = None
    school_id: UUID
    children_ids: list[UUID] = []

class UserUpdateRoles(BaseModel):
    roles: list[str]
    reason: str | None = Field(None, min_length=20, description="Reason for the role change (min 20 chars)")

class UserTerminateRequest(BaseModel):
    reason: str = Field(..., min_length=20, description="Reason for termination (min 20 chars)")

class PasswordReset(BaseModel):
    new_password: str

class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    first_name: str
    last_name: str
    full_name: str | None = None
    role: str
    is_active: bool
    school_id: UUID
    school_country: str | None = None
    phone: str | None = None
    created_at: datetime
    roles: list[str] = []

    class Config:
        from_attributes = True

    from pydantic import field_validator
    @field_validator('roles', mode='before')
    def flatten_roles(cls, v):
        if not v:
            return []
        # Check if first item is object with role_name
        # But v might be a SQLAlchemy InstrumentedList, iterating it check items
        new_roles = []
        for item in v:
            if hasattr(item, 'role_name'):
                new_roles.append(item.role_name)
            else:
                new_roles.append(str(item))
        return new_roles
