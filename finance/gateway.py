import uuid
import hashlib
import hmac
import json
from typing import Dict, Any

class MockPaymentGateway:
    SECRET_KEY = "sk_test_secret"
    WEBHOOK_SECRET = "whsec_test_secret"

    def create_session(self, amount: float, currency: str, metadata: Dict[str, Any]) -> Dict[str, str]:
        """
        Simulates creating a payment session with the gateway.
        """
        session_id = f"sess_{uuid.uuid4()}"
        client_secret = f"secret_{uuid.uuid4()}"
        return {
            "id": session_id,
            "client_secret": client_secret,
            "url": f"https://mock-gateway.com/pay/{session_id}"
        }

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """
        Verifies the HMAC signature of the webhook payload.
        """
        if not signature:
            return False

        expected_signature = hmac.new(
            self.WEBHOOK_SECRET.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(expected_signature, signature)

    def get_transaction_details(self, gateway_txn_id: str) -> Dict[str, Any]:
        """
        Simulates retrieving transaction details from the gateway.
        For simulation, we can assume if the ID starts with 'txn_success', it succeeded.
        """
        if gateway_txn_id.startswith("txn_success"):
            return {
                "status": "succeeded",
                # In a real scenario, we'd fetch the amount and currency from the gateway
                # to compare with our records. Here we might need to cheat or pass them in
                # if we were truly mocking network calls, but for this logic,
                # we assume the webhook provided truth is consistent with what the gateway would return.
                # To be robust, the caller should verify these match the intent.
            }
        elif gateway_txn_id.startswith("txn_fail"):
             return {"status": "failed"}
        else:
             return {"status": "unknown"}

    def generate_webhook_payload(self, event_type: str, txn_id: str, amount: float, currency: str, metadata: Dict[str, Any]) -> tuple[bytes, str]:
        """
        Helper for testing: Generates a signed webhook payload.
        """
        payload_dict = {
            "type": event_type,
            "data": {
                "object": {
                    "id": txn_id,
                    "amount": amount,
                    "currency": currency,
                    "metadata": metadata,
                    "status": "succeeded" if event_type == "payment_intent.succeeded" else "failed"
                }
            }
        }
        payload_bytes = json.dumps(payload_dict).encode()
        signature = hmac.new(
            self.WEBHOOK_SECRET.encode(),
            payload_bytes,
            hashlib.sha256
        ).hexdigest()
        return payload_bytes, signature

gateway_service = MockPaymentGateway()
