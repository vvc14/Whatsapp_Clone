from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.models.message import MessageCreate
from app.database import messages_collection, chats_collection, users_collection
from app.auth.jwt import get_current_user
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/api/messages", tags=["Messages"])


@router.get("/{chat_id}")
async def get_messages(
    chat_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    # Verify user is participant
    chat = await chats_collection.find_one({"_id": ObjectId(chat_id)})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    if current_user["id"] not in chat["participants"]:
        raise HTTPException(status_code=403, detail="Not a participant")

    cursor = messages_collection.find(
        {"chat_id": chat_id, "deleted": False}
    ).sort("created_at", -1).skip(skip).limit(limit)

    messages = []
    async for msg in cursor:
        sender = await users_collection.find_one({"_id": ObjectId(msg["sender_id"])})
        messages.append({
            "id": str(msg["_id"]),
            "chat_id": msg["chat_id"],
            "sender_id": msg["sender_id"],
            "sender_name": sender["username"] if sender else "Unknown",
            "sender_avatar": sender.get("avatar", "") if sender else "",
            "content": msg.get("content", ""),
            "type": msg.get("type", "text"),
            "file_url": msg.get("file_url"),
            "read_by": msg.get("read_by", []),
            "created_at": msg.get("created_at", ""),
            "deleted": msg.get("deleted", False),
        })

    messages.reverse()
    return messages


@router.post("")
async def send_message(message: MessageCreate, current_user: dict = Depends(get_current_user)):
    # Verify user is participant
    chat = await chats_collection.find_one({"_id": ObjectId(message.chat_id)})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    if current_user["id"] not in chat["participants"]:
        raise HTTPException(status_code=403, detail="Not a participant")

    now = datetime.utcnow().isoformat()
    msg_doc = {
        "chat_id": message.chat_id,
        "sender_id": current_user["id"],
        "content": message.content,
        "type": message.type,
        "file_url": message.file_url,
        "read_by": [current_user["id"]],
        "created_at": now,
        "deleted": False,
    }

    result = await messages_collection.insert_one(msg_doc)

    # Update chat's last_message and updated_at
    await chats_collection.update_one(
        {"_id": ObjectId(message.chat_id)},
        {"$set": {
            "last_message": {
                "content": message.content,
                "sender_id": current_user["id"],
                "sender_name": current_user["username"],
                "created_at": now,
                "type": message.type,
            },
            "updated_at": now,
        }}
    )

    return {
        "id": str(result.inserted_id),
        "chat_id": message.chat_id,
        "sender_id": current_user["id"],
        "sender_name": current_user["username"],
        "sender_avatar": current_user.get("avatar", ""),
        "content": message.content,
        "type": message.type,
        "file_url": message.file_url,
        "read_by": [current_user["id"]],
        "created_at": now,
        "deleted": False,
    }


@router.put("/{message_id}/read")
async def mark_as_read(message_id: str, current_user: dict = Depends(get_current_user)):
    msg = await messages_collection.find_one({"_id": ObjectId(message_id)})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if current_user["id"] not in msg.get("read_by", []):
        await messages_collection.update_one(
            {"_id": ObjectId(message_id)},
            {"$addToSet": {"read_by": current_user["id"]}}
        )

    return {"status": "ok"}


@router.put("/{chat_id}/read-all")
async def mark_all_as_read(chat_id: str, current_user: dict = Depends(get_current_user)):
    await messages_collection.update_many(
        {
            "chat_id": chat_id,
            "sender_id": {"$ne": current_user["id"]},
            "read_by": {"$nin": [current_user["id"]]},
        },
        {"$addToSet": {"read_by": current_user["id"]}}
    )
    return {"status": "ok"}


@router.delete("/{message_id}")
async def delete_message(message_id: str, current_user: dict = Depends(get_current_user)):
    msg = await messages_collection.find_one({"_id": ObjectId(message_id)})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if msg["sender_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Can only delete own messages")

    await messages_collection.update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {"deleted": True, "content": "This message was deleted"}}
    )

    return {"status": "ok"}
