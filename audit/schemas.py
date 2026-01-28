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

    class Config:
        from_attributes = True

class PaginatedAuditLogResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[AuditLogResponse]
