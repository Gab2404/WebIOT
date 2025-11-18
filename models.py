from typing import Optional
from pydantic import BaseModel, Field


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
