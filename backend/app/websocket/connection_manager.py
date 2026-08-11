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

    def is_origin_allowed(self, origin: str | None, host: str | None = None) -> bool:
        if not origin:
            return True  # Allow non-browser client connections without origin header
        if "*" in settings.BACKEND_CORS_ORIGINS:
            return True
        if host:
            clean_host = host.split(":")[0].lower()
            clean_origin = origin.split("://")[-1].split(":")[0].split("/")[0].lower()
            if clean_host == clean_origin or clean_host == "testserver" or clean_origin == "testserver":
                return True
        return any(allowed in origin for allowed in settings.BACKEND_CORS_ORIGINS if allowed != "*")

    async def connect(self, websocket: WebSocket, user_id: str):
        origin = websocket.headers.get("origin")
        host = websocket.headers.get("host")
        if not self.is_origin_allowed(origin, host):
            logger.warning(f"websocket_rejected(user_id={user_id}, origin={origin}, host={host})")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return False

        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        logger.info(f"websocket_connected(user_id={user_id})")
        return True

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        if user_id in self.user_subscriptions:
            if user_id not in self.active_connections:
                del self.user_subscriptions[user_id]
        logger.info(f"websocket_disconnected(user_id={user_id})")

    def is_user_online(self, user_id: str) -> bool:
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            data = json.dumps(message, default=str)
            for connection in list(self.active_connections[user_id]):
                try:
                    await connection.send_text(data)
                    logger.info(f"websocket_send_success(user_id={user_id})")
                except Exception as e:
                    logger.error(f"websocket_send_failure(user_id={user_id}, error={e})")

    async def broadcast_to_users(self, message: dict, user_ids: list[str], sender_id: str | None = None, conversation_id: str | None = None):
        data = json.dumps(message, default=str)
        for uid in user_ids:
            if uid in self.active_connections:
                logger.info(f"message_broadcast(sender_id={sender_id}, recipient_id={uid}, conversation_id={conversation_id})")
                for connection in list(self.active_connections[uid]):
                    try:
                        await connection.send_text(data)
                        logger.info(f"websocket_send_success(user_id={uid})")
                    except Exception as e:
                        logger.error(f"websocket_send_failure(user_id={uid}, error={e})")
            else:
                logger.debug(f"Recipient user_id={uid} is not connected via WebSocket")

    async def broadcast_all(self, message: dict):
        data = json.dumps(message, default=str)
        for user_id, connections in self.active_connections.items():
            for connection in list(connections):
                try:
                    await connection.send_text(data)
                    logger.info(f"websocket_send_success(user_id={user_id})")
                except Exception as e:
                    logger.error(f"websocket_send_failure(user_id={user_id}, error={e})")

manager = ConnectionManager()
