"""
Financial Audit Logger for Tamper-Proof Transaction Logging.
Outputs structured JSON to app.log for every financial event.
"""
import logging
import json
import functools
from datetime import datetime, timezone
from fastapi import Request
from typing import Optional

# Configure JSON Logger
logger = logging.getLogger("financial_audit")
logger.setLevel(logging.INFO)

# File Handler for app.log
handler = logging.FileHandler("app.log")
handler.setLevel(logging.INFO)

# JSON Formatter
class FinancialJSONFormatter(logging.Formatter):
    def format(self, record):
        if hasattr(record, 'financial_event'):
            return json.dumps(record.financial_event)
        return super().format(record)

handler.setFormatter(FinancialJSONFormatter())
if not logger.handlers:
    logger.addHandler(handler)


def log_financial_transaction(
    category: str = "GENERAL",
    is_subscription_related: bool = False
):
    """
    Decorator to log financial transactions in structured JSON format.
    
    Usage:
        @log_financial_transaction(category="TUITION_FEE")
        def record_payment(...):
            ...
    """
    def decorator(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            return await _log_and_execute(func, args, kwargs, category, is_subscription_related, is_async=True)
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            return _log_and_execute(func, args, kwargs, category, is_subscription_related, is_async=False)
        
        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator


async def _log_and_execute(func, args, kwargs, category, is_subscription_related, is_async):
    """Execute function and log the financial event."""
    import uuid
    
    # Extract context from kwargs (FastAPI injects these)
    request: Optional[Request] = kwargs.get('request')
    current_user = kwargs.get('current_user') or kwargs.get('user')
    tenant = kwargs.get('tenant')
    db = kwargs.get('db')
    
    # Get user info
    user_id = str(current_user.id) if current_user else None
    active_role = current_user.role if current_user else None
    school_id = str(tenant.school_id) if tenant else (str(current_user.school_id) if current_user else None)
    
    # Get school slug if available
    school_slug = None
    if db and school_id:
        from schools.models import School
        school = db.query(School).filter(School.id == school_id).first()
        school_slug = school.code if school else None
    
    # Security fingerprint
    ip_address = None
    user_agent = None
    if request:
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
    
    # Subscription status
    platform_status = "ACTIVE"
    days_to_expiry = None
    if current_user and hasattr(current_user, 'subscription_expiry') and current_user.subscription_expiry:
        expiry = current_user.subscription_expiry
        if isinstance(expiry, str):
            from datetime import datetime
            expiry = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
        diff = expiry - datetime.now(timezone.utc)
        days_to_expiry = diff.days
        if days_to_expiry < 0:
            platform_status = "EXPIRED"
        elif days_to_expiry < 30:
            platform_status = "WARNING"
    
    # Execute the actual function
    if is_async:
        result = await func(*args, **kwargs)
    else:
        result = func(*args, **kwargs)
    
    # Build transaction ID from result if available
    transaction_id = None
    amount = None
    currency = "NPR"
    payment_method = None
    
    if isinstance(result, dict):
        transaction_id = result.get('id') or result.get('payment_id')
        amount = result.get('amount')
        currency = result.get('currency', 'NPR')
        payment_method = result.get('gateway') or result.get('entry_source')
    elif hasattr(result, 'id'):
        transaction_id = str(result.id)
        amount = getattr(result, 'amount', None)
        currency = getattr(result, 'currency', 'NPR')
        payment_method = getattr(result, 'gateway', None) or getattr(result, 'entry_source', None)
    
    # Build the Financial Audit JSON
    financial_event = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": "FINANCIAL_TRANSACTION",
        "severity": "INFO",
        "context": {
            "school_id": school_id,
            "school_slug": school_slug,
            "user_id": user_id,
            "active_role": active_role
        },
        "payload": {
            "transaction_id": transaction_id,
            "amount": float(amount) if amount else None,
            "currency": currency,
            "category": category,
            "payment_method": str(payment_method) if payment_method else None,
            "is_subscription_related": is_subscription_related
        },
        "security_fingerprint": {
            "ip_address": ip_address,
            "user_agent": user_agent,
            "platform_status": platform_status,
            "days_to_expiry": days_to_expiry
        }
    }
    
    # Log the event
    record = logging.LogRecord(
        name="financial_audit",
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg="",
        args=(),
        exc_info=None
    )
    record.financial_event = financial_event
    logger.handle(record)
    
    return result

# Alias for backwards compatibility
log_financial_event = log_financial_transaction
