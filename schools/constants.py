import enum

class SubscriptionTier(str, enum.Enum):
    FREE_TRIAL = "FREE_TRIAL"
    BASIC = "BASIC"
    PLUS = "PLUS"
    PRO = "PRO"

# Mapping of features to the tiers that have access to them
TIER_FEATURES = {
    "CORE_ACADEMICS": {SubscriptionTier.FREE_TRIAL, SubscriptionTier.BASIC, SubscriptionTier.PLUS, SubscriptionTier.PRO},
    "ATTENDANCE": {SubscriptionTier.FREE_TRIAL, SubscriptionTier.BASIC, SubscriptionTier.PLUS, SubscriptionTier.PRO},
    "STANDARD_EXAMS": {SubscriptionTier.BASIC, SubscriptionTier.PLUS, SubscriptionTier.PRO},
    "AI_CHATBOT": {SubscriptionTier.PLUS, SubscriptionTier.PRO},
    "ADVANCED_ANALYTICS": {SubscriptionTier.PRO},
    "GLOBAL_ADMIN_STATS": {SubscriptionTier.BASIC, SubscriptionTier.PLUS, SubscriptionTier.PRO},  # God's View - BASIC+
    "pro_analytics": {SubscriptionTier.PRO},
    "SMART_ADMISSION": {SubscriptionTier.BASIC, SubscriptionTier.PLUS, SubscriptionTier.PRO},
    "PAYMENT_PLANS": {SubscriptionTier.PLUS, SubscriptionTier.PRO},
    "LESSON_PLANNER": {SubscriptionTier.PLUS, SubscriptionTier.PRO},
    "QR_GATE": {SubscriptionTier.PRO},
}
