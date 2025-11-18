from fastapi import APIRouter, Depends

from models import ChatSendIn, SessionUser
from auth_routes import require_auth
import state
from iot_routes import iot_send


router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/messages")
def chat_messages_api(user: SessionUser = Depends(require_auth)):
    return {
        "messages": state.chat_messages,
        "connected": state.mqtt_connected,
    }


@router.post("/send")
def chat_send(payload: ChatSendIn, user: SessionUser = Depends(require_auth)):
    # On réutilise la logique d’envoi IoT
    return iot_send(payload, user)
