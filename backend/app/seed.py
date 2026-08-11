from __future__ import annotations
import asyncio
from datetime import datetime, timedelta
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker, engine, Base
from app.models import User, Conversation, ConversationParticipant, Message
from app.security import get_password_hash

USERS_SEED = [
    {
        "username": "charan",
        "display_name": "Charan",
        "password": "mg-charan-8921",
        "bio": "Lead Developer & System Architect",
        "avatar_url": "https://api.dicebear.com/7.x/bottts/svg?seed=Charan"
    },
    {
        "username": "ravi",
        "display_name": "Ravi",
        "password": "mg-ravi-4712",
        "bio": "Senior Infrastructure Engineer",
        "avatar_url": "https://api.dicebear.com/7.x/bottts/svg?seed=Ravi"
    },
    {
        "username": "bheem",
        "display_name": "Bheem",
        "password": "mg-bheem-3158",
        "bio": "Product Lead & Strategy",
        "avatar_url": "https://api.dicebear.com/7.x/bottts/svg?seed=Bheem"
    },
    {
        "username": "kausik",
        "display_name": "Kausik",
        "password": "mg-kausik-9043",
        "bio": "Principal UI/UX Designer",
        "avatar_url": "https://api.dicebear.com/7.x/bottts/svg?seed=Kausik"
    },
    {
        "username": "jack",
        "display_name": "Jack",
        "password": "mg-jack-6287",
        "bio": "Security & Cryptography Specialist",
        "avatar_url": "https://api.dicebear.com/7.x/bottts/svg?seed=Jack"
    }
]

async def seed_db(session: AsyncSession):
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    db_users = {}
    for idx, u_data in enumerate(USERS_SEED):
        stmt = select(User).where(User.username == u_data["username"])
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()

        if user:
            user.display_name = u_data["display_name"]
            user.hashed_password = get_password_hash(u_data["password"])
            user.bio = u_data["bio"]
            user.avatar_url = u_data["avatar_url"]
        else:
            user = User(
                username=u_data["username"],
                display_name=u_data["display_name"],
                hashed_password=get_password_hash(u_data["password"]),
                bio=u_data["bio"],
                avatar_url=u_data["avatar_url"],
                is_online=(idx == 0),
                last_seen=datetime.utcnow()
            )
            session.add(user)
        db_users[u_data["username"]] = user

    await session.commit()
    for user in db_users.values():
        await session.refresh(user)

    # 1. Check/Create Mingo Squad group conversation
    stmt_conv = select(Conversation).where(Conversation.type == "group")
    res_conv = await session.execute(stmt_conv)
    squad_group = res_conv.scalar_one_or_none()

    if not squad_group:
        squad_group = Conversation(
            type="group",
            name="Mingo Squad",
            avatar_url="https://api.dicebear.com/7.x/shapes/svg?seed=MingoSquad",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(squad_group)
        await session.commit()
        await session.refresh(squad_group)
    elif squad_group.name == "FourChat Squad":
        squad_group.name = "Mingo Squad"
        squad_group.avatar_url = "https://api.dicebear.com/7.x/shapes/svg?seed=MingoSquad"
        await session.commit()

    for user in db_users.values():
        part_stmt = select(ConversationParticipant).where(
            and_(
                ConversationParticipant.conversation_id == squad_group.id,
                ConversationParticipant.user_id == user.id
            )
        )
        part_res = await session.execute(part_stmt)
        if not part_res.scalar_one_or_none():
            part = ConversationParticipant(
                conversation_id=squad_group.id,
                user_id=user.id
            )
            session.add(part)

    # 2. Ensure 1-on-1 Direct Conversations for all user pairs
    user_list = list(db_users.values())
    for i in range(len(user_list)):
        for j in range(i + 1, len(user_list)):
            u1, u2 = user_list[i], user_list[j]
            
            check_stmt = (
                select(Conversation.id)
                .join(ConversationParticipant)
                .where(
                    and_(
                        Conversation.type == "direct",
                        ConversationParticipant.user_id.in_([u1.id, u2.id])
                    )
                )
                .group_by(Conversation.id)
                .having(func.count(ConversationParticipant.user_id) == 2)
            )
            check_res = await session.execute(check_stmt)
            existing_id = check_res.scalar_one_or_none()

            if not existing_id:
                direct_conv = Conversation(
                    type="direct",
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                session.add(direct_conv)
                await session.commit()
                await session.refresh(direct_conv)

                p1 = ConversationParticipant(conversation_id=direct_conv.id, user_id=u1.id)
                p2 = ConversationParticipant(conversation_id=direct_conv.id, user_id=u2.id)
                session.add_all([p1, p2])

    # 3. Add seed messages to Mingo Squad if no messages exist yet
    msg_check = select(func.count(Message.id)).where(Message.conversation_id == squad_group.id)
    msg_count_res = await session.execute(msg_check)
    if (msg_count_res.scalar_one() or 0) == 0:
        charan = db_users["charan"]
        kausik = db_users["kausik"]
        ravi = db_users["ravi"]
        bheem = db_users["bheem"]
        jack = db_users["jack"]

        seed_messages = [
            (charan, "Welcome to Mingo, squad! 🚀 Hardened for real private use by our squad."),
            (kausik, "The UI design tokens look incredible. Smooth transitions and clean dark mode! ✨"),
            (ravi, "Backend is running WebSocket connections with instant latency. Ready for scale!"),
            (bheem, "Everything on the product roadmap is checked off: voice notes, reactions, replies, and lightboxes."),
            (jack, "Encrypted sessions, sanitized uploads, and strict IDOR protection verified. 🔒")
        ]

        base_time = datetime.utcnow() - timedelta(minutes=15)
        for index, (sender, content) in enumerate(seed_messages):
            msg = Message(
                conversation_id=squad_group.id,
                sender_id=sender.id,
                content=content,
                message_type="text",
                created_at=base_time + timedelta(minutes=index * 2),
                updated_at=base_time + timedelta(minutes=index * 2)
            )
            session.add(msg)

    await session.commit()

async def run_seed():
    async with async_session_maker() as session:
        await seed_db(session)

if __name__ == "__main__":
    asyncio.run(run_seed())
