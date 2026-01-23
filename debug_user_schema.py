from schools.schemas import UserCreateRequest
from pydantic import ValidationError
import uuid

# Mock a valid UUID
valid_uuid = str(uuid.uuid4())

# 1. Payload mimicking Frontend exactly
payload = {
    "full_name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "role": "teacher",
    "school_id": valid_uuid,
    "phone": None,
    "children_ids": []
}

print("--- Testing Payload ---")
print(payload)

try:
    instance = UserCreateRequest(**payload)
    print("\n✅ Validation Successful!")
    print(instance.model_dump())
except ValidationError as e:
    print("\n❌ Validation Failed:")
    print(e)
except Exception as e:
    print(f"\n❌ Unexpected Error: {e}")
