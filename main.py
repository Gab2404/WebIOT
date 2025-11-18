from pathlib import Path
from typing import Optional, List, Dict, Any
import json
import os
import time
import threading

from fastapi import FastAPI, APIRouter, Request, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel, Field
from passlib.hash import pbkdf2_sha256
import paho.mqtt.client as mqtt

# ==========================
# Chemins
# ==========================

BASE_DIR = Path(__file__).resolve().parent
SITE_DIR = BASE_DIR / "site"
DATA_DIR = BASE_DIR / "data"
USERS_FILE = DATA_DIR / "users.json"

DATA_DIR.mkdir(exist_ok=True)
if not USERS_FILE.exists():
    USERS_FILE.write_text("[]", encoding="utf-8")

# ==========================
# MQTT CONFIG (simple)
# ==========================

MQTT_HOST = os.environ.get("MQTT_HOST", "test.mosquitto.org")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
MQTT_SUB_TOPIC = os.environ.get("MQTT_SUB_TOPIC", "iot/demo")
MQTT_PUB_TOPIC = os.environ.get("MQTT_PUB_TOPIC", "iot/commands")

last_message: Optional[Dict[str, Any]] = None
mqtt_connected: bool = False
chat_messages: List[Dict[str, Any]] = []
CHAT_MAX = 100


def _add_chat(msg: Dict[str, Any]) -> None:
    chat_messages.append(msg)
    if len(chat_messages) > CHAT_MAX:
        del chat_messages[0 : len(chat_messages) - CHAT_MAX]


def _on_connect(client, userdata, flags, rc):
    global mqtt_connected
    if rc == 0:
        mqtt_connected = True
        print(f"[MQTT] Connected to {MQTT_HOST}:{MQTT_PORT}")
        client.subscribe(MQTT_SUB_TOPIC)
    else:
        mqtt_connected = False
        print("[MQTT] connect error rc=", rc)


def _on_message(client, userdata, msg):
    global last_message
    raw = msg.payload.decode(errors="ignore")
    try:
        payload = json.loads(raw)
    except Exception:
        payload = raw

    ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    last_message = {
        "topic": msg.topic,
        "payload": payload,
        "raw": raw,
        "timestamp": ts,
    }
    print("[MQTT] msg:", last_message)

    if msg.topic == MQTT_SUB_TOPIC:
        _add_chat(
            {
                "from": "device",
                "topic": msg.topic,
                "payload": payload,
                "raw": raw,
                "timestamp": ts,
            }
        )


def _mqtt_loop():
    client = mqtt.Client()
    client.on_connect = _on_connect
    client.on_message = _on_message
    try:
        client.connect(MQTT_HOST, MQTT_PORT, 60)
        client.loop_forever(retry_first_connection=True)
    except Exception as e:
        print("[MQTT] error:", e)


threading.Thread(target=_mqtt_loop, daemon=True).start()

# ==========================
# Modèles
# ==========================


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: Optional[str] = None
    password: str = Field(min_length=4, max_length=200)


class LoginIn(BaseModel):
    username: str
    password: str


class SessionUser(BaseModel):
    id: str
    username: str
    role: str
    email: Optional[str] = None


class ChatSendIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)


# ==========================
# Users.json helpers
# ==========================


def read_users() -> List[dict]:
    try:
        return json.loads(USERS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def write_users(users: List[dict]) -> None:
    USERS_FILE.write_text(json.dumps(users, indent=2, ensure_ascii=False), encoding="utf-8")


def find_user(username: str) -> Optional[dict]:
    for u in read_users():
        if u["username"].lower() == username.lower():
            return u
    return None


def create_user(username: str, email: Optional[str], password: str) -> dict:
    users = read_users()
    if any(u["username"].lower() == username.lower() for u in users):
        raise ValueError("Nom d’utilisateur déjà pris.")
    user = {
        "id": f"{int(time.time()*1000):x}-{os.urandom(3).hex()}",
        "username": username,
        "email": email,
        "passwordHash": pbkdf2_sha256.hash(password),
        "role": "user",
    }
    users.append(user)
    write_users(users)
    return user


# ==========================
# FastAPI
# ==========================

app = FastAPI(title="WebIOT", version="1.0.0")

SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev-secret-change-me")
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    session_cookie="webiot_session",
    max_age=60 * 60 * 24,
)

api = APIRouter(prefix="/api")


def get_session_user(request: Request) -> Optional[SessionUser]:
    data = request.session.get("user")
    if not data:
        return None
    try:
        return SessionUser(**data)
    except Exception:
        return None


def require_auth(request: Request) -> SessionUser:
    su = get_session_user(request)
    if not su:
        raise HTTPException(status_code=401, detail="Non autorisé")
    return su


# ===== AUTH =====


@api.post("/auth/register")
def auth_register(payload: RegisterIn, request: Request):
    try:
        user = create_user(payload.username, payload.email, payload.password)
        su = SessionUser(
            id=user["id"], username=user["username"], role=user["role"], email=user.get("email")
        )
        request.session["user"] = su.model_dump()
        return {"success": True, "user": su.model_dump()}
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        print("[register] error", e)
        raise HTTPException(status_code=500, detail="Erreur serveur")


@api.post("/auth/login")
def auth_login(payload: LoginIn, request: Request):
    user = find_user(payload.username)
    if not user or not pbkdf2_sha256.verify(payload.password, user["passwordHash"]):
        raise HTTPException(status_code=401, detail="Identifiants invalides.")
    su = SessionUser(
        id=user["id"], username=user["username"], role=user["role"], email=user.get("email")
    )
    request.session["user"] = su.model_dump()
    return {"success": True, "user": su.model_dump()}


@api.post("/auth/logout")
def auth_logout(request: Request):
    request.session.clear()
    return {"success": True}


@api.get("/auth/me")
def auth_me(request: Request):
    su = get_session_user(request)
    return {"user": su.model_dump() if su else None}


# ===== IOT simple =====


@api.get("/iot/latest")
def iot_latest(user: SessionUser = Depends(require_auth)):
    return {"connected": mqtt_connected, "topic": MQTT_SUB_TOPIC, "last": last_message}


@api.post("/iot/send")
def iot_send(payload: ChatSendIn, user: SessionUser = Depends(require_auth)):
    msg = payload.message.strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Message vide.")

    ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    entry = {"from": "user", "username": user.username, "payload": msg, "timestamp": ts}
    _add_chat(entry)

    try:
        c = mqtt.Client()
        c.connect(MQTT_HOST, MQTT_PORT, 30)
        c.publish(MQTT_PUB_TOPIC, msg)
        c.disconnect()
    except Exception as e:
        print("[MQTT SEND] error:", e)

    return {"success": True, "sent": msg}


# ===== Chat (historique) =====


@api.get("/chat/messages")
def chat_messages_api(user: SessionUser = Depends(require_auth)):
    return {"messages": chat_messages, "connected": mqtt_connected}


@api.post("/chat/send")
def chat_send(payload: ChatSendIn, user: SessionUser = Depends(require_auth)):
    return iot_send(payload, user)


# ===== Health =====


@api.get("/health")
def health():
    return {"status": "ok"}


app.include_router(api)

# ===== STATIC FRONTEND =====

if SITE_DIR.exists():
    app.mount("/", StaticFiles(directory=str(SITE_DIR), html=True), name="site")
else:
    @app.get("/")
    def no_site():
        return {"error": "dossier 'site' introuvable"}
