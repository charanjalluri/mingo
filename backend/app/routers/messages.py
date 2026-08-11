from __future__ import annotations
from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.database import get_db
from app.models import User, Conversation, ConversationParticipant, Message, Reaction
from app.schemas import MessagePublic, MessageCreate, MessageEdit, ReactionToggle, ReactionPublic
from app.deps import get_current_user
from app.routers.conversations import build_message_public
from app.websocket.connection_manager import manager

router = APIRouter(prefix="/messages", tags=["Messages"])

async def check_user_in_conversation(user_id: str, conversation_id: str, db: AsyncSession):
    stmt = select(ConversationParticipant).where(
        and_(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id
        )
    )
    res = await db.execute(stmt)
    if not res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied to conversation")

async def get_participant_user_ids(conversation_id: str, db: AsyncSession) -> List[str]:
    stmt = select(ConversationParticipant.user_id).where(
        ConversationParticipant.conversation_id == conversation_id
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("", response_model=List[MessagePublic])
async def get_messages(
    conversation_id: str = Query(...),
    limit: int = Query(default=50, le=100),
    before_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await check_user_in_conversation(current_user.id, conversation_id, db)

    query = select(Message).where(Message.conversation_id == conversation_id)

    if before_id:
        # get creation time of before_id
        ref_stmt = select(Message.created_at).where(Message.id == before_id)
        ref_res = await db.execute(ref_stmt)
        ref_time = ref_res.scalar_one_or_none()
        if ref_time:
            query = query.where(Message.created_at < ref_time)

    query = query.order_by(Message.created_at.desc()).limit(limit)
    res = await db.execute(query)
    messages = list(res.scalars().all())

    # Return in chronological order
    messages.reverse()

    result = []
    for msg in messages:
        pub_msg = await build_message_public(msg, db)
        result.append(pub_msg)

    return result


@router.get("/search", response_model=List[MessagePublic])
async def search_messages(
    q: str = Query(..., min_length=1),
    conversation_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Find all conversations for user
    conv_stmt = select(ConversationParticipant.conversation_id).where(
        ConversationParticipant.user_id == current_user.id
    )
    conv_res = await db.execute(conv_stmt)
    allowed_conv_ids = conv_res.scalars().all()

    if conversation_id:
        if conversation_id not in allowed_conv_ids:
            raise HTTPException(status_code=403, detail="Access denied")
        target_conv_ids = [conversation_id]
    else:
        target_conv_ids = allowed_conv_ids

    if not target_conv_ids:
        return []

    stmt = (
        select(Message)
        .where(
            and_(
                Message.conversation_id.in_(target_conv_ids),
                Message.content.ilike(f"%{q.strip()}%"),
                Message.is_deleted == False
            )
        )
        .order_by(Message.created_at.desc())
        .limit(30)
    )
    res = await db.execute(stmt)
    matched_msgs = res.scalars().all()

    result = []
    for msg in matched_msgs:
        result.append(await build_message_public(msg, db))

    return result


import logging

logger = logging.getLogger("mingo.messages")

@router.post("", response_model=MessagePublic)
async def create_message(
    body: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await check_user_in_conversation(current_user.id, body.conversation_id, db)
    logger.info(f"message_received(sender_id={current_user.id}, conversation_id={body.conversation_id})")

    if not body.content and not body.media_url:
        raise HTTPException(status_code=400, detail="Message must contain text content or media")

    new_msg = Message(
        conversation_id=body.conversation_id,
        sender_id=current_user.id,
        content=body.content.strip() if body.content else None,
        message_type=body.message_type,
        media_url=body.media_url,
        media_duration=body.media_duration,
        reply_to_id=body.reply_to_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(new_msg)

    # Update conversation updated_at
    conv_stmt = select(Conversation).where(Conversation.id == body.conversation_id)
    conv_res = await db.execute(conv_stmt)
    conv = conv_res.scalar_one()
    conv.updated_at = datetime.utcnow()

    # Update current user participant last_read_message_id
    p_stmt = select(ConversationParticipant).where(
        and_(
            ConversationParticipant.conversation_id == body.conversation_id,
            ConversationParticipant.user_id == current_user.id
        )
    )
    p_res = await db.execute(p_stmt)
    part = p_res.scalar_one_or_none()
    if part:
        part.last_read_message_id = new_msg.id

    await db.commit()
    await db.refresh(new_msg)
    logger.info(f"message_persisted(message_id={new_msg.id})")

    pub_msg = await build_message_public(new_msg, db)

    # Broadcast via WebSocket to all conversation participants
    participant_user_ids = await get_participant_user_ids(body.conversation_id, db)
    await manager.broadcast_to_users(
        {
            "type": "new_message",
            "payload": pub_msg.model_dump(mode="json")
        },
        participant_user_ids,
        sender_id=current_user.id,
        conversation_id=body.conversation_id
    )

    return pub_msg


@router.put("/{message_id}", response_model=MessagePublic)
async def edit_message(
    message_id: str,
    body: MessageEdit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Message).where(Message.id == message_id)
    res = await db.execute(stmt)
    msg = res.scalar_one_or_none()

    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot edit someone else's message")
    if msg.is_deleted:
        raise HTTPException(status_code=400, detail="Cannot edit a deleted message")

    msg.content = body.content.strip()
    msg.is_edited = True
    msg.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(msg)

    pub_msg = await build_message_public(msg, db)

    participant_user_ids = await get_participant_user_ids(msg.conversation_id, db)
    await manager.broadcast_to_users(
        {
            "type": "message_updated",
            "payload": pub_msg.model_dump(mode="json")
        },
        participant_user_ids,
        sender_id=current_user.id,
        conversation_id=msg.conversation_id
    )

    return pub_msg


@router.delete("/{message_id}")
async def delete_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Message).where(Message.id == message_id)
    res = await db.execute(stmt)
    msg = res.scalar_one_or_none()

    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot delete someone else's message")

    msg.is_deleted = True
    msg.content = None
    msg.media_url = None
    msg.updated_at = datetime.utcnow()

    await db.commit()

    participant_user_ids = await get_participant_user_ids(msg.conversation_id, db)
    await manager.broadcast_to_users(
        {
            "type": "message_deleted",
            "payload": {
                "message_id": message_id,
                "conversation_id": msg.conversation_id
            }
        },
        participant_user_ids,
        sender_id=current_user.id,
        conversation_id=msg.conversation_id
    )

    return {"detail": "Message deleted"}


@router.post("/{message_id}/reactions")
async def toggle_reaction(
    message_id: str,
    body: ReactionToggle,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Message).where(Message.id == message_id)
    res = await db.execute(stmt)
    msg = res.scalar_one_or_none()

    if not msg or msg.is_deleted:
        raise HTTPException(status_code=404, detail="Message not found")

    await check_user_in_conversation(current_user.id, msg.conversation_id, db)

    # Check if user already added this exact emoji reaction
    r_stmt = select(Reaction).where(
        and_(
            Reaction.message_id == message_id,
            Reaction.user_id == current_user.id,
            Reaction.emoji == body.emoji
        )
    )
    r_res = await db.execute(r_stmt)
    existing_r = r_res.scalar_one_or_none()

    if existing_r:
        await db.delete(existing_r)
    else:
        new_r = Reaction(
            message_id=message_id,
            user_id=current_user.id,
            emoji=body.emoji,
            created_at=datetime.utcnow()
        )
        db.add(new_r)

    await db.commit()

    pub_msg = await build_message_public(msg, db)

    participant_user_ids = await get_participant_user_ids(msg.conversation_id, db)
    await manager.broadcast_to_users(
        {
            "type": "reaction_updated",
            "payload": {
                "message_id": message_id,
                "conversation_id": msg.conversation_id,
                "reactions": [r.model_dump(mode="json") for r in pub_msg.reactions]
            }
        },
        participant_user_ids,
        sender_id=current_user.id,
        conversation_id=msg.conversation_id
    )

    return {"reactions": pub_msg.reactions}
