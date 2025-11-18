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

    Pour le chat :
      - si payload = {"from": "web", ...} -> message envoyé par le site -> on NE l'ajoute pas
      - tout le reste (device, MQTTX, texte brut...) -> ajouté comme "from": "device"
    """
    raw = msg.payload.decode(errors="ignore")

    try:
        payload = json.loads(raw)
    except Exception:
        payload = raw  # pas du JSON -> texte brut

    ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    state.last_message = {
        "topic": msg.topic,
        "payload": payload,
        "raw": raw,
        "timestamp": ts,
    }
    print("[MQTT] msg:", state.last_message)

    if msg.topic == state.MQTT_SUB_TOPIC:
        if isinstance(payload, dict) and payload.get("from") == "web":
            # message provenant du site -> pas dans l'historique "device"
            return

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
