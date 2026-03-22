import motor.motor_asyncio
from app.config import settings

client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGODB_URL)
db = client[settings.DATABASE_NAME]

# Collections
users_collection = db["users"]
chats_collection = db["chats"]
messages_collection = db["messages"]


async def create_indexes():
    """Create database indexes on startup."""
    await users_collection.create_index("email", unique=True)
    await users_collection.create_index("username", unique=True)
    await chats_collection.create_index("participants")
    await chats_collection.create_index("updated_at")
    await messages_collection.create_index("chat_id")
    await messages_collection.create_index("created_at")
