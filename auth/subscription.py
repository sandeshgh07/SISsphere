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
