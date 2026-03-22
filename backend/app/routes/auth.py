from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.models.user import UserCreate, UserLogin, UserResponse
from app.database import users_collection
from app.auth.jwt import hash_password, verify_password, create_access_token
from app.config import settings
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class GoogleAuthRequest(BaseModel):
    credential: str  # Google ID token


@router.post("/register")
async def register(user: UserCreate):
    # Check if email already exists
    existing_email = await users_collection.find_one({"email": user.email})
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Check if username already exists
    existing_username = await users_collection.find_one({"username": user.username})
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    # Create user
    user_doc = {
        "username": user.username,
        "email": user.email,
        "password_hash": hash_password(user.password),
        "avatar": "",
        "about": "Hey there! I am using Conversa.",
        "is_online": False,
        "last_seen": None,
        "auth_provider": "local",
        "created_at": datetime.utcnow().isoformat(),
    }

    result = await users_collection.insert_one(user_doc)
    user_id = str(result.inserted_id)

    token = create_access_token(user_id, user.username)

    return {
        "token": token,
        "user": {
            "id": user_id,
            "username": user.username,
            "email": user.email,
            "avatar": "",
            "about": "Hey there! I am using Conversa.",
        },
    }


@router.post("/login")
async def login(user: UserLogin):
    db_user = await users_collection.find_one({"email": user.email})
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # If user signed up via Google, they don't have a password
    if db_user.get("auth_provider") == "google" and not db_user.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account uses Google Sign-In. Please use the Google button.",
        )

    if not verify_password(user.password, db_user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user_id = str(db_user["_id"])
    token = create_access_token(user_id, db_user["username"])

    return {
        "token": token,
        "user": {
            "id": user_id,
            "username": db_user["username"],
            "email": db_user["email"],
            "avatar": db_user.get("avatar", ""),
            "about": db_user.get("about", "Hey there! I am using Conversa."),
        },
    }


@router.post("/google")
async def google_auth(data: GoogleAuthRequest):
    """Authenticate with Google ID token. Creates account on first login."""
    from google.oauth2 import id_token
    from google.auth.transport import requests

    try:
        # Verify the Google ID token
        idinfo = id_token.verify_oauth2_token(
            data.credential,
            requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )

        email = idinfo.get("email")
        name = idinfo.get("name", "")
        picture = idinfo.get("picture", "")
        google_id = idinfo.get("sub")

        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
        )

    # Check if user already exists
    db_user = await users_collection.find_one({"email": email})

    if db_user:
        # Existing user → log them in, update avatar if needed
        user_id = str(db_user["_id"])
        update_fields = {"last_seen": datetime.utcnow().isoformat()}
        if picture and not db_user.get("avatar"):
            update_fields["avatar"] = picture
        if google_id and not db_user.get("google_id"):
            update_fields["google_id"] = google_id
            update_fields["auth_provider"] = "google"

        from bson import ObjectId
        await users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_fields}
        )

        token = create_access_token(user_id, db_user["username"])
        return {
            "token": token,
            "user": {
                "id": user_id,
                "username": db_user["username"],
                "email": db_user["email"],
                "avatar": db_user.get("avatar", "") or picture,
                "about": db_user.get("about", "Hey there! I am using Conversa."),
            },
        }
    else:
        # New user → create account from Google profile
        # Generate a unique username from the Google name
        base_username = name.replace(" ", "").lower()[:20] if name else email.split("@")[0]
        username = base_username
        counter = 1
        while await users_collection.find_one({"username": username}):
            username = f"{base_username}{counter}"
            counter += 1

        user_doc = {
            "username": username,
            "email": email,
            "password_hash": "",
            "avatar": picture,
            "about": "Hey there! I am using Conversa.",
            "is_online": False,
            "last_seen": None,
            "auth_provider": "google",
            "google_id": google_id,
            "created_at": datetime.utcnow().isoformat(),
        }

        result = await users_collection.insert_one(user_doc)
        user_id = str(result.inserted_id)

        token = create_access_token(user_id, username)

        return {
            "token": token,
            "user": {
                "id": user_id,
                "username": username,
                "email": email,
                "avatar": picture,
                "about": "Hey there! I am using Conversa.",
            },
        }


@router.get("/google-client-id")
async def get_google_client_id():
    """Return the Google Client ID for the frontend."""
    return {"client_id": settings.GOOGLE_CLIENT_ID}

