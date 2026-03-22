import os


class Settings:
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DATABASE_NAME: str = "whatsapp_clone"
    JWT_SECRET: str = os.getenv("JWT_SECRET", "whatsapp-clone-super-secret-key-2024")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 72
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "766327358056-unt21h5jueocdftbs6kfhristau3lhps.apps.googleusercontent.com")
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    ALLOWED_ORIGINS: list = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]


settings = Settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
