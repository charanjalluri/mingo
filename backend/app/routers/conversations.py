from __future__ import annotations
from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, Conversation, ConversationParticipant, Message, Reaction
from app.schemas import (
    ConversationPublic, ConversationParticipantPublic, MessagePublic, MessageReplyTarget, ReactionPublic
)
from app.deps import get_current_user
from app.websocket.connection_manager import manager

router = APIRouter(prefix="/conversations", tags=["Conversations"])

async def build_message_public(msg: Message, db: AsyncSession) -> MessagePublic:
    # Fetch sender
    stmt_sender = select(User).where(User.id == msg.sender_id)
    res_sender = await db.execute(stmt_sender)
    sender = res_sender.scalar_one_or_none()

    # Fetch reactions
    stmt_react = select(Reaction).where(Reaction.message_id == msg.id)
    res_react = await db.execute(stmt_react)
    reactions = res_react.scalars().all()
    
    reactions_public = []
    for r in reactions:
        u_stmt = select(User.display_name).where(User.id == r.user_id)
        u_res = await db.execute(u_stmt)
        disp_name = u_res.scalar_one_or_none()
        reactions_public.append(ReactionPublic(
            id=r.id,
            message_id=r.message_id,
            user_id=r.user_id,
            user_display_name=disp_name,
            emoji=r.emoji,
            created_at=r.created_at
        ))

    # Reply target
    reply_target = None
    if msg.reply_to_id:
        stmt_reply = select(Message).where(Message.id == msg.reply_to_id)
        res_reply = await db.execute(stmt_reply)
        rep = res_reply.scalar_one_or_none()
        if rep:
            r_sender_stmt = select(User.display_name).where(User.id == rep.sender_id)
            r_sender_res = await db.execute(r_sender_stmt)
            r_sender_name = r_sender_res.scalar_one_or_none() or "User"
            reply_target = MessageReplyTarget(
                id=rep.id,
                sender_id=rep.sender_id,
                sender_display_name=r_sender_name,
                content=rep.content if not rep.is_deleted else "Message deleted",
                message_type=rep.message_type,
                media_url=rep.media_url
            )

    return MessagePublic(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        sender_username=sender.username if sender else "unknown",
        sender_display_name=sender.display_name if sender else "Unknown",
        sender_avatar_url=sender.avatar_url if sender else None,
        content=msg.content if not msg.is_deleted else "This message was deleted",
        message_type=msg.message_type,
        media_url=msg.media_url if not msg.is_deleted else None,
        media_duration=msg.media_duration,
        reply_to_id=msg.reply_to_id,
        reply_to=reply_target,
        reactions=reactions_public,
        is_edited=msg.is_edited,
        is_deleted=msg.is_deleted,
        created_at=msg.created_at,
        updated_at=msg.updated_at
    )


