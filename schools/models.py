from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index, Enum
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import uuid
from schools.constants import SubscriptionTier

def generate_uuid():
    return str(uuid.uuid4())

class School(Base):
    __tablename__ = "schools"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    logo_url = Column(String, nullable=True)
    country = Column(String, default="Nepal")
    subscription_tier = Column(Enum(SubscriptionTier), default=SubscriptionTier.BASIC, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    role = Column(String, default="principal")
    is_active = Column(Boolean, default=True)
    school_id = Column(String, ForeignKey("schools.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_users_school_id_id", "school_id", "id"),
        Index("idx_users_school_id_created_at", "school_id", "created_at"),
    )

    # Establish relationship for easier access if needed later (e.g. user.school)
    # school = relationship("School")
