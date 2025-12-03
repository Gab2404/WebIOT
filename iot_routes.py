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
    IMPORTANT: Les commandes MODE: ne sont PAS ajoutées à l'historique du chat.
    """
    msg = payload.message.strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Message vide.")

    ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

    # Vérifier si c'est une commande MODE (pour changer le mode de l'ESP32)
    is_mode_command = msg.startswith("MODE:")
    
    # 1) Ajouter le message dans l'historique SEULEMENT si ce n'est PAS une commande MODE
    if not is_mode_command:
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
        # SAUF pour les commandes MODE (on veut ignorer leur écho de toute façon)
        if not is_mode_command:
            state.last_sent_raw_from_web = msg

        # IMPORTANT : On envoie JUSTE le message texte brut, PAS de JSON
        c.publish(state.MQTT_PUB_TOPIC, msg)
        c.disconnect()
    except Exception as e:
        print("[MQTT SEND] error:", e)
        raise HTTPException(status_code=500, detail="Erreur d'envoi MQTT")

    return {"success": True, "sent": msg}