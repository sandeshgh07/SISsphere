from sqlalchemy import Column, String, DateTime, Text, ForeignKey
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
    school_id = Column(String, ForeignKey("schools.id"), nullable=True) # New: Tenant isolation
    before_state = Column(Text, nullable=True) # JSON string
    after_state = Column(Text, nullable=True) # JSON string
    trace_id = Column(String, nullable=True, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reason = Column(String, nullable=True) # Reason for the action, e.g. for manual overrides
    hidden_for_user_ids = Column(Text, nullable=True) # JSON list of user IDs who should not see this log
