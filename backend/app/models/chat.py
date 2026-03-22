from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ChatCreate(BaseModel):
    participant_id: str


class GroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    participants: List[str]  # list of user IDs
    avatar: Optional[str] = ""


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    add_participants: Optional[List[str]] = None
    remove_participants: Optional[List[str]] = None


class LastMessage(BaseModel):
    content: str = ""
    sender_id: str = ""
    sender_name: str = ""
    created_at: str = ""
    type: str = "text"


class ChatResponse(BaseModel):
    id: str
    type: str = "private"  # "private" | "group"
    participants: List[dict] = []
    group_name: Optional[str] = None
    group_avatar: Optional[str] = None
    admin: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
    last_message: Optional[LastMessage] = None
    unread_count: int = 0


class ChatInDB(BaseModel):
    type: str = "private"
    participants: List[str] = []
    group_name: Optional[str] = None
    group_avatar: Optional[str] = None
    admin: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    last_message: Optional[dict] = None
