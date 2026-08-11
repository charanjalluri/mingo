import React from 'react';
import { Conversation } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Users, Phone, Video, Search } from 'lucide-react';

interface ChatHeaderProps {
  conversation: Conversation;
  typingUserNames: string[];
  onBackMobile?: () => void;
  onToggleSearch: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversation,
  typingUserNames,
  onBackMobile,
  onToggleSearch
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

  let statusText = '';
  if (typingUserNames.length > 0) {
    statusText = `${typingUserNames.join(', ')} typing...`;
  } else if (isGroup) {
    statusText = `${conversation.participants.length} squad members`;
  } else {
    statusText = isOnline ? 'Online' : 'Offline';
  }

  return (
    <div style={{
      height: '64px',
      padding: '0 16px',
      backgroundColor: 'var(--bg-card)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      zIndex: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {onBackMobile && (
          <button
            onClick={onBackMobile}
            style={{ padding: '6px', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}
          >
            <ArrowLeft size={22} />
          </button>
        )}

        <div style={{ position: 'relative', flexShrink: 0 }}>
          {isGroup ? (
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <Users size={20} />
            </div>
          ) : (
            <img
              src={avatarUrl}
              alt={displayName || 'Avatar'}
              style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
            />
          )}

          {!isGroup && (
            <span style={{
              position: 'absolute',
              bottom: '1px',
              right: '1px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: isOnline ? '#22c55e' : '#64748b',
              border: '2px solid var(--bg-card)'
            }} />
          )}
        </div>

        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {displayName}
          </h2>
          <span style={{
            fontSize: '0.75rem',
            color: typingUserNames.length > 0 ? 'var(--accent-primary)' : isOnline ? '#22c55e' : 'var(--text-muted)',
            fontWeight: typingUserNames.length > 0 || isOnline ? 600 : 400
          }}>
            {statusText}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onToggleSearch}
          style={{ padding: '8px', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}
          title="Search messages"
        >
          <Search size={19} />
        </button>
      </div>
    </div>
  );
};
