import json
import time
import threading

import paho.mqtt.client as mqtt

import state


def _on_connect(client, userdata, flags, rc):
    if rc == 0:
        state.mqtt_connected = True
        print(f"[MQTT] Connected to {state.MQTT_HOST}:{state.MQTT_PORT}")
        client.subscribe(state.MQTT_SUB_TOPIC)
    else:
        state.mqtt_connected = False
        print("[MQTT] connect error rc=", rc)


def _on_message(client, userdata, msg):
    """
    Callback quand un message arrive sur MQTT.

    On reçoit TOUT ce qui passe sur MQTT_TOPIC (iot/demo).

    - Si le message est exactement le dernier payload brut publié par le site
      (state.last_sent_raw_from_web), on considère que c'est l'écho de notre
      propre message -> on l'ignore pour ne pas le dupliquer dans le chat.
    - Si le message commence par "MODE:", c'est une commande de changement de mode
      -> on l'ignore également pour ne pas polluer le chat.
    - Tous les autres messages sont ajoutés dans l'historique comme "device".
    """
    raw = msg.payload.decode(errors="ignore")

    # Ignorer l'écho du dernier message envoyé par le site
    if state.last_sent_raw_from_web is not None and raw == state.last_sent_raw_from_web:
        # On remet à None pour ne pas ignorer d'autres messages identiques plus tard
        state.last_sent_raw_from_web = None
        return

    # IMPORTANT: Ignorer les commandes MODE: pour ne pas polluer le chat
    if raw.startswith("MODE:"):
        print(f"[MQTT] Ignoring MODE command: {raw}")
        return

    try:
        payload = json.loads(raw)
    except Exception:
        # pas du JSON -> texte brut
        payload = raw

    ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    state.last_message = {
        "topic": msg.topic,
        "payload": payload,
        "raw": raw,
        "timestamp": ts,
    }
    print("[MQTT] msg:", state.last_message)

    if msg.topic == state.MQTT_SUB_TOPIC:
        state.add_chat(
            {
                "from": "device",
                "topic": msg.topic,
                "payload": payload,
                "raw": raw,
                "timestamp": ts,
            }
        )


def _loop():
    client = mqtt.Client()
    client.on_connect = _on_connect
    client.on_message = _on_message
    try:
        client.connect(state.MQTT_HOST, state.MQTT_PORT, 60)
        client.loop_forever(retry_first_connection=True)
    except Exception as e:
        print("[MQTT] error:", e)


# lancer le client en tâche de fond dès l'import
threading.Thread(target=_loop, daemon=True).start()