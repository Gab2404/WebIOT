from pathlib import Path
from typing import Optional, List, Dict, Any
import os

# ==========================
# Chemins fichiers
# ==========================

BASE_DIR = Path(__file__).resolve().parent
SITE_DIR = BASE_DIR / "site"
DATA_DIR = BASE_DIR / "data"
USERS_FILE = DATA_DIR / "users.json"

DATA_DIR.mkdir(exist_ok=True)
if not USERS_FILE.exists():
    USERS_FILE.write_text("[]", encoding="utf-8")

# ==========================
# Config MQTT
# ==========================

MQTT_HOST = os.environ.get("MQTT_HOST", "test.mosquitto.org")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))

# Un seul topic partagé
MQTT_TOPIC = os.environ.get("MQTT_TOPIC", "iot/demo")
MQTT_SUB_TOPIC = MQTT_TOPIC      # backend écoute ici
MQTT_PUB_TOPIC = MQTT_TOPIC      # backend envoie ici aussi

# ==========================
# État global en mémoire
# ==========================

last_message: Optional[Dict[str, Any]] = None
mqtt_connected: bool = False
chat_messages: List[Dict[str, Any]] = []
CHAT_MAX = 100

# Contenu brut du DERNIER message publié par le site sur MQTT.
# Permet d'ignorer l'écho de ce message dans _on_message pour éviter les doublons.
last_sent_raw_from_web: Optional[str] = None


def add_chat(msg: Dict[str, Any]) -> None:
    """Ajoute un message dans l'historique du chat (avec limite)."""
    chat_messages.append(msg)
    if len(chat_messages) > CHAT_MAX:
        del chat_messages[0 : len(chat_messages) - CHAT_MAX]
