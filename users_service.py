from typing import List, Optional, Dict, Any
import json
import time
import os

from passlib.hash import pbkdf2_sha256

import state


def read_users() -> List[Dict[str, Any]]:
    try:
        return json.loads(state.USERS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def write_users(users: List[Dict[str, Any]]) -> None:
    state.USERS_FILE.write_text(
        json.dumps(users, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def find_user(username: str) -> Optional[Dict[str, Any]]:
    for u in read_users():
        if u["username"].lower() == username.lower():
            return u
    return None


def create_user(username: str, email: Optional[str], password: str) -> Dict[str, Any]:
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
