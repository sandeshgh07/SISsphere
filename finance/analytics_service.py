from sqlalchemy.orm import Session
from sqlalchemy import func
from finance import models as finance_models
from datetime import datetime, timedelta, timezone

# Simple in-memory cache: { "school_id_period": (timestamp, data) }
_revenue_cache = {}

class FinanceAnalyticsService:
    def __init__(self, db: Session, school_id: str):
        self.db = db
        self.school_id = school_id
        # Use UTC date
        self.today = datetime.now(timezone.utc).date()

    def get_triple_day_snapshot(self):
        """
        Returns revenue for Today, Yesterday, and Day-2.
        Calculates percentage change (Today vs Yesterday).
        Uses simple aggregation which is efficient for indexed dates.
        """
        # Calculate dates
        today_date = self.today
        yesterday_date = today_date - timedelta(days=1)
        day2_date = today_date - timedelta(days=2)

        cutoff = day2_date

        # Query daily sums for the last 3 days
        # SQLite 'date' function extracts date part
        results = self.db.query(
            func.date(finance_models.Payment.created_at).label("day"),
            func.sum(finance_models.Payment.amount).label("total")
        ).filter(
            finance_models.Payment.school_id == self.school_id,
            finance_models.Payment.status == finance_models.PaymentStatus.SUCCEEDED,
            finance_models.Payment.created_at >= cutoff
        ).group_by(
            func.date(finance_models.Payment.created_at)
        ).all()

        daily_revenue = {day: total for day, total in results}

        # Helper to get val safely. SQLite returns date strings like 'YYYY-MM-DD'
        def get_rev(d):
            return daily_revenue.get(str(d), 0.0)

        rev_today = get_rev(today_date)
        rev_yesterday = get_rev(yesterday_date)
        rev_day2 = get_rev(day2_date)

        percent_change = 0.0
        if rev_yesterday > 0:
            percent_change = ((rev_today - rev_yesterday) / rev_yesterday) * 100.0
        elif rev_today > 0:
            percent_change = 100.0

        return {
            "today": rev_today,
            "yesterday": rev_yesterday,
            "day_minus_2": rev_day2,
            "percent_change": round(percent_change, 1)
        }

    def get_revenue_velocity(self, period: str = "monthly"):
        """
        Aggregates payment records into time-buckets.
        Caches results for 1 hour.
        """
        cache_key = f"{self.school_id}_{period}"
        cached = _revenue_cache.get(cache_key)
        if cached:
            timestamp, data = cached
            # 1 hour expiration
            if (datetime.now() - timestamp).total_seconds() < 3600:
                return data

        # Format for grouping
        if period == "yearly":
            fmt = '%Y'
        elif period == "weekly":
            fmt = '%Y-%W'
        else:
            # Default monthly
            fmt = '%Y-%m'

        results = self.db.query(
            func.strftime(fmt, finance_models.Payment.created_at).label("period"),
            func.sum(finance_models.Payment.amount).label("amount")
        ).filter(
            finance_models.Payment.school_id == self.school_id,
            finance_models.Payment.status == finance_models.PaymentStatus.SUCCEEDED
        ).group_by(
            func.strftime(fmt, finance_models.Payment.created_at)
        ).order_by(
            func.strftime(fmt, finance_models.Payment.created_at)
        ).all()

        data = [{"period": r.period, "amount": r.amount} for r in results]

        # Update cache
        _revenue_cache[cache_key] = (datetime.now(), data)

        return data
