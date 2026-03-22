from fastapi import APIRouter, Depends, HTTPException, status
from app.models.chat import ChatCreate, GroupCreate, GroupUpdate
from app.database import chats_collection, users_collection, messages_collection
from app.auth.jwt import get_current_user
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/api/chats", tags=["Chats"])


def serialize_user(user):
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "avatar": user.get("avatar", ""),
        "about": user.get("about", ""),
        "is_online": user.get("is_online", False),
        "last_seen": user.get("last_seen"),
    }


@router.post("")
async def create_or_get_private_chat(chat: ChatCreate, current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    participant_id = chat.participant_id

    if user_id == participant_id:
        raise HTTPException(status_code=400, detail="Cannot create chat with yourself")

    # Check if participant exists
    participant = await users_collection.find_one({"_id": ObjectId(participant_id)})
    if not participant:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if private chat already exists
    existing_chat = await chats_collection.find_one({
        "type": "private",
        "participants": {"$all": [user_id, participant_id]},
    })

    if existing_chat:
        participants_data = []
        for pid in existing_chat["participants"]:
            u = await users_collection.find_one({"_id": ObjectId(pid)})
            if u:
                participants_data.append(serialize_user(u))
        return {
            "id": str(existing_chat["_id"]),
            "type": "private",
            "participants": participants_data,
            "last_message": existing_chat.get("last_message"),
            "created_at": existing_chat.get("created_at", ""),
            "updated_at": existing_chat.get("updated_at", ""),
        }

    # Create new private chat
    now = datetime.utcnow().isoformat()
    chat_doc = {
        "type": "private",
        "participants": [user_id, participant_id],
        "group_name": None,
        "group_avatar": None,
        "admin": None,
        "created_at": now,
        "updated_at": now,
        "last_message": None,
    }
    result = await chats_collection.insert_one(chat_doc)

    participants_data = []
    for pid in [user_id, participant_id]:
        u = await users_collection.find_one({"_id": ObjectId(pid)})
        if u:
            participants_data.append(serialize_user(u))

    return {
        "id": str(result.inserted_id),
        "type": "private",
        "participants": participants_data,
        "last_message": None,
        "created_at": now,
        "updated_at": now,
    }


@router.get("")
async def get_chats(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]

    cursor = chats_collection.find({
        "participants": user_id
    }).sort("updated_at", -1)

    chats = []
    async for chat in cursor:
        participants_data = []
        for pid in chat["participants"]:
            u = await users_collection.find_one({"_id": ObjectId(pid)})
            if u:
                participants_data.append(serialize_user(u))

        # Count unread messages
        unread_count = await messages_collection.count_documents({
            "chat_id": str(chat["_id"]),
            "sender_id": {"$ne": user_id},
            "read_by": {"$nin": [user_id]},
            "deleted": False,
        })

        chats.append({
            "id": str(chat["_id"]),
            "type": chat.get("type", "private"),
            "participants": participants_data,
            "group_name": chat.get("group_name"),
            "group_avatar": chat.get("group_avatar"),
            "admin": chat.get("admin"),
            "last_message": chat.get("last_message"),
            "created_at": chat.get("created_at", ""),
            "updated_at": chat.get("updated_at", ""),
            "unread_count": unread_count,
        })

    return chats


@router.get("/{chat_id}")
async def get_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    try:
        chat = await chats_collection.find_one({"_id": ObjectId(chat_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Chat not found")

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    if current_user["id"] not in chat["participants"]:
        raise HTTPException(status_code=403, detail="Not a participant")

    participants_data = []
    for pid in chat["participants"]:
        u = await users_collection.find_one({"_id": ObjectId(pid)})
        if u:
            participants_data.append(serialize_user(u))

    return {
        "id": str(chat["_id"]),
        "type": chat.get("type", "private"),
        "participants": participants_data,
        "group_name": chat.get("group_name"),
        "group_avatar": chat.get("group_avatar"),
        "admin": chat.get("admin"),
        "last_message": chat.get("last_message"),
        "created_at": chat.get("created_at", ""),
        "updated_at": chat.get("updated_at", ""),
    }


@router.post("/group")
async def create_group(group: GroupCreate, current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]

    # Include creator in participants
    all_participants = list(set([user_id] + group.participants))

    # Verify all participants exist
    for pid in group.participants:
        user = await users_collection.find_one({"_id": ObjectId(pid)})
        if not user:
            raise HTTPException(status_code=404, detail=f"User {pid} not found")

    now = datetime.utcnow().isoformat()
    chat_doc = {
        "type": "group",
        "participants": all_participants,
        "group_name": group.name,
        "group_avatar": group.avatar or "",
        "admin": user_id,
        "created_at": now,
        "updated_at": now,
        "last_message": None,
    }
    result = await chats_collection.insert_one(chat_doc)

    participants_data = []
    for pid in all_participants:
        u = await users_collection.find_one({"_id": ObjectId(pid)})
        if u:
            participants_data.append(serialize_user(u))

    return {
        "id": str(result.inserted_id),
        "type": "group",
        "participants": participants_data,
        "group_name": group.name,
        "group_avatar": group.avatar or "",
        "admin": user_id,
        "created_at": now,
        "updated_at": now,
        "last_message": None,
    }


@router.put("/group/{chat_id}")
async def update_group(chat_id: str, update: GroupUpdate, current_user: dict = Depends(get_current_user)):
    chat = await chats_collection.find_one({"_id": ObjectId(chat_id)})
    if not chat:
        raise HTTPException(status_code=404, detail="Group not found")

    if chat.get("type") != "group":
        raise HTTPException(status_code=400, detail="Not a group chat")

    if chat.get("admin") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only admin can update group")

    update_data = {"updated_at": datetime.utcnow().isoformat()}

    if update.name is not None:
        update_data["group_name"] = update.name
    if update.avatar is not None:
        update_data["group_avatar"] = update.avatar

    participants = chat["participants"]
    if update.add_participants:
        for pid in update.add_participants:
            u = await users_collection.find_one({"_id": ObjectId(pid)})
            if not u:
                raise HTTPException(status_code=404, detail=f"User {pid} not found")
            if pid not in participants:
                participants.append(pid)
        update_data["participants"] = participants

    if update.remove_participants:
        for pid in update.remove_participants:
            if pid == current_user["id"]:
                continue  # Admin can't remove themselves
            if pid in participants:
                participants.remove(pid)
        update_data["participants"] = participants

    await chats_collection.update_one(
        {"_id": ObjectId(chat_id)},
        {"$set": update_data}
    )

    updated_chat = await chats_collection.find_one({"_id": ObjectId(chat_id)})
    participants_data = []
    for pid in updated_chat["participants"]:
        u = await users_collection.find_one({"_id": ObjectId(pid)})
        if u:
            participants_data.append(serialize_user(u))

    return {
        "id": str(updated_chat["_id"]),
        "type": "group",
        "participants": participants_data,
        "group_name": updated_chat.get("group_name"),
        "group_avatar": updated_chat.get("group_avatar"),
        "admin": updated_chat.get("admin"),
        "created_at": updated_chat.get("created_at", ""),
        "updated_at": updated_chat.get("updated_at", ""),
    }
