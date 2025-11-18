import json
import time

from fastapi import APIRouter, Depends, HTTPException

from models import ChatSendIn, SessionUser
from auth_routes import require_auth
import state
import paho.mqtt.client as mqtt


router = APIRouter(prefix="/iot", tags=["iot"])


@router.get("/latest")
def iot_latest(user: SessionUser = Depends(require_auth)):
    return {
        "connected": state.mqtt_connected,
        "topic": state.MQTT_SUB_TOPIC,
        "last": state.last_message,
    }


@router.post("/send")
def iot_send(payload: ChatSendIn, user: SessionUser = Depends(require_auth)):
    """
    Envoie un message depuis le site vers MQTT ET
    l’ajoute dans l’historique du chat comme message "user".
    """
    msg = payload.message.strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Message vide.")

    ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

    # 1) Ajouter le message de l’utilisateur dans l’historique du chat
    entry = {
        "from": "user",
        "username": user.username,
        "payload": msg,
        "raw": msg,
        "topic": state.MQTT_PUB_TOPIC,
        "timestamp": ts,
    }
    state.add_chat(entry)

    # 2) Publier sur MQTT un JSON marqué comme venant du web
    payload_mqtt = json.dumps(
        {
            "from": "web",
            "user": user.username,
            "msg": msg,
            "timestamp": ts,
        },
        ensure_ascii=False,
    )

    try:
        c = mqtt.Client()
        c.connect(state.MQTT_HOST, state.MQTT_PORT, 30)
        c.publish(state.MQTT_PUB_TOPIC, payload_mqtt)
        c.disconnect()
    except Exception as e:
        print("[MQTT SEND] error:", e)

    return {"success": True, "sent": {"from": "web", "msg": msg}}
