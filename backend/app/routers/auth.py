from __future__ import annotations
import time
from typing import List, Dict, Tuple
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, RevokedToken
from app.schemas import Token, LoginRequest, UserPublic, UserProfileUpdate, ChangePasswordRequest
from app.security import verify_password, get_password_hash, create_access_token
from app.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])

# In-memory sliding window rate limiter for login brute force prevention
# key: (client_ip, username) -> list of timestamp floats
login_attempts: Dict[Tuple[str, str], List[float]] = {}
MAX_LOGIN_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 60.0

def check_login_rate_limit(client_ip: str, username: str):
    now = time.time()
    key = (client_ip, username)
    attempts = login_attempts.get(key, [])
    # Filter attempts within window
    valid_attempts = [t for t in attempts if now - t < LOGIN_WINDOW_SECONDS]
    login_attempts[key] = valid_attempts

    if len(valid_attempts) >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please wait 60 seconds before trying again."
        )

def record_failed_login(client_ip: str, username: str):
    now = time.time()
    key = (client_ip, username)
    login_attempts.setdefault(key, []).append(now)

@router.get("/users", response_model=List[UserPublic])
async def get_authorized_users(db: AsyncSession = Depends(get_db)):
    """Returns list of authorized 4 users for quick local switcher and directory."""
    stmt = select(User).order_by(User.username)
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/login", response_model=Token)
async def login(
    req: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    client_ip = request.client.host if request.client else "127.0.0.1"
    clean_username = req.username.lower().strip()

    check_login_rate_limit(client_ip, clean_username)

    stmt = select(User).where(User.username == clean_username)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        record_failed_login(client_ip, clean_username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or access key",
        )

    user.is_online = True
    user.last_seen = datetime.utcnow()
    await db.commit()
    await db.refresh(user)

    token = create_access_token(subject=user.id)

    # Set secure HTTP-only cookie
    response.set_cookie(
        key="mingo_session",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False, # Set True in HTTPS production
        max_age=60 * 60 * 24 * 7
    )

    return Token(access_token=token, user=UserPublic.model_validate(user))

@router.post("/logout")
async def logout(
    authorization: str | None = Header(default=None),
    current_user: User = Depends(get_current_user),
    response: Response = Response(),
    db: AsyncSession = Depends(get_db)
):
    # Extract token
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]

    if token:
        revoked = RevokedToken(token=token, revoked_at=datetime.utcnow())
        db.add(revoked)
        await db.commit()

    current_user.is_online = False
    current_user.last_seen = datetime.utcnow()
    await db.commit()

    response.delete_cookie(key="mingo_session")
    return {"detail": "Logged out and session invalidated"}

@router.get("/me", response_model=UserPublic)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/profile", response_model=UserPublic)
async def update_profile(
    body: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if body.display_name is not None:
        current_user.display_name = body.display_name.strip()
    if body.bio is not None:
        current_user.bio = body.bio.strip()
    if body.avatar_url is not None:
        current_user.avatar_url = body.avatar_url.strip()

    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not verify_password(body.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password/key is incorrect")

    current_user.hashed_password = get_password_hash(body.new_password)
    await db.commit()
    return {"detail": "Password updated successfully"}

# Explicitly block public registration endpoints
@router.post("/register", status_code=405)
@router.post("/signup", status_code=405)
async def register_disabled():
    raise HTTPException(status_code=405, detail="Public registration is disabled. System is restricted to 4 authorized accounts.")
