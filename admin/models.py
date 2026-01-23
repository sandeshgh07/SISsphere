"""
Platform Stats Model for storing daily analytics snapshots.
Used by nightly worker to compress raw logs into aggregated stats.
"""
from sqlalchemy import Column, String, Date, Integer, JSON
from sqlalchemy.types import Numeric
from database import Base
import uuid
from datetime import date


def generate_uuid():
    return str(uuid.uuid4())


class PlatformStats(Base):
    """
    Daily snapshot of platform-wide metrics.
    Populated by nightly analytics worker.
    """
    __tablename__ = "platform_stats"

    id = Column(String, primary_key=True, default=generate_uuid)
    snapshot_date = Column(Date, unique=True, nullable=False, default=date.today)
    
    # School Metrics
    total_schools = Column(Integer, default=0)
    active_schools = Column(Integer, default=0)
    new_schools_today = Column(Integer, default=0)
    
    # Revenue Metrics
    total_arr = Column(Numeric(12, 2), default=0.00)
    total_mrr = Column(Numeric(12, 2), default=0.00)
    
    # User Metrics
    total_users = Column(Integer, default=0)
    mau = Column(Integer, default=0)  # Monthly Active Users
    dau = Column(Integer, default=0)  # Daily Active Users
    
    # Churn Metrics
    high_churn_risk_count = Column(Integer, default=0)
    schools_expired_today = Column(Integer, default=0)
    
    # System Health (captured at snapshot time)
    api_uptime = Column(Numeric(5, 2), default=99.99)
    avg_latency_ms = Column(Integer, default=0)
    db_load_percent = Column(Integer, default=0)
    
    # Full snapshot JSON for detailed analysis
    snapshot_json = Column(JSON, nullable=True)


class FeatureUsage(Base):
    """
    Tracks feature adoption across all schools.
    Updated daily by analytics worker.
    """
    __tablename__ = "feature_usage"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    snapshot_date = Column(Date, default=date.today)
    feature_name = Column(String, nullable=False)
    usage_count = Column(Integer, default=0)
    adoption_percent = Column(Numeric(5, 2), default=0.00)
    active_schools = Column(Integer, default=0)
