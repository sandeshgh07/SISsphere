import logging
import pytest
from fastapi import HTTPException
from auth.dependencies import get_current_user
from schools.models import User
from unittest.mock import MagicMock

def test_killswitch_logging(caplog):
    caplog.set_level(logging.WARNING)

    # Mock Token Payload with old version
    token_payload = {"sub": "test@example.com", "token_version": 1}

    # Mock DB User with new version
    mock_user = User(id="user123", email="test@example.com", token_version=2, is_active=True)

    # Mock DB Session
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    # Mock JWT decode to return our payload
    with pytest.raises(HTTPException):
        # We need to bypass the actual JWT decode call or mock it.
        # Since get_current_user calls jwt.decode inside, we mock that.
        from unittest.mock import patch
        with patch("auth.dependencies.jwt.decode", return_value=token_payload):
             get_current_user(token="fake_token", db=mock_db)

    assert "Kill-switch triggered for user user123" in caplog.text
    assert "Token version 1 vs DB 2" in caplog.text
