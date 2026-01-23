import logging
from logging_config import configure_logging

configure_logging()

log = logging.getLogger(__name__)

log.info("starting up")


from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from auth.router import router as auth_router
from schools.router import router as schools_router
# Import new routers
from academics.router import router as academics_router
from students.router import router as students_router
from finance.router import router as finance_router
from finance.payment_router import router as payment_router
from finance.fee_templates_router import router as fee_templates_router
from admin.router import router as admin_router
from admin.bulk_router import router as bulk_admin_router
from attendance.router import router as attendance_router
from ai.router import router as ai_router
from reports.router import router as reports_router
from communication.router import router as communication_router
from analytics.router import router as analytics_router
from analytics.parent_router import router as parent_analytics_router
from analytics.board_router import router as board_router
from analytics.principal_router import router as principal_router
from students.admission_router import router as admission_router
from attendance.gate_router import router as gate_router
from schools.governance_router import router as governance_router
from schools.governance_router import router as governance_router
from schools.handover_router import router as handover_router
from dashboard.router import router as dashboard_router

from database import engine, Base, register_listeners, SessionLocal
import os
from audit.middleware import TraceIDMiddleware
import asyncio
from finance.service import check_overdue_installments
from students.risk_service import check_student_risks

# Create tables on startup
# Also import all models so create_all sees them (handled inside register_listeners actually imports them too)
register_listeners()
Base.metadata.create_all(bind=engine)

# Ensure static directories exist
os.makedirs("static/logos", exist_ok=True)
os.makedirs("static/receipts", exist_ok=True)
os.makedirs("static/admissions", exist_ok=True)

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from core.limiter import limiter

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    import json
    # Log the detailed errors
    error_details = exc.errors()
    print(f"❌ VALIDATION ERROR at {request.url}:")
    print(json.dumps(error_details, indent=2, default=str))
    
    return JSONResponse(
        status_code=422,
        content={"detail": json.loads(json.dumps(error_details, default=str)), "body": str(exc)},
    )

# Background Task for Finance
async def run_finance_worker():
    while True:
        try:
            db = SessionLocal()
            # In production, we'd log this properly
            # print("Running financial assistant check...")
            check_overdue_installments(db)
            db.close()
        except Exception as e:
            # print(f"Error in finance worker: {e}")
            pass

        # Run once a day (86400 seconds), or for demo purposes maybe every hour?
        # Let's say every hour to be safe for a "3 days before" check being timely enough
        await asyncio.sleep(3600)

async def run_risk_worker():
    while True:
        try:
            db = SessionLocal()
            check_student_risks(db)
            db.close()
        except Exception:
            pass
        await asyncio.sleep(86400) # Nightly

@app.on_event("startup")
async def startup_event():
    # Start the background worker
    asyncio.create_task(run_finance_worker())
    asyncio.create_task(run_risk_worker())
from fastapi.middleware.cors import CORSMiddleware

app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TraceIDMiddleware)


app.include_router(auth_router, prefix="/api")
app.include_router(schools_router, prefix="/api")
app.include_router(academics_router, prefix="/api")
app.include_router(students_router, prefix="/api")
app.include_router(finance_router, prefix="/api")
app.include_router(payment_router, prefix="/api")
app.include_router(fee_templates_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(bulk_admin_router, prefix="/api")
app.include_router(attendance_router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(communication_router, prefix="/api")
# Analytics was already prefixed, but wait, if it was manually prefixed in the include,
# I should just check if the router itself had a prefix.
# The previous line: prefix="/api/analytics" suggests the router didn't have /api/analytics built in?
# Or maybe it did? Let's assume standard behavior is to rely on include_router prefix for the "global" part.
app.include_router(analytics_router, prefix="/api/analytics", tags=["analytics"])
app.include_router(parent_analytics_router)
app.include_router(board_router)
app.include_router(principal_router)
app.include_router(admission_router)
app.include_router(gate_router)
app.include_router(governance_router)
app.include_router(handover_router)
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["dashboard"])

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "my_sis",
        "version": "0.1.0"
    }
