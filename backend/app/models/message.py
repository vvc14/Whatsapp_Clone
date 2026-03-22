from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class MessageCreate(BaseModel):
    chat_id: str
    content: str = ""
    type: str = "text"  # "text" | "image" | "file" | "audio"
    file_url: Optional[str] = None


class MessageResponse(BaseModel):
    id: str
    chat_id: str
    sender_id: str
    sender_name: str = ""
    sender_avatar: str = ""
    content: str = ""
    type: str = "text"
    file_url: Optional[str] = None
    read_by: List[str] = []
    created_at: str = ""
    deleted: bool = False


class MessageInDB(BaseModel):
    chat_id: str
    sender_id: str
    content: str = ""
    type: str = "text"
    file_url: Optional[str] = None
    read_by: List[str] = []
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    deleted: bool = False
