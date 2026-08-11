from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserPublic"

class TokenPayload(BaseModel):
    sub: str | None = None

# User schemas
class LoginRequest(BaseModel):
    username: str
    password: str

class UserPublic(BaseModel):
    id: str
    username: str
    display_name: str
    avatar_url: str | None = None
    bio: str | None = None
    is_online: bool = False
    last_seen: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    bio: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = Field(default=None, max_length=500)

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=4, max_length=100)

# Reaction schemas
class ReactionPublic(BaseModel):
    id: str
    message_id: str
    user_id: str
    user_display_name: str | None = None
    emoji: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ReactionToggle(BaseModel):
    emoji: str

# Message schemas
class MessageReplyTarget(BaseModel):
    id: str
    sender_id: str
    sender_display_name: str
    content: str | None = None
    message_type: str
    media_url: str | None = None

class MessagePublic(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_username: str
    sender_display_name: str
    sender_avatar_url: str | None = None
    content: str | None = None
    message_type: str  # 'text', 'image', 'voice'
    media_url: str | None = None
    media_duration: float | None = None
    reply_to_id: str | None = None
    reply_to: MessageReplyTarget | None = None
    reactions: list[ReactionPublic] = []
    is_edited: bool = False
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class MessageCreate(BaseModel):
    conversation_id: str
    content: str | None = None
    message_type: str = "text"
    media_url: str | None = None
    media_duration: float | None = None
    reply_to_id: str | None = None

class MessageEdit(BaseModel):
    content: str = Field(min_length=1, max_length=5000)

# Conversation schemas
class ConversationParticipantPublic(BaseModel):
    user_id: str
    username: str
    display_name: str
    avatar_url: str | None = None
    is_online: bool = False
    last_seen: datetime

class ConversationPublic(BaseModel):
    id: str
    type: str  # 'direct' or 'group'
    name: str | None = None
    avatar_url: str | None = None
    unread_count: int = 0
    last_message: MessagePublic | None = None
    participants: list[ConversationParticipantPublic] = []
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Upload schema
class UploadResponse(BaseModel):
    url: str
    filename: str
    media_type: str
    duration: float | None = None
