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
from admin.router import router as admin_router
from admin.bulk_router import router as bulk_admin_router
from attendance.router import router as attendance_router
from ai.router import router as ai_router
from reports.router import router as reports_router
from communication.router import router as communication_router
from analytics.router import router as analytics_router
from students.admission_router import router as admission_router
from attendance.gate_router import router as gate_router

from database import engine, Base, register_listeners, SessionLocal
import os
from audit.middleware import TraceIDMiddleware
import asyncio
from finance.service import check_overdue_installments

# Create tables on startup
# Also import all models so create_all sees them (handled inside register_listeners actually imports them too)
register_listeners()
Base.metadata.create_all(bind=engine)

# Ensure static directories exist
os.makedirs("static/logos", exist_ok=True)
os.makedirs("static/receipts", exist_ok=True)

app = FastAPI()

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

@app.on_event("startup")
async def startup_event():
    # Start the background worker
    asyncio.create_task(run_finance_worker())
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


app.include_router(auth_router)
app.include_router(schools_router)
app.include_router(academics_router)
app.include_router(students_router)
app.include_router(finance_router)
app.include_router(payment_router)
app.include_router(admin_router)
app.include_router(bulk_admin_router)
app.include_router(attendance_router)
app.include_router(ai_router)
app.include_router(reports_router)
app.include_router(communication_router)
app.include_router(analytics_router, prefix="/api/analytics", tags=["analytics"])
app.include_router(admission_router)
app.include_router(gate_router)

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "my_sis",
        "version": "0.1.0"
    }
