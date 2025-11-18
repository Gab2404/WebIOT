from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

import state
import mqtt_client  # l'import lance le client MQTT en tâche de fond
from auth_routes import router as auth_router
from iot_routes import router as iot_router
from chat_routes import router as chat_router


app = FastAPI(title="WebIOT", version="1.0.0")

SESSION_SECRET = state.os.environ.get("SESSION_SECRET", "dev-secret-change-me")
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    session_cookie="webiot_session",
    max_age=60 * 60 * 24,
)

# Routers API
app.include_router(auth_router, prefix="/api")
app.include_router(iot_router, prefix="/api")
app.include_router(chat_router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Static frontend
if state.SITE_DIR.exists():
    app.mount("/", StaticFiles(directory=str(state.SITE_DIR), html=True), name="site")
else:
    @app.get("/")
    def no_site():
        return {"error": "dossier 'site' introuvable"}
