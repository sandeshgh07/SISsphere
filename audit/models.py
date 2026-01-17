from sqlalchemy import Column, String, DateTime, Text
from database import Base
from datetime import datetime, timezone
import uuid

def generate_uuid():
    return str(uuid.uuid4())

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    actor_id = Column(String, nullable=True) # User ID who performed the action
    action_type = Column(String, nullable=False) # INSERT, UPDATE, DELETE
    table_name = Column(String, nullable=False)
    record_id = Column(String, nullable=True)
    before_state = Column(Text, nullable=True) # JSON string
    after_state = Column(Text, nullable=True) # JSON string
    trace_id = Column(String, nullable=True, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reason = Column(String, nullable=True) # Reason for the action, e.g. for manual overrides
