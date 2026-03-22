import socketio
from app.config import settings
from app.auth.jwt import decode_token
from app.database import users_collection, chats_collection, messages_collection
from bson import ObjectId
from datetime import datetime

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.ALLOWED_ORIGINS,
    logger=False,
    engineio_logger=False,
)

# Track online users: {user_id: sid}
online_users = {}
# Track user to sid mapping: {sid: user_id}
sid_to_user = {}


@sio.event
async def connect(sid, environ, auth):
    """Handle client connection with JWT auth."""
    token = None
    if auth and isinstance(auth, dict):
        token = auth.get("token")

    if not token:
        # Try query params
        query_string = environ.get("QUERY_STRING", "")
        for param in query_string.split("&"):
            if param.startswith("token="):
                token = param.split("=", 1)[1]
                break

    if not token:
        return False

    payload = decode_token(token)
    if not payload:
        return False

    user_id = payload.get("sub")
    if not user_id:
        return False

    # Store user mapping
    online_users[user_id] = sid
    sid_to_user[sid] = user_id

    # Update user online status
    await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_online": True, "last_seen": datetime.utcnow().isoformat()}}
    )

    # Join all user's chat rooms
    user_chats = chats_collection.find({"participants": user_id})
    async for chat in user_chats:
        await sio.enter_room(sid, str(chat["_id"]))

    # Broadcast online status to all connected users
    await sio.emit("user_online", {"user_id": user_id}, skip_sid=sid)

    print(f"User {user_id} connected (sid: {sid})")


@sio.event
async def disconnect(sid):
    """Handle client disconnection."""
    user_id = sid_to_user.pop(sid, None)
    if user_id:
        online_users.pop(user_id, None)

        # Update user offline status
        await users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"is_online": False, "last_seen": datetime.utcnow().isoformat()}}
        )

        # Broadcast offline status
        await sio.emit("user_offline", {"user_id": user_id})

        print(f"User {user_id} disconnected")


@sio.event
async def join_chat(sid, data):
    """Join a chat room."""
    chat_id = data.get("chat_id")
    if chat_id:
        await sio.enter_room(sid, chat_id)


@sio.event
async def leave_chat(sid, data):
    """Leave a chat room."""
    chat_id = data.get("chat_id")
    if chat_id:
        await sio.leave_room(sid, chat_id)


@sio.event
async def send_message(sid, data):
    """Handle incoming message via socket."""
    user_id = sid_to_user.get(sid)
    if not user_id:
        return

    chat_id = data.get("chat_id")
    content = data.get("content", "")
    msg_type = data.get("type", "text")
    file_url = data.get("file_url")

    # Verify user is participant
    chat = await chats_collection.find_one({"_id": ObjectId(chat_id)})
    if not chat or user_id not in chat["participants"]:
        return

    # Get sender info
    sender = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not sender:
        return

    now = datetime.utcnow().isoformat()

    # Save message to DB
    msg_doc = {
        "chat_id": chat_id,
        "sender_id": user_id,
        "content": content,
        "type": msg_type,
        "file_url": file_url,
        "read_by": [user_id],
        "created_at": now,
        "deleted": False,
    }
    result = await messages_collection.insert_one(msg_doc)

    # Update chat's last message
    await chats_collection.update_one(
        {"_id": ObjectId(chat_id)},
        {"$set": {
            "last_message": {
                "content": content,
                "sender_id": user_id,
                "sender_name": sender["username"],
                "created_at": now,
                "type": msg_type,
            },
            "updated_at": now,
        }}
    )

    # Prepare message response
    message_response = {
        "id": str(result.inserted_id),
        "chat_id": chat_id,
        "sender_id": user_id,
        "sender_name": sender["username"],
        "sender_avatar": sender.get("avatar", ""),
        "content": content,
        "type": msg_type,
        "file_url": file_url,
        "read_by": [user_id],
        "created_at": now,
        "deleted": False,
    }

    # Broadcast to all participants in the chat room
    await sio.emit("new_message", message_response, room=chat_id)

    # Also send chat update to all participants for sidebar refresh
    for pid in chat["participants"]:
        if pid in online_users:
            await sio.emit("chat_updated", {"chat_id": chat_id}, to=online_users[pid])


@sio.event
async def typing(sid, data):
    """Broadcast typing indicator."""
    user_id = sid_to_user.get(sid)
    if not user_id:
        return

    chat_id = data.get("chat_id")
    sender = await users_collection.find_one({"_id": ObjectId(user_id)})
    username = sender["username"] if sender else "Unknown"

    await sio.emit("user_typing", {
        "chat_id": chat_id,
        "user_id": user_id,
        "username": username,
    }, room=chat_id, skip_sid=sid)


@sio.event
async def stop_typing(sid, data):
    """Broadcast stop typing."""
    user_id = sid_to_user.get(sid)
    if not user_id:
        return

    chat_id = data.get("chat_id")
    await sio.emit("user_stop_typing", {
        "chat_id": chat_id,
        "user_id": user_id,
    }, room=chat_id, skip_sid=sid)


@sio.event
async def message_read(sid, data):
    """Handle read receipt."""
    user_id = sid_to_user.get(sid)
    if not user_id:
        return

    chat_id = data.get("chat_id")
    message_ids = data.get("message_ids", [])

    # Mark messages as read
    for msg_id in message_ids:
        await messages_collection.update_one(
            {"_id": ObjectId(msg_id)},
            {"$addToSet": {"read_by": user_id}}
        )

    # Broadcast read receipt to chat
    await sio.emit("messages_read", {
        "chat_id": chat_id,
        "user_id": user_id,
        "message_ids": message_ids,
    }, room=chat_id, skip_sid=sid)
