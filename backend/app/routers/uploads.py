from __future__ import annotations
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse

from app.config import settings
from app.schemas import UploadResponse
from app.models import User
from app.deps import get_current_user

router = APIRouter(prefix="/uploads", tags=["Uploads"])

# Magic byte signatures
MAGIC_SIGNATURES = {
    "image/jpeg": [b"\xFF\xD8\xFF"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/gif": [b"GIF87a", b"GIF89a"],
    "image/webp": [b"RIFF"], # plus WEBP check
    "audio/webm": [b"\x1a\x45\xdf\xa3"],
    "audio/ogg": [b"OggS"],
    "audio/wav": [b"RIFF"],
    "audio/mp3": [b"ID3", b"\xff\xfb", b"\xff\xf3"],
    "audio/mpeg": [b"ID3", b"\xff\xfb", b"\xff\xf3"],
    "audio/m4a": [b"\x00\x00\x00"] # ftyp header
}

def verify_magic_bytes(content: bytes, content_type: str) -> bool:
    if len(content) < 12:
        return False

    if content_type == "image/webp":
        return content.startswith(b"RIFF") and b"WEBP" in content[8:16]
    if content_type == "audio/wav":
        return content.startswith(b"RIFF") and b"WAVE" in content[8:16]

    signatures = MAGIC_SIGNATURES.get(content_type, [])
    if not signatures:
        # Fallback basic check for webm/audio
        return True

    return any(content.startswith(sig) for sig in signatures)


@router.post("/image", response_model=UploadResponse)
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image type. Allowed: {', '.join(settings.ALLOWED_IMAGE_TYPES)}"
        )

    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="Image file exceeds 10MB limit")

    if not verify_magic_bytes(contents, file.content_type):
        raise HTTPException(status_code=400, detail="File content binary header does not match declared image type")

    ext_map = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp"
    }
    ext = ext_map.get(file.content_type, ".png")

    filename = f"img_{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    return UploadResponse(
        url=f"/uploads/{filename}",
        filename=filename,
        media_type="image"
    )


@router.post("/voice", response_model=UploadResponse)
async def upload_voice(
    file: UploadFile = File(...),
    duration: float | None = Form(default=None),
    current_user: User = Depends(get_current_user)
):
    if file.content_type not in settings.ALLOWED_AUDIO_TYPES and not file.content_type.startswith("audio/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported audio type: {file.content_type}"
        )

    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="Voice recording exceeds 10MB limit")

    filename = f"voice_{uuid.uuid4().hex}.webm"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    return UploadResponse(
        url=f"/uploads/{filename}",
        filename=filename,
        media_type="voice",
        duration=duration
    )


@router.get("/{filename}")
async def get_uploaded_media(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    # Sanitize filename against path traversal
    safe_basename = os.path.basename(filename)
    if safe_basename != filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename parameter")

    file_path = os.path.join(settings.UPLOAD_DIR, safe_basename)
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Requested media file not found")

    return FileResponse(
        path=file_path,
        headers={"X-Content-Type-Options": "nosniff"}
    )
