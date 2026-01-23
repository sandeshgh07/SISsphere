from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from auth.dependencies import get_current_active_user, get_db
from schools.models import User, School
from schools.constants import TIER_FEATURES

def require_subscription_feature(feature_name: str):
    def feature_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
    ):
        # Fetch the school associated with the user
        school = db.query(School).filter(School.id == current_user.school_id).first()
        if not school:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="School not found for the current user."
            )

        # Check if the feature exists in the mapping
        allowed_tiers = TIER_FEATURES.get(feature_name)
        if not allowed_tiers:
            # Fallback or strict error if feature is undefined
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Feature '{feature_name}' is not defined in the system."
            )

        # Check if the school's tier is allowed
        if school.subscription_tier not in allowed_tiers:
            # Upsell message
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"This feature is available in the {list(allowed_tiers)} tier(s). Please upgrade."
            )

        return True

    return feature_checker


def require_active_subscription():
    """
    FastAPI Dependency to block financial operations when subscription is expired.
    Returns days_to_expiry if valid, raises 403 if expired.
    """
    def subscription_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
    ):
        from datetime import datetime, timezone
        
        school = db.query(School).filter(School.id == current_user.school_id).first()
        if not school:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="School not found"
            )
        
        # Check subscription expiry
        if not school.subscription_expiry:
            # No expiry set = assume active (Free Tier or never set)
            return {"days_to_expiry": None, "status": "ACTIVE"}
        
        expiry = school.subscription_expiry
        now = datetime.now(timezone.utc)
        
        # Make expiry timezone aware if not already
        if expiry.tzinfo is None:
            from datetime import timezone as tz
            expiry = expiry.replace(tzinfo=tz.utc)
        
        diff = expiry - now
        days_to_expiry = diff.days
        
        if days_to_expiry < 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Subscription expired {abs(days_to_expiry)} days ago. Financial operations are disabled."
            )
        
        return {"days_to_expiry": days_to_expiry, "status": "ACTIVE"}
    
    return subscription_checker
