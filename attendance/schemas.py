from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class GateTokenPayload(BaseModel):
    sub: str # student_id
    parent_id: str
    school_id: str
    jti: str
    type: str = "GATE_PASS"
    exp: datetime
    iat: datetime

class GateScanResponse(BaseModel):
    status: str # SUCCESS, BLOCKED, EXPIRED
    student_name: str
    student_grade: Optional[str] = None
    student_photo_url: Optional[str] = None
    parent_name: str
    parent_photo_url: Optional[str] = None
    block_reason: Optional[str] = None
    action: str # CHECKIN/CHECKOUT
    timestamp: datetime
