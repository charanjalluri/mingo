from __future__ import annotations
import os
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query, Request, status
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db, engine, Base
from app.seed import run_seed
from app.deps import get_current_user_ws
from app.websocket.connection_manager import manager
from app.websocket.handlers import handle_websocket_message
from app.routers import auth, users, conversations, messages, uploads

logger = logging.getLogger("mingo.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist & seed DB
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await run_seed()
    yield
    # Shutdown

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=None, # Disable public Swagger/OpenAPI docs for private app
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https://api.dicebear.com blob:; "
        "media-src 'self' blob:; "
        "connect-src 'self' ws: wss:;"
    )
    return response

# Global Exception Handler to Mask 500 Stack Traces
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred."}
    )

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Static Files for Uploads
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include REST Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(conversations.router, prefix=settings.API_V1_STR)
app.include_router(messages.router, prefix=settings.API_V1_STR)
app.include_router(uploads.router, prefix=settings.API_V1_STR)

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="static_assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str = ""):
        if full_path.startswith("api") or full_path.startswith("uploads") or full_path == "ws":
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        if full_path == "" and "text/html" not in request.headers.get("accept", ""):
            return {"message": "Mingo API is online", "status": "ok"}
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    @app.get("/")
    async def root():
        return {"message": "Mingo API is online", "status": "ok"}

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db)
):
    user = await get_current_user_ws(websocket, db, token)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    connected = await manager.connect(websocket, user.id)
    if not connected:
        return

    # Mark user online
    user.is_online = True
    user.last_seen = datetime.utcnow()
    await db.commit()

    # Broadcast online status
    await manager.broadcast_all({
        "type": "user_presence",
        "payload": {
            "user_id": user.id,
            "is_online": True,
            "last_seen": user.last_seen.isoformat()
        }
    })

    try:
        while True:
            data = await websocket.receive_text()
            await handle_websocket_message(user, data, db)
    except WebSocketDisconnect:
        manager.disconnect(websocket, user.id)
        if not manager.is_user_online(user.id):
            user.is_online = False
            user.last_seen = datetime.utcnow()
            await db.commit()
            await manager.broadcast_all({
                "type": "user_presence",
                "payload": {
                    "user_id": user.id,
                    "is_online": False,
                    "last_seen": user.last_seen.isoformat()
                }
            })
    except Exception as e:
        logger.error(f"WebSocket error for user {user.id}: {e}")
        manager.disconnect(websocket, user.id)
