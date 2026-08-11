from __future__ import annotations
import json
import logging
from typing import Dict, Set
from fastapi import WebSocket, status
from app.config import settings

logger = logging.getLogger("mingo.websocket")

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.user_subscriptions: Dict[str, Set[str]] = {}

    def is_origin_allowed(self, origin: str | None) -> bool:
        if not origin:
            return True  # Allow non-browser client connections without origin header
        # Check against allowed CORS origins
        return any(allowed in origin for allowed in settings.BACKEND_CORS_ORIGINS)

    async def connect(self, websocket: WebSocket, user_id: str):
        origin = websocket.headers.get("origin")
        if not self.is_origin_allowed(origin):
            logger.warning(f"Rejected WebSocket connection from unauthorized origin: {origin}")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return False

        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        logger.info(f"User {user_id} connected via WebSocket from origin {origin}.")
        return True

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        if user_id in self.user_subscriptions:
            if user_id not in self.active_connections:
                del self.user_subscriptions[user_id]
        logger.info(f"User {user_id} disconnected from WebSocket.")

    def is_user_online(self, user_id: str) -> bool:
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            data = json.dumps(message, default=str)
            for connection in list(self.active_connections[user_id]):
                try:
                    await connection.send_text(data)
                except Exception as e:
                    logger.error(f"Failed to send to user {user_id}: {e}")

    async def broadcast_to_users(self, message: dict, user_ids: list[str]):
        data = json.dumps(message, default=str)
        for uid in user_ids:
            if uid in self.active_connections:
                for connection in list(self.active_connections[uid]):
                    try:
                        await connection.send_text(data)
                    except Exception as e:
                        logger.error(f"Failed to broadcast to {uid}: {e}")

    async def broadcast_all(self, message: dict):
        data = json.dumps(message, default=str)
        for user_id, connections in self.active_connections.items():
            for connection in list(connections):
                try:
                    await connection.send_text(data)
                except Exception as e:
                    logger.error(f"Failed to broadcast to all: {e}")

manager = ConnectionManager()
