from __future__ import annotations
from fastapi import Depends, HTTPException, status, WebSocket
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.security import decode_access_token
from app.models import User, RevokedToken

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

async def is_token_revoked(token: str, db: AsyncSession) -> bool:
    stmt = select(RevokedToken).where(RevokedToken.token == token)
    res = await db.execute(stmt)
    return res.scalar_one_or_none() is not None

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str | None = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    # Check token revocation
    if await is_token_revoked(token, db):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been logged out",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = decode_access_token(token)
    if user_id is None:
        raise credentials_exception

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user

async def get_current_user_ws(
    websocket: WebSocket,
    db: AsyncSession,
    token: str | None = None
) -> User | None:
    if not token:
        token = websocket.query_params.get("token")
    
    if not token:
        return None

    if await is_token_revoked(token, db):
        return None

    user_id = decode_access_token(token)
    if not user_id:
        return None

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