@router.get("", response_model=List[ConversationPublic])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Find all conversations current user is a participant in
    stmt = (
        select(Conversation)
        .join(ConversationParticipant)
        .where(ConversationParticipant.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
    )
    res = await db.execute(stmt)
    conversations = res.scalars().all()

    result = []
    for conv in conversations:
        # Get participants
        p_stmt = (
            select(User, ConversationParticipant.last_read_message_id)
            .join(ConversationParticipant, ConversationParticipant.user_id == User.id)
            .where(ConversationParticipant.conversation_id == conv.id)
        )
        p_res = await db.execute(p_stmt)
        p_rows = p_res.all()

        participants_public = []
        user_last_read_id = None
        for u, last_read_id in p_rows:
            if u.id == current_user.id:
                user_last_read_id = last_read_id
            
            is_online = manager.is_user_online(u.id) or u.is_online
            participants_public.append(ConversationParticipantPublic(
                user_id=u.id,
                username=u.username,
                display_name=u.display_name,
                avatar_url=u.avatar_url,
                is_online=is_online,
                last_seen=u.last_seen
            ))

        # Get last message
        lm_stmt = (
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        lm_res = await db.execute(lm_stmt)
        last_msg = lm_res.scalar_one_or_none()

        last_msg_public = None
        if last_msg:
            last_msg_public = await build_message_public(last_msg, db)

        # Unread count
        unread_count = 0
        if user_last_read_id:
            # count messages created after user_last_read message
            read_msg_stmt = select(Message.created_at).where(Message.id == user_last_read_id)
            read_msg_res = await db.execute(read_msg_stmt)
            read_time = read_msg_res.scalar_one_or_none()
            if read_time:
                un_stmt = select(func.count(Message.id)).where(
                    and_(
                        Message.conversation_id == conv.id,
                        Message.created_at > read_time,
                        Message.sender_id != current_user.id
                    )
                )
                un_res = await db.execute(un_stmt)
                unread_count = un_res.scalar_one() or 0
        else:
            # count all messages from others
            un_stmt = select(func.count(Message.id)).where(
                and_(
                    Message.conversation_id == conv.id,
                    Message.sender_id != current_user.id
                )
            )
            un_res = await db.execute(un_stmt)
            unread_count = un_res.scalar_one() or 0

        # For direct conversations, dynamic name and avatar based on the other participant
        conv_name = conv.name
        conv_avatar = conv.avatar_url
        if conv.type == "direct":
            other_p = next((p for p in participants_public if p.user_id != current_user.id), None)
            if other_p:
                conv_name = other_p.display_name
                conv_avatar = other_p.avatar_url

        result.append(ConversationPublic(
            id=conv.id,
            type=conv.type,
            name=conv_name,
            avatar_url=conv_avatar,
            unread_count=unread_count,
            last_message=last_msg_public,
            participants=participants_public,
            updated_at=conv.updated_at
        ))

    return result


@router.post("/direct/{target_user_id}", response_model=ConversationPublic)
async def get_or_create_direct_conversation(
    target_user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot start conversation with yourself")

    # Check target user exists
    target_stmt = select(User).where(User.id == target_user_id)
    target_res = await db.execute(target_stmt)
    target_user = target_res.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    # Find existing direct conversation between current_user and target_user
    stmt = (
        select(Conversation.id)
        .join(ConversationParticipant)
        .where(
            and_(
                Conversation.type == "direct",
                ConversationParticipant.user_id.in_([current_user.id, target_user_id])
            )
        )
        .group_by(Conversation.id)
        .having(func.count(ConversationParticipant.user_id) == 2)
    )
    res = await db.execute(stmt)
    existing_id = res.scalar_one_or_none()

    if existing_id:
        conv_stmt = select(Conversation).where(Conversation.id == existing_id)
        conv_res = await db.execute(conv_stmt)
        conv = conv_res.scalar_one()
    else:
        conv = Conversation(type="direct", created_at=datetime.utcnow(), updated_at=datetime.utcnow())
        db.add(conv)
        await db.commit()
        await db.refresh(conv)

        p1 = ConversationParticipant(conversation_id=conv.id, user_id=current_user.id)
        p2 = ConversationParticipant(conversation_id=conv.id, user_id=target_user_id)
        db.add_all([p1, p2])
        await db.commit()

    # Build response
    all_convs = await list_conversations(current_user=current_user, db=db)
    matched = next((c for c in all_convs if c.id == conv.id), None)
    if not matched:
        raise HTTPException(status_code=500, detail="Failed to load direct conversation")
    return matched


@router.post("/{conversation_id}/read")
async def mark_conversation_read(
    conversation_id: str,
    last_message_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check participant
    p_stmt = select(ConversationParticipant).where(
        and_(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id
        )
    )
    p_res = await db.execute(p_stmt)
    participant = p_res.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant of this conversation")

    if not last_message_id:
        # Get latest message in conv
        lm_stmt = select(Message.id).where(Message.conversation_id == conversation_id).order_by(Message.created_at.desc()).limit(1)
        lm_res = await db.execute(lm_stmt)
        last_message_id = lm_res.scalar_one_or_none()

    if last_message_id:
        participant.last_read_message_id = last_message_id
        await db.commit()

        # Notify participants of read status
        all_p_stmt = select(ConversationParticipant.user_id).where(ConversationParticipant.conversation_id == conversation_id)
        all_p_res = await db.execute(all_p_stmt)
        participant_ids = all_p_res.scalars().all()

        await manager.broadcast_to_users({
            "type": "read_receipt_update",
            "payload": {
                "conversation_id": conversation_id,
                "message_id": last_message_id,
                "user_id": current_user.id,
                "read_at": datetime.utcnow().isoformat()
            }
        }, participant_ids)

    return {"detail": "Marked as read"}
