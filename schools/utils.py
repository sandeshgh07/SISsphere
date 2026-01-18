from datetime import datetime, timedelta
from enum import Enum
from schools.models import School

class SubscriptionStatus(str, Enum):
    ACTIVE = "ACTIVE"
    WARNING = "WARNING"
    EXPIRED_GRACE = "EXPIRED_GRACE"
    LOCKED = "LOCKED"

def calculate_subscription_status(school: School) -> dict:
    if not school.is_active:
        return {
            "status": SubscriptionStatus.LOCKED,
            "days_remaining": 0,
            "grace_days_remaining": 0,
            "message": "Account Deactivated"
        }

    if not school.subscription_expiry:
        # Assume infinite/active if not set
        return {
            "status": SubscriptionStatus.ACTIVE,
            "days_remaining": 999,
            "grace_days_remaining": 0,
            "message": "Active"
        }

    now = datetime.utcnow()
    expiry = school.subscription_expiry

    delta = expiry - now
    days_remaining = delta.days

    # Future: days_remaining >= 0
    # Past: days_remaining < 0

    if days_remaining >= 30:
        return {
            "status": SubscriptionStatus.ACTIVE,
            "days_remaining": days_remaining,
            "grace_days_remaining": 0,
            "message": "Active"
        }
    elif 0 <= days_remaining < 30:
        return {
            "status": SubscriptionStatus.WARNING,
            "days_remaining": days_remaining,
            "grace_days_remaining": 0,
            "message": f"Expires in {days_remaining} days"
        }
    else:
        # Expired
        # days_remaining is -1 for yesterday.
        days_past = abs(days_remaining)

        # Grace period is 33 days after expiry.
        # So if days_past is 1..33, we are in grace.
        # If days_past > 33, we are locked.

        grace_days_remaining = 33 - days_past

        if days_past <= 33:
             return {
                "status": SubscriptionStatus.EXPIRED_GRACE,
                "days_remaining": days_remaining,
                "grace_days_remaining": grace_days_remaining,
                "message": f"Expired. Grace period ends in {grace_days_remaining} days."
            }
        else:
             return {
                "status": SubscriptionStatus.LOCKED,
                "days_remaining": days_remaining,
                "grace_days_remaining": 0,
                "message": "Subscription Expired. Account Locked."
            }
