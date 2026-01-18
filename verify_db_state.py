import sys
import os
sys.path.append(os.getcwd())
from database import SessionLocal
from schools.models import School
from schools.utils import calculate_subscription_status

db = SessionLocal()
school = db.query(School).filter(School.code == "NIA001").first()
print(f"School: {school.name}")
print(f"Expiry: {school.subscription_expiry}")
print(f"Tier: {school.subscription_tier}")
print(f"Is Active: {school.is_active}")
status = calculate_subscription_status(school)
print(f"Status: {status}")
db.close()
