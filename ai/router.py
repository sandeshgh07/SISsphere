from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from auth.subscription import require_subscription_feature
from auth.dependencies import get_current_active_user, get_db
from schools.models import User
from ai.service import AIService
from pydantic import BaseModel

router = APIRouter(
    prefix="/chat",
    tags=["AI Chatbot"]
)

class ChatRequest(BaseModel):
    message: str

@router.get("/", dependencies=[Depends(require_subscription_feature("AI_CHATBOT"))])
def chat_endpoint():
    return {"message": "Welcome to the AI Chatbot Assistant! Use POST to chat."}

@router.post("/", dependencies=[Depends(require_subscription_feature("AI_CHATBOT"))])
def chat_with_ai(
    request: ChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    service = AIService()
    response = service.process_message(request.message, current_user, db)
    return {"response": response}

@router.post("/public")
def public_chat(
    request: ChatRequest,
):
    service = AIService()
    response = service.process_public_message(request.message)
    return {"response": response}
