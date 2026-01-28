from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from database import get_db
from schools.models import User
from auth.dependencies import get_current_active_user, Roles
from finance.analytics_service import FinanceAnalyticsService

router = APIRouter(
    prefix="/api/fees/analytics",
    tags=["Financials - Analytics"]
)

def require_finance_view_access(current_user: User = Depends(get_current_active_user)):
    user_roles = {r.role_name for r in current_user.roles} | {current_user.role}
    allowed = {Roles.PRINCIPAL, Roles.ACCOUNTANT, Roles.SCHOOL_ADMIN}
    if not allowed.intersection(user_roles):
         raise HTTPException(status_code=403, detail="Not authorized to view finance analytics")
    return current_user

@router.get("/summary")
def get_finance_summary(
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance_view_access)
):
    """
    Get high-level finance KPIs.
    Default range: Last 30 days.
    """
    service = FinanceAnalyticsService(db, str(current_user.school_id))
    
    # Defaults
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=30)
    
    if start:
        try:
            start_date = datetime.fromisoformat(start.replace('Z', '+00:00'))
        except ValueError:
            pass # Use default
            
    if end:
        try:
            end_date = datetime.fromisoformat(end.replace('Z', '+00:00'))
        except ValueError:
            pass # Use default
            
    # Ensure TZ awareness if naive
    if start_date.tzinfo is None: start_date = start_date.replace(tzinfo=timezone.utc)
    if end_date.tzinfo is None: end_date = end_date.replace(tzinfo=timezone.utc)
    
    return service.get_finance_summary(start_date, end_date)

@router.get("/revenue-trend")
def get_revenue_trend(
    months: int = 12,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance_view_access)
):
    service = FinanceAnalyticsService(db, str(current_user.school_id))
    return service.get_revenue_trend_monthly(months)

@router.get("/outstanding-by-grade")
def get_outstanding_by_grade(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance_view_access)
):
    service = FinanceAnalyticsService(db, str(current_user.school_id))
    return service.get_outstanding_by_grade()

@router.get("/aging")
def get_aging_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance_view_access)
):
    service = FinanceAnalyticsService(db, str(current_user.school_id))
    return service.get_aging_report()

@router.get("/top-unpaid")
def get_top_unpaid(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance_view_access)
):
    service = FinanceAnalyticsService(db, str(current_user.school_id))
    return service.get_top_unpaid_students(limit)
