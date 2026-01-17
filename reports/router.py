from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from auth.dependencies import get_db, get_current_user
from reports.service import ReportService
from schools.models import User
from fastapi.concurrency import run_in_threadpool

router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.get("/student/{student_id}")
async def download_report_card(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ReportService()
    # Scoping: Ensure student belongs to the same school as current user
    # If user is parent, ensure link? For now just school scope as per prompt "Import/Export logic must strictly scope data..."
    # but this is report card. I'll assume school scope is base requirement.

    # Offload the blocking PDF generation to a thread pool
    pdf_buffer = await run_in_threadpool(
        service.generate_report_card, db, student_id, current_user.school_id
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=report_card_{student_id}.pdf"}
    )
