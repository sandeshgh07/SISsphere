from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from datetime import datetime

class AuditLogResponse(BaseModel):
    id: str
    actor_id: Optional[str]
    action_type: str
    table_name: str
    record_id: Optional[str]
    school_id: Optional[str]
    before_state: Optional[str]
    after_state: Optional[str]
    trace_id: Optional[str]
    timestamp: datetime
    reason: Optional[str]
    actor_name: Optional[str] = None
    actor_email: Optional[str] = None
    actor_role: Optional[str] = None

    class Config:
        from_attributes = True

    @classmethod
    def validate_timestamp(cls, v: Any) -> datetime:
        from datetime import timezone
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v
    
    # Pydantic v2 validator
    from pydantic import field_validator
    @field_validator("timestamp", mode="before")
    def force_utc(cls, v):
        from datetime import datetime, timezone
        if isinstance(v, str):
            # Let default parser handle strings first, but if needed we can parse manually
            # usually Pydantic handles str -> datetime
            return v 
        if isinstance(v, datetime):
            if v.tzinfo is None:
                return v.replace(tzinfo=timezone.utc)
        return v

class PaginatedAuditLogResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[AuditLogResponse]
