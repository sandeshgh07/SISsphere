import enum

class SubscriptionTier(str, enum.Enum):
    BASIC = "BASIC"
    PLUS = "PLUS"
    PRO = "PRO"

# Mapping of features to the tiers that have access to them
TIER_FEATURES = {
    "CORE_ACADEMICS": {SubscriptionTier.BASIC, SubscriptionTier.PLUS, SubscriptionTier.PRO},
    "ATTENDANCE": {SubscriptionTier.BASIC, SubscriptionTier.PLUS, SubscriptionTier.PRO},
    "STANDARD_EXAMS": {SubscriptionTier.BASIC, SubscriptionTier.PLUS, SubscriptionTier.PRO},
    "AI_CHATBOT": {SubscriptionTier.PLUS, SubscriptionTier.PRO},
    "ADVANCED_ANALYTICS": {SubscriptionTier.PRO},
    "GLOBAL_ADMIN_STATS": {SubscriptionTier.PRO},
    "pro_analytics": {SubscriptionTier.PRO}, # Added to match router usage
    "SMART_ADMISSION": {SubscriptionTier.BASIC, SubscriptionTier.PLUS, SubscriptionTier.PRO}, # BASIC+
    "PAYMENT_PLANS": {SubscriptionTier.PLUS, SubscriptionTier.PRO},
    "LESSON_PLANNER": {SubscriptionTier.PLUS, SubscriptionTier.PRO},
    "QR_GATE": {SubscriptionTier.PRO},
}
