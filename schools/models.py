from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index, Enum, Uuid, Integer
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import uuid
from schools.constants import SubscriptionTier

class School(Base):
    __tablename__ = "schools"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    logo_url = Column(String, nullable=True)
    country = Column(String, default="Nepal")
    subscription_tier = Column(Enum(SubscriptionTier), default=SubscriptionTier.BASIC, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = "users"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    photo_url = Column(String, nullable=True)
    role = Column(String, default="principal")
    is_active = Column(Boolean, default=True)
    token_version = Column(Integer, default=1, nullable=False)
    school_id = Column(Uuid, ForeignKey("schools.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_users_school_id_id", "school_id", "id"),
        Index("idx_users_school_id_created_at", "school_id", "created_at"),
    )
