import logging
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_ai_logging(caplog):
    caplog.set_level(logging.INFO)

    # Trigger lead capture
    response = client.post("/api/chat/public", json={"message": "can i get a demo"})
    assert response.status_code == 200

    # Check logs
    assert "AI_PUBLIC_CHAT" in caplog.text
    assert "trigger=lead_capture" in caplog.text

def test_ai_logging_general(caplog):
    caplog.set_level(logging.INFO)

    # Trigger general
    response = client.post("/api/chat/public", json={"message": "hello"})
    assert response.status_code == 200

    # Check logs
    assert "AI_PUBLIC_CHAT" in caplog.text
    assert "trigger=general" in caplog.text
