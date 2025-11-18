from pathlib import Path
from typing import Optional, List
import json
import os
import time
import threading

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel, Field
from passlib.hash import pbkdf2_sha256
import paho.mqtt.client as mqtt

# ==========================
# Chemins / fichiers
# ==========================
BASE_DIR = Path(__file__).resolve().parent
SITE_DIR = BASE_DIR / "site"
DATA_DIR = BASE_DIR / "data"
USERS_FILE = DATA_DIR / "users.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)
if not USERS_FILE.exists():
    USERS_FILE.write_text("[]", encoding="utf-8")

# ==========================
# Config MQTT
# ==========================
MQTT_HOST = os.environ.get("MQTT_HOST", "test.mosquitto.org")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
MQTT_SUB_TOPIC = os.environ.get("MQTT_SUB_TOPIC", "iot/demo")

last_message: Optional[dict] = None
mqtt_connected: bool = False

def _on_connect(client, userdata, flags, rc):
    global mqtt_connected
    if rc == 0:
        mqtt_connected = True
        print(f"[mqtt] Connected to {MQTT_HOST}:{MQTT_PORT}")
        client.subscribe(MQTT_SUB_TOPIC)
        print(f"[mqtt] Subscribed to {MQTT_SUB_TOPIC}")
    else:
        mqtt_connected = False
        print("[mqtt] connect error rc=", rc)

def _on_message(client, userdata, msg):
    global last_message
    raw = msg.payload.decode(errors="ignore")
    try:
        payload = json.loads(raw)
    except Exception:
        payload = raw
    last_message = {
        "topic": msg.topic,
        "payload": payload,
        "raw": raw,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    print("[mqtt] message:", last_message)

def _mqtt_loop():
    client = mqtt.Client()
    client.on_connect = _on_connect
    client.on_message = _on_message
    try:
        print(f"[mqtt] connecting to {MQTT_HOST}:{MQTT_PORT} ...")
        client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        client.loop_forever(retry_first_connection=True)
    except Exception as e:
        print("[mqtt] connection error:", e)

# démarrage du thread MQTT au lancement du backend
threading.Thread(target=_mqtt_loop, daemon=True).start()

# ==========================
# Modèles pour auth
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

# ==========================
# Fonctions users.json
# ==========================
def read_users() -> List[dict]:
    try:
        return json.loads(USERS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []

def write_users(users: List[dict]) -> None:
    USERS_FILE.write_text(json.dumps(users, indent=2, ensure_ascii=False), encoding="utf-8")

def find_user_by_username(username: str) -> Optional[dict]:
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
# App FastAPI
# ==========================
app = FastAPI(title="WebIOT FastAPI backend", version="1.0.0")

SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev_secret_change_me")
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    session_cookie="webiot_session",
    max_age=60 * 60 * 24,
)

api = APIRouter(prefix="/api")

# ==========================
# Helpers session
# ==========================
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

# ==========================
# Routes AUTH
# ==========================
@api.post("/auth/register")
def auth_register(payload: RegisterIn, request: Request):
    try:
        user = create_user(payload.username, payload.email, payload.password)
        session_user = SessionUser(
            id=user["id"],
            username=user["username"],
            role=user["role"],
            email=user.get("email"),
        )
        request.session["user"] = session_user.model_dump()
        return {"success": True, "user": session_user.model_dump()}
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        print("[auth/register] error:", e)
        raise HTTPException(status_code=500, detail="Erreur serveur")

@api.post("/auth/login")
def auth_login(payload: LoginIn, request: Request):
    user = find_user_by_username(payload.username)
    if not user or not pbkdf2_sha256.verify(payload.password, user["passwordHash"]):
        raise HTTPException(status_code=401, detail="Identifiants invalides.")
    session_user = SessionUser(
        id=user["id"],
        username=user["username"],
        role=user["role"],
        email=user.get("email"),
    )
    request.session["user"] = session_user.model_dump()
    return {"success": True, "user": session_user.model_dump()}

@api.post("/auth/logout")
def auth_logout(request: Request):
  request.session.clear()
  return {"success": True}

@api.get("/auth/me")
def auth_me(request: Request):
    su = get_session_user(request)
    return {"user": su.model_dump() if su else None}

# ==========================
# IoT / MQTT
# ==========================
@api.get("/iot/latest")
def iot_latest(user: SessionUser = Depends(require_auth)):
    return {
        "connected": mqtt_connected,
        "subTopic": MQTT_SUB_TOPIC,
        "last": last_message,
    }

# ==========================
# Healthcheck
# ==========================
@api.get("/health")
def health():
    return {"status": "ok"}

# Monter l'API
app.include_router(api)

# ==========================
# Servir le frontend /site
# ==========================
if SITE_DIR.exists():
    app.mount("/", StaticFiles(directory=str(SITE_DIR), html=True), name="site")
else:
    @app.get("/")
    def no_site():
        return {"error": "Le dossier 'site' est introuvable"}
