from fastapi import APIRouter, Depends, HTTPException, status
from app.models.user import UserUpdate, UserResponse
from app.database import users_collection
from app.auth.jwt import get_current_user
from bson import ObjectId
import re

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "avatar": current_user.get("avatar", ""),
        "about": current_user.get("about", "Hey there! I am using Conversa."),
        "is_online": current_user.get("is_online", False),
        "last_seen": current_user.get("last_seen"),
    }


@router.put("/me")
async def update_me(update: UserUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if update.username is not None:
        existing = await users_collection.find_one({
            "username": update.username,
            "_id": {"$ne": ObjectId(current_user["id"])}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        update_data["username"] = update.username
    if update.about is not None:
        update_data["about"] = update.about
    if update.avatar is not None:
        update_data["avatar"] = update.avatar

    if update_data:
        await users_collection.update_one(
            {"_id": ObjectId(current_user["id"])},
            {"$set": update_data}
        )

    updated_user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    return {
        "id": str(updated_user["_id"]),
        "username": updated_user["username"],
        "email": updated_user["email"],
        "avatar": updated_user.get("avatar", ""),
        "about": updated_user.get("about", "Hey there! I am using Conversa."),
        "is_online": updated_user.get("is_online", False),
        "last_seen": updated_user.get("last_seen"),
    }


@router.get("/search")
async def search_users(q: str, current_user: dict = Depends(get_current_user)):
    if not q or len(q) < 1:
        return []

    regex_pattern = re.compile(re.escape(q), re.IGNORECASE)
    cursor = users_collection.find({
        "$and": [
            {"_id": {"$ne": ObjectId(current_user["id"])}},
            {"$or": [
                {"username": {"$regex": regex_pattern}},
                {"email": {"$regex": regex_pattern}},
            ]}
        ]
    }).limit(20)

    users = []
    async for user in cursor:
        users.append({
            "id": str(user["_id"]),
            "username": user["username"],
            "email": user["email"],
            "avatar": user.get("avatar", ""),
            "about": user.get("about", "Hey there! I am using Conversa."),
            "is_online": user.get("is_online", False),
            "last_seen": user.get("last_seen"),
        })
    return users


@router.get("/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    try:
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
        "avatar": user.get("avatar", ""),
        "about": user.get("about", "Hey there! I am using Conversa."),
        "is_online": user.get("is_online", False),
        "last_seen": user.get("last_seen"),
    }
