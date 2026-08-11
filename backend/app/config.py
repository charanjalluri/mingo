from __future__ import annotations
import os
# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Mingo"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "mingo_super_secret_jwt_key_9823471928374918237498"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days session

    PORT: int = 8000
    DATABASE_URL: str = "sqlite+aiosqlite:///./mingo.db"

    # Uploads
    UPLOAD_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10 MB

    ALLOWED_IMAGE_TYPES: list[str] = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    ALLOWED_AUDIO_TYPES: list[str] = ["audio/webm", "audio/ogg", "audio/wav", "audio/mp3", "audio/mpeg", "audio/m4a"]

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        "*"
    ]

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="allow")

settings = Settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
