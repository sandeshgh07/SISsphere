from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_public_chat_pricing():
    response = client.post("/api/chat/public", json={"message": "What is the price?"})
    assert response.status_code == 200
    assert "BASIC" in response.json()["response"]
    assert "PLUS" in response.json()["response"]

def test_public_chat_features():
    response = client.post("/api/chat/public", json={"message": "What features do you have?"})
    assert response.status_code == 200
    assert "Intelligent School Management System" in response.json()["response"]

def test_public_chat_general():
    response = client.post("/api/chat/public", json={"message": "Hello"})
    assert response.status_code == 200
    assert "Thank you for your interest" in response.json()["response"]
