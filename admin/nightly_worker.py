"""
Nightly Analytics Worker for Platform Stats.
Compresses raw logs and API data into daily PlatformStats snapshots.

Run manually: python -m admin.nightly_worker
Or schedule via cron: 0 0 * * * cd /path/to/app && python -m admin.nightly_worker
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date, datetime, timezone
from sqlalchemy.orm import Session
from database import SessionLocal
from admin.models import PlatformStats, FeatureUsage
from admin.analytics_service import get_platform_overview
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_nightly_snapshot():
    """
    Generate and store daily platform stats snapshot.
    Idempotent - can be run multiple times per day (overwrites same date).
    """
    logger.info("Starting nightly analytics snapshot...")
    
    db = SessionLocal()
    try:
        # Get current platform overview
        overview = get_platform_overview(db)
        today = date.today()
        
        # Check if snapshot exists for today
        existing = db.query(PlatformStats).filter(PlatformStats.snapshot_date == today).first()
        
        if existing:
            logger.info(f"Updating existing snapshot for {today}")
            snapshot = existing
        else:
            logger.info(f"Creating new snapshot for {today}")
            snapshot = PlatformStats(snapshot_date=today)
            db.add(snapshot)
        
        # Populate snapshot from overview
        snapshot.total_schools = overview.get("total_schools", 0)
        snapshot.active_schools = overview.get("active_schools", 0)
        snapshot.total_arr = overview.get("total_arr", 0)
        snapshot.total_mrr = overview.get("total_mrr", 0)
        snapshot.total_users = overview.get("total_users", 0)
        snapshot.mau = overview.get("mau", 0)
        snapshot.high_churn_risk_count = overview.get("high_churn_risk_count", 0)
        snapshot.api_uptime = overview.get("api_uptime", 99.99)
        snapshot.avg_latency_ms = overview.get("avg_latency", 420)
        snapshot.db_load_percent = overview.get("db_load", 45)
        snapshot.snapshot_json = overview
        
        # Update feature usage stats
        update_feature_usage(db, today)
        
        db.commit()
        logger.info(f"✅ Snapshot saved successfully for {today}")
        logger.info(f"   - Schools: {snapshot.total_schools} ({snapshot.active_schools} active)")
        logger.info(f"   - ARR: ${snapshot.total_arr:,.2f}")
        logger.info(f"   - Users: {snapshot.total_users} (MAU: {snapshot.mau})")
        logger.info(f"   - Churn Risk: {snapshot.high_churn_risk_count} schools")
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Snapshot failed: {e}")
        raise
    finally:
        db.close()


def update_feature_usage(db: Session, snapshot_date: date):
    """
    Update feature adoption statistics.
    """
    # Feature usage tracking (simplified - would be based on actual usage logs)
    features = [
        {"name": "Gradebook", "percent": 88},
        {"name": "Attendance", "percent": 92},
        {"name": "Fee Management", "percent": 76},
        {"name": "Notices", "percent": 95},
        {"name": "Complaints", "percent": 68},
        {"name": "QR Gate Pass", "percent": 45},
    ]
    
    for feature in features:
        existing = db.query(FeatureUsage).filter(
            FeatureUsage.snapshot_date == snapshot_date,
            FeatureUsage.feature_name == feature["name"]
        ).first()
        
        if existing:
            existing.adoption_percent = feature["percent"]
        else:
            fu = FeatureUsage(
                snapshot_date=snapshot_date,
                feature_name=feature["name"],
                adoption_percent=feature["percent"]
            )
            db.add(fu)


def get_historical_stats(db: Session, days: int = 30):
    """
    Retrieve historical platform stats for trend analysis.
    """
    from datetime import timedelta
    start_date = date.today() - timedelta(days=days)
    
    stats = db.query(PlatformStats).filter(
        PlatformStats.snapshot_date >= start_date
    ).order_by(PlatformStats.snapshot_date.asc()).all()
    
    return [
        {
            "date": s.snapshot_date.isoformat(),
            "total_schools": s.total_schools,
            "total_arr": float(s.total_arr),
            "total_mrr": float(s.total_mrr),
            "mau": s.mau,
            "churn_risk": s.high_churn_risk_count
        }
        for s in stats
    ]


if __name__ == "__main__":
    run_nightly_snapshot()
