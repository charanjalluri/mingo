import React from 'react';
import { Conversation } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { formatTime } from '../../utils/dateUtils';
import { Users } from 'lucide-react';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onSelect
}) => {
  const { user: currentUser } = useAuth();

  const isGroup = conversation.type === 'group';
  const otherParticipant = conversation.participants.find((p) => p.user_id !== currentUser?.id);
  const isOnline = isGroup ? false : otherParticipant?.is_online;

  const displayName = isGroup
    ? conversation.name
    : otherParticipant?.display_name || 'Direct Chat';

  const avatarUrl = isGroup
    ? conversation.avatar_url || 'https://api.dicebear.com/7.x/shapes/svg?seed=Squad'
    : otherParticipant?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${displayName}`;

  const lastMsg = conversation.last_message;
  let lastMsgPreview = 'No messages yet';
  if (lastMsg) {
    if (lastMsg.is_deleted) {
      lastMsgPreview = 'Message deleted';
    } else if (lastMsg.message_type === 'image') {
      lastMsgPreview = '📷 Photo';
    } else if (lastMsg.message_type === 'voice') {
      lastMsgPreview = '🎤 Voice note';
    } else {
      lastMsgPreview = lastMsg.content || '';
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
        borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: 'pointer',
        userSelect: 'none'
      }}
      className="conversation-item-hover"
    >
      {/* Avatar Container */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {isGroup ? (
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '14px',
            backgroundColor: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}>
            <Users size={22} />
          </div>
        ) : (
          <img
            src={avatarUrl}
            alt={displayName || 'Avatar'}
            style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }}
          />
        )}

        {!isGroup && (
          <span style={{
            position: 'absolute',
            bottom: '1px',
            right: '1px',
            width: '11px',
            height: '11px',
            borderRadius: '50%',
            backgroundColor: isOnline ? '#22c55e' : '#64748b',
            border: '2px solid var(--bg-sidebar)'
          }} />
        )}
      </div>

      {/* Main Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <h3 style={{
            fontSize: '0.92rem',
            fontWeight: conversation.unread_count > 0 ? 700 : 600,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {displayName}
          </h3>
          {lastMsg && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '6px' }}>
              {formatTime(lastMsg.created_at)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{
            fontSize: '0.82rem',
            color: conversation.unread_count > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: conversation.unread_count > 0 ? 600 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '180px'
          }}>
            {lastMsg && isGroup && lastMsg.sender_display_name && !lastMsg.is_deleted && (
              <span style={{ fontWeight: 600 }}>{lastMsg.sender_display_name.split(' ')[0]}: </span>
            )}
            {lastMsgPreview}
          </p>

          {conversation.unread_count > 0 && (
            <span style={{
              padding: '2px 7px',
              borderRadius: '9999px',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 700,
              marginLeft: '6px',
              flexShrink: 0
            }}>
              {conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
