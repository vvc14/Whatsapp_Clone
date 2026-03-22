import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.auth.jwt import get_current_user
from app.config import settings

router = APIRouter(prefix="/api/upload", tags=["Upload"])

ALLOWED_EXTENSIONS = {
    "image": [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    "file": [".pdf", ".doc", ".docx", ".txt", ".zip", ".rar"],
    "audio": [".mp3", ".wav", ".ogg", ".m4a", ".webm"],
}


@router.post("")
async def upload_file(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = os.path.splitext(file.filename)[1].lower()
    all_allowed = []
    file_type = "file"
    for ftype, exts in ALLOWED_EXTENSIONS.items():
        all_allowed.extend(exts)
        if ext in exts:
            file_type = ftype

    if ext not in all_allowed:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

    # Generate unique filename
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_name)

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")
        await f.write(content)

    file_url = f"/uploads/{unique_name}"

    return {
        "url": file_url,
        "type": file_type,
        "filename": file.filename,
        "size": len(content),
    }
