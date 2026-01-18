import pytest
from fastapi.testclient import TestClient
from main import app
from core.limiter import limiter

# We need to mock the rate limiter or ensure it uses a memory storage that resets
# TestClient usually works with slowapi if configured correctly.
# The `slowapi` MemoryStorage is default.

client = TestClient(app)

def test_public_chat_lead_capture():
    # Test "pricing" keyword
    response = client.post("/api/chat/public", json={"message": "tell me about pricing"})
    assert response.status_code == 200
    assert "Admission/Inquiry Form" in response.json()["response"]

    # Test "demo" keyword
    response = client.post("/api/chat/public", json={"message": "can i get a demo"})
    assert response.status_code == 200
    assert "Admission/Inquiry Form" in response.json()["response"]

def test_public_chat_rate_limit():
    # We need to simulate different IPs or just spam requests from the same IP (TestClient default)
    # The limit is 20/hour.
    # We run 25 requests. The 21st should fail.

    # However, since this test runs after others, the counter might already be non-zero if IP is shared.
    # Let's try to reset or just run enough to hit limit.

    # Note: TestClient requests come from "testclient" IP usually.

    hit_limit = False
    for i in range(30):
        response = client.post("/api/chat/public", json={"message": "spam check"})
        if response.status_code == 429:
            hit_limit = True
            break

    assert hit_limit, "Should have hit rate limit of 20/hour"
