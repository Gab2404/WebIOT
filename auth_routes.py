from typing import Optional

from fastapi import APIRouter, Request, HTTPException
from passlib.hash import pbkdf2_sha256

from models import RegisterIn, LoginIn, SessionUser
import users_service


router = APIRouter(prefix="/auth", tags=["auth"])


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


@router.post("/register")
def auth_register(payload: RegisterIn, request: Request):
    try:
        user = users_service.create_user(payload.username, payload.email, payload.password)
        su = SessionUser(
            id=user["id"],
            username=user["username"],
            role=user["role"],
            email=user.get("email"),
        )
        request.session["user"] = su.model_dump()
        return {"success": True, "user": su.model_dump()}
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        print("[register] error", e)
        raise HTTPException(status_code=500, detail="Erreur serveur")


@router.post("/login")
def auth_login(payload: LoginIn, request: Request):
    user = users_service.find_user(payload.username)
    if not user or not pbkdf2_sha256.verify(payload.password, user["passwordHash"]):
        raise HTTPException(status_code=401, detail="Identifiants invalides.")
    su = SessionUser(
        id=user["id"],
        username=user["username"],
        role=user["role"],
        email=user.get("email"),
    )
    request.session["user"] = su.model_dump()
    return {"success": True, "user": su.model_dump()}


@router.post("/logout")
def auth_logout(request: Request):
    request.session.clear()
    return {"success": True}


@router.get("/me")
def auth_me(request: Request):
    su = get_session_user(request)
    return {"user": su.model_dump() if su else None}
