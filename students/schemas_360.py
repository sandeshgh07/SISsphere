
from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime
from students.models import IncidentType, IncidentSeverity, DocumentType

class IncidentCreate(BaseModel):
    incident_type: IncidentType
    severity: IncidentSeverity
    title: str
    description: Optional[str] = None
    occurred_at: datetime
    action_taken: Optional[str] = None

class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    action_taken: Optional[str] = None
    status: Optional[str] = None # open, resolved

class IncidentResponse(BaseModel):
    id: str
    student_id: str
    reported_by_user_id: str
    incident_type: IncidentType
    severity: IncidentSeverity
    title: str
    description: Optional[str]
    occurred_at: datetime
    action_taken: Optional[str]
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class DocumentCreate(BaseModel):
    doc_type: DocumentType
    title: str
    # file handled via UploadFile

class DocumentResponse(BaseModel):
    id: str
    student_id: str
    uploaded_by_user_id: str
    doc_type: DocumentType
    title: str
    mime_type: str
    size_bytes: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class Student360Overview(BaseModel):
    student: dict
    guardians: List[dict]
    attendance: dict
    assessments: dict
    risk: dict
    incidents_summary: dict
    complaints_summary: dict
    fees_summary: Optional[dict] = None
    documents: List[DocumentResponse]
