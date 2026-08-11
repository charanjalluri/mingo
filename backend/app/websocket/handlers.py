from __future__ import annotations
import json
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.websocket.connection_manager import manager
from app.models import ConversationParticipant, User

async def handle_websocket_message(user: User, data_str: str, db: AsyncSession):
    try:
        data = json.loads(data_str)
    except Exception:
        return

    event_type = data.get("type")
    payload = data.get("payload", {})

    if event_type in ["typing_start", "typing_stop"]:
        conversation_id = payload.get("conversation_id")
        if not conversation_id:
            return
        
        # Verify user is a participant of conversation_id
        stmt = select(ConversationParticipant.user_id).where(
            ConversationParticipant.conversation_id == conversation_id
        )
        res = await db.execute(stmt)
        participant_user_ids = res.scalars().all()
        if user.id not in participant_user_ids:
            return

        # Broadcast typing status to all other participants
        other_user_ids = [uid for uid in participant_user_ids if uid != user.id]
        await manager.broadcast_to_users({
            "type": "typing_status",
            "payload": {
                "conversation_id": conversation_id,
                "user_id": user.id,
                "user_display_name": user.display_name,
                "is_typing": (event_type == "typing_start")
            }
        }, other_user_ids)

    elif event_type == "presence_ping":
        user.last_seen = datetime.utcnow()
        user.is_online = True
        await db.commit()

        await manager.broadcast_all({
            "type": "user_presence",
            "payload": {
                "user_id": user.id,
                "is_online": True,
                "last_seen": user.last_seen.isoformat()
            }
        })
