from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    username: Optional[str] = None
    about: Optional[str] = None
    avatar: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    avatar: str = ""
    about: str = "Hey there! I am using Conversa."
    is_online: bool = False
    last_seen: Optional[str] = None


class UserInDB(BaseModel):
    username: str
    email: str
    password_hash: str
    avatar: str = ""
    about: str = "Hey there! I am using Conversa."
    is_online: bool = False
    last_seen: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
