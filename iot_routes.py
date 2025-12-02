import time

from fastapi import APIRouter, Depends, HTTPException
import paho.mqtt.client as mqtt

from models import ChatSendIn, SessionUser
from auth_routes import require_auth
import state


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
    Envoie un message depuis le site vers MQTT.
    
    Sur MQTT, on envoie SEULEMENT le texte brut pour que la matrice LED
    puisse l'afficher directement sans avoir à parser du JSON.
    
    Dans l'historique du chat côté web, on stocke les métadonnées complètes.
    """
    msg = payload.message.strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Message vide.")

    ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

    # 1) Ajouter le message de l'utilisateur dans l'historique du chat avec métadonnées
    entry = {
        "from": "user",
        "username": user.username,
        "payload": msg,
        "raw": msg,
        "topic": state.MQTT_PUB_TOPIC,
        "timestamp": ts,
    }
    state.add_chat(entry)

    # 2) Publier sur MQTT UNIQUEMENT le texte brut (pas de JSON)
    #    Comme ça, l'ESP32/matrice LED reçoit directement le message au lieu de tout le JSON
    try:
        c = mqtt.Client()
        c.connect(state.MQTT_HOST, state.MQTT_PORT, 30)

        # On mémorise ce qu'on envoie pour pouvoir ignorer l'écho dans _on_message
        state.last_sent_raw_from_web = msg

        # IMPORTANT : On envoie JUSTE le message texte brut, PAS de JSON
        c.publish(state.MQTT_PUB_TOPIC, msg)
        c.disconnect()
    except Exception as e:
        print("[MQTT SEND] error:", e)
        raise HTTPException(status_code=500, detail="Erreur d'envoi MQTT")

    return {"success": True, "sent": msg}