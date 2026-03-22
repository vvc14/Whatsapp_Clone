import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from app.config import settings
from app.database import create_indexes
from app.routes import auth, users, chats, messages, upload
from app.socketio_server import sio


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await create_indexes()
    print("✅ MongoDB indexes created")
    print("✅ Conversa API is running!")
    yield
    # Shutdown
    print("👋 Shutting down...")


app = FastAPI(
    title="Conversa API",
    description="Full-stack real-time messaging backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploads
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(chats.router)
app.include_router(messages.router)
app.include_router(upload.router)


@app.get("/")
async def root():
    return {"message": "Conversa API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}


# Wrap FastAPI app with Socket.IO
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
