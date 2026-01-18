from sqlalchemy.orm import Session
from sqlalchemy import func, literal_column
from finance import models as finance_models
from datetime import datetime, timedelta, timezone

# Simple in-memory cache: { "school_id_period": (timestamp, data) }
_revenue_cache = {}

class FinanceAnalyticsService:
    def __init__(self, db: Session, school_id: str):
        self.db = db
        # Ensure school_id is string for compatibility with finance models
        self.school_id = str(school_id)
        # Use UTC date
        self.today = datetime.now(timezone.utc).date()

    def get_triple_day_snapshot(self):
        """
        Returns revenue for Today, Yesterday, and Day-2.
        Calculates percentage change (Today vs Yesterday).
        Uses SQL Window Functions (LAG) to calculate previous day delta efficiently.
        """
        # Calculate dates
        today_date = self.today
        day2_date = today_date - timedelta(days=2)

        # Subquery: Aggregate daily totals first
        # Filter for relevant range
        daily_sales = self.db.query(
            func.date(finance_models.Payment.created_at).label("sales_date"),
            func.sum(finance_models.Payment.amount).label("total_amount")
        ).filter(
            finance_models.Payment.school_id == self.school_id,
            finance_models.Payment.status == finance_models.PaymentStatus.SUCCEEDED,
            finance_models.Payment.created_at >= day2_date
        ).group_by(
            func.date(finance_models.Payment.created_at)
        ).subquery()

        # Window Function Query: Get current total and previous day total using LAG
        # Note: SQLite LAG syntax support depends on version, but standard in modern SQL.
        # We perform this over the subquery results.
        # However, to ensure we get Today, Yesterday rows specifically even if null,
        # we might just fetch the windowed result and map in python,
        # or use the Window function to calculate the % change directly in SQL.

        # Simpler Window Function Approach:
        # Just select date, total, and LAG(total) over date
        query = self.db.query(
            daily_sales.c.sales_date,
            daily_sales.c.total_amount,
            func.lag(daily_sales.c.total_amount).over(order_by=daily_sales.c.sales_date).label("prev_day_amount")
        ).order_by(daily_sales.c.sales_date.desc())

        results = query.all()

        # Map results to business logic
        # Results are ordered DESC (Today, Yesterday, Day-2)
        data = {
            "today": 0.0,
            "yesterday": 0.0,
            "day_minus_2": 0.0,
            "percent_change": 0.0
        }

        # Helper to normalize date str
        def is_same_day(d_str, target_date):
            return str(d_str) == str(target_date)

        today_val = 0.0
        yesterday_val = 0.0

        for row in results:
            d_str = row.sales_date
            amount = row.total_amount or 0.0

            if is_same_day(d_str, today_date):
                data["today"] = amount
                today_val = amount
                # If LAG worked and yesterday exists in result set immediately before
                if row.prev_day_amount is not None:
                     # This LAG is relative to the result set, which is filtered >= day2.
                     # If yesterday is present, it will be the lag.
                     pass
            elif is_same_day(d_str, today_date - timedelta(days=1)):
                data["yesterday"] = amount
                yesterday_val = amount
            elif is_same_day(d_str, today_date - timedelta(days=2)):
                data["day_minus_2"] = amount

        # Calculate % Change
        if yesterday_val > 0:
            data["percent_change"] = round(((today_val - yesterday_val) / yesterday_val) * 100.0, 1)
        elif today_val > 0:
            data["percent_change"] = 100.0

        return data

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

    def get_daily_revenue_30_days(self):
        """
        Returns daily totals for the last 30 days.
        """
        end_date = self.today
        start_date = end_date - timedelta(days=29) # 30 days inclusive

        results = self.db.query(
            func.date(finance_models.Payment.created_at).label("date"),
            func.sum(finance_models.Payment.amount).label("amount")
        ).filter(
            finance_models.Payment.school_id == self.school_id,
            finance_models.Payment.status == finance_models.PaymentStatus.SUCCEEDED,
            finance_models.Payment.created_at >= start_date
        ).group_by(
            func.date(finance_models.Payment.created_at)
        ).all()

        # Fill missing dates with 0
        data_map = {r.date: r.amount for r in results}
        final_data = []

        cumulative = 0.0
        # Target: Let's assume a simple target of 1000 per day for demo or average of active days + 10%
        # Or better: derive from invoices due this month?
        # For this component, we just provide the data. The target logic can be in the router or here.
        # Let's calculate a cumulative target line that assumes a steady growth to a monthly goal.
        # Monthly goal = Sum of invoices issued this month? Or just an arbitrary goal for visualization?
        # Let's return the daily data, router can construct target.

        current = start_date
        while current <= end_date:
            d_str = str(current)
            amount = data_map.get(d_str, 0.0) or 0.0
            final_data.append({
                "date": d_str,
                "amount": amount
            })
            current += timedelta(days=1)

        return final_data

    def get_payment_source_breakdown(self):
        """
        Returns split between OFFICE_CASH and REMOTE.
        """
        results = self.db.query(
            finance_models.Payment.entry_source,
            func.sum(finance_models.Payment.amount).label("total")
        ).filter(
            finance_models.Payment.school_id == self.school_id,
            finance_models.Payment.status == finance_models.PaymentStatus.SUCCEEDED
        ).group_by(
            finance_models.Payment.entry_source
        ).all()

        # Map to simpler dict
        # entry_source is Enum: REMOTE, OFFICE_CASH, AUTOMATED
        data = {
            "OFFICE_CASH": 0.0,
            "REMOTE": 0.0
        }

        for r in results:
            source = r.entry_source
            if source == finance_models.EntrySource.OFFICE_CASH:
                data["OFFICE_CASH"] += (r.total or 0.0)
            elif source in [finance_models.EntrySource.REMOTE, finance_models.EntrySource.AUTOMATED]:
                data["REMOTE"] += (r.total or 0.0)

        return data
