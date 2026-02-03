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

    def get_finance_summary(self, start_date: datetime, end_date: datetime):
        """
        Returns high-level finance KPIs for the dashboard.
        """
        # Billed Total (Invoices issued in range)
        billed_query = self.db.query(func.sum(finance_models.StudentInvoice.total_due)).filter(
            finance_models.StudentInvoice.school_id == self.school_id,
            finance_models.StudentInvoice.status.in_([
                finance_models.StudentInvoiceStatus.ISSUED,
                finance_models.StudentInvoiceStatus.PARTIAL,
                finance_models.StudentInvoiceStatus.PAID
            ]),
            finance_models.StudentInvoice.issued_at >= start_date,
            finance_models.StudentInvoice.issued_at <= end_date
        )
        billed_total = billed_query.scalar() or 0.0

        # Collected Total (Payments in range)
        collected_query = self.db.query(func.sum(finance_models.Payment.amount)).filter(
            finance_models.Payment.school_id == self.school_id,
            finance_models.Payment.status == finance_models.PaymentStatus.SUCCEEDED,
            finance_models.Payment.paid_at >= start_date,
            finance_models.Payment.paid_at <= end_date
        )
        collected_total = collected_query.scalar() or 0.0

        # Outstanding Total (All time? Or just relevant to period?)
        # Dashboard usually shows CURRENT outstanding (all time active debt)
        outstanding_query = self.db.query(func.sum(finance_models.StudentInvoice.balance)).filter(
            finance_models.StudentInvoice.school_id == self.school_id,
            finance_models.StudentInvoice.status.in_([
                finance_models.StudentInvoiceStatus.ISSUED,
                finance_models.StudentInvoiceStatus.PARTIAL
            ])
        )
        outstanding_total = outstanding_query.scalar() or 0.0

        # Overdue Count
        overdue_query = self.db.query(func.count(finance_models.StudentInvoice.id)).filter(
            finance_models.StudentInvoice.school_id == self.school_id,
            finance_models.StudentInvoice.status.in_([
                finance_models.StudentInvoiceStatus.ISSUED,
                finance_models.StudentInvoiceStatus.PARTIAL
            ]),
            finance_models.StudentInvoice.due_date < self.today
        )
        overdue_count = overdue_query.scalar() or 0

        # Students with Dues
        students_with_dues_query = self.db.query(func.count(func.distinct(finance_models.StudentInvoice.student_id))).filter(
            finance_models.StudentInvoice.school_id == self.school_id,
            finance_models.StudentInvoice.balance > 0,
             finance_models.StudentInvoice.status.in_([
                finance_models.StudentInvoiceStatus.ISSUED,
                finance_models.StudentInvoiceStatus.PARTIAL
            ])
        )
        students_with_dues_count = students_with_dues_query.scalar() or 0

        # Convert to float for calculation and response
        billed_f = float(billed_total)
        collected_f = float(collected_total)
        
        # Collection Rate (Collected / Billed) * 100
        collection_rate = 0.0
        if billed_f > 0:
            collection_rate = (collected_f / billed_f) * 100.0
        elif collected_f > 0:
            collection_rate = 100.0

        return {
            "billed_total": billed_f,
            "collected_total": collected_f,
            "outstanding_total": float(outstanding_total),
            "overdue_count": overdue_count,
            "students_with_dues_count": students_with_dues_count,
            "collection_rate": round(collection_rate, 1)
        }

    def get_revenue_trend_monthly(self, months: int = 12):
        """
        Returns monthly collected totals for the last N months.
        """
        start_date = self.today - timedelta(days=months * 30) # Approx
        
        results = self.db.query(
            func.strftime('%Y-%m', finance_models.Payment.paid_at).label("period"),
            func.sum(finance_models.Payment.amount).label("amount")
        ).filter(
            finance_models.Payment.school_id == self.school_id,
            finance_models.Payment.status == finance_models.PaymentStatus.SUCCEEDED,
            finance_models.Payment.paid_at >= start_date
        ).group_by(
            func.strftime('%Y-%m', finance_models.Payment.paid_at)
        ).order_by(
            func.strftime('%Y-%m', finance_models.Payment.paid_at)
        ).all()

        return [{"period": r.period, "amount": float(r.amount)} for r in results]

    def get_outstanding_by_grade(self):
        """
        Returns total outstanding balance grouped by Grade.
        """
        from students import models as student_models
        from academics import models as academic_models

        # Join Invoice -> Student -> Grade
        results = self.db.query(
            academic_models.Grade.name.label("grade_name"),
            func.sum(finance_models.StudentInvoice.balance).label("total_outstanding")
        ).join(
            student_models.Student, finance_models.StudentInvoice.student_id == student_models.Student.id
        ).join(
            academic_models.Grade, student_models.Student.grade_id == academic_models.Grade.id
        ).filter(
            finance_models.StudentInvoice.school_id == self.school_id,
            finance_models.StudentInvoice.balance > 0,
            finance_models.StudentInvoice.status.in_([
                finance_models.StudentInvoiceStatus.ISSUED,
                finance_models.StudentInvoiceStatus.PARTIAL
            ])
        ).group_by(
            academic_models.Grade.name
        ).order_by(
            academic_models.Grade.name # Or order by amount descending?
        ).all()

        return [{"grade": r.grade_name, "amount": float(r.total_outstanding)} for r in results]

    def get_aging_report(self):
        """
        Returns outstanding balances bucketed by age (days since due date).
        Buckets: 0-30, 31-60, 61-90, 90+
        """
        # We can do this in Python or SQL. SQL with CASE is better but more verbose.
        # Let's fetch all unpaid invoices with due dates and bucket in Python for simplicity/readability
        # unless volume is huge. Assuming volume is manageable per school.
        
        invoices = self.db.query(finance_models.StudentInvoice).filter(
             finance_models.StudentInvoice.school_id == self.school_id,
             finance_models.StudentInvoice.balance > 0,
             finance_models.StudentInvoice.status.in_([
                finance_models.StudentInvoiceStatus.ISSUED,
                finance_models.StudentInvoiceStatus.PARTIAL
             ])
        ).all()

        buckets = {
            "0-30": 0.0,
            "31-60": 0.0,
            "61-90": 0.0,
            "90+": 0.0
        }

        today = datetime.now(timezone.utc)

        for inv in invoices:
            balance = float(inv.balance)
            if not inv.due_date:
                # If no due date, treat as current? Or 0-30?
                buckets["0-30"] += balance
                continue
            
            # Ensure timezone awareness match
            due_at = inv.due_date
            if due_at.tzinfo is None:
                due_at = due_at.replace(tzinfo=timezone.utc)
            
            delta = (today - due_at).days
            
            if delta <= 30:
                buckets["0-30"] += balance
            elif delta <= 60:
                buckets["31-60"] += balance
            elif delta <= 90:
                buckets["61-90"] += balance
            else:
                buckets["90+"] += balance

        return [{"bucket": k, "amount": v} for k, v in buckets.items()]

    def get_top_unpaid_students(self, limit: int = 10):
        """
        Returns top students with highest total outstanding balance.
        """
        from students import models as student_models
        
        # Aggregate by student
        results = self.db.query(
            finance_models.StudentInvoice.student_id,
            func.sum(finance_models.StudentInvoice.balance).label("total_debt")
        ).filter(
            finance_models.StudentInvoice.school_id == self.school_id,
            finance_models.StudentInvoice.balance > 0
        ).group_by(
            finance_models.StudentInvoice.student_id
        ).order_by(
            func.sum(finance_models.StudentInvoice.balance).desc()
        ).limit(limit).all()

        # Fetch student details
        data = []
        for r in results:
            student = self.db.query(student_models.Student).filter(student_models.Student.id == r.student_id).first()
            if student:
                data.append({
                    "student_id": student.id,
                    "student_name": f"{student.first_name} {student.last_name}",
                    "grade": student.grade.name if student.grade else "N/A",
                    "amount": float(r.total_debt),
                    "identifier": student.roll_number or student.email # Useful for display
                })
        
        return data
