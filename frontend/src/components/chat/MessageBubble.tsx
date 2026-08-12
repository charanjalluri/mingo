import React, { useState } from 'react';
import { Message } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { formatTime } from '../../utils/dateUtils';
import { AudioPlayer } from '../media/AudioPlayer';
import { Check, CheckCheck, Smile, CornerUpLeft, Edit2, Trash2, Copy } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isGroup: boolean;
  sequencePosition?: 'single' | 'first' | 'middle' | 'last';
  onReply: (msg: Message) => void;
  onReaction: (msgId: string, emoji: string) => void;
  onEdit: (msg: Message) => void;
  onDelete: (msgId: string) => void;
  onOpenImage: (url: string) => void;
}

const QUICK_EMOJIS = ['❤️', '👍', '😂', '🔥', '🎉', '🚀'];

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isGroup,
  sequencePosition = 'single',
  onReply,
  onReaction,
  onEdit,
  onDelete,
  onOpenImage
}) => {
  const { user: currentUser } = useAuth();
  const isSelf = message.sender_id === currentUser?.id;
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
    }
  };

  // Determine border radii based on sequence position and sender
  const getBorderRadius = () => {
    if (isSelf) {
      switch (sequencePosition) {
        case 'first':
          return '18px 18px 6px 18px';
        case 'middle':
          return '18px 6px 6px 18px';
        case 'last':
          return '18px 6px 4px 18px';
        case 'single':
        default:
          return '18px 18px 4px 18px';
      }
    } else {
      switch (sequencePosition) {
        case 'first':
          return '18px 18px 18px 6px';
        case 'middle':
          return '6px 18px 18px 6px';
        case 'last':
          return '6px 18px 18px 4px';
        case 'single':
        default:
          return '18px 18px 18px 4px';
      }
    }
  };

  const isGroupFirstInSequence = !isSelf && isGroup && (sequencePosition === 'single' || sequencePosition === 'first');
  const marginTop = sequencePosition === 'middle' || sequencePosition === 'last' ? '1px' : '6px';
  const marginBottom = sequencePosition === 'first' || sequencePosition === 'middle' ? '1px' : '6px';

  return (
    <div
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowEmojiPicker(false);
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isSelf ? 'flex-end' : 'flex-start',
        marginTop,
        marginBottom,
        position: 'relative',
        padding: '0 4px'
      }}
    >
      {/* Sender display name for group chat - only on first message of a sequence */}
      {isGroupFirstInSequence && (
        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '3px', marginLeft: '6px' }}>
          {message.sender_display_name}
        </span>
      )}

      {/* Bubble Container */}
      <div style={{
        position: 'relative',
        maxWidth: '82%',
        padding: message.message_type === 'image' ? '4px' : '10px 14px',
        borderRadius: getBorderRadius(),
        backgroundColor: isSelf ? 'var(--bg-bubble-self)' : 'var(--bg-bubble-other)',
        color: isSelf ? 'var(--text-bubble-self)' : 'var(--text-bubble-other)',
        boxShadow: 'var(--shadow-sm)',
        wordBreak: 'break-word',
        border: '1px solid var(--border-subtle)'
      }}>
        {/* Reply Quote Target Header */}
        {message.reply_to && (
          <div style={{
            padding: '6px 10px',
            marginBottom: '6px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isSelf ? 'rgba(255, 255, 255, 0.15)' : 'var(--bg-card)',
            borderLeft: `3px solid ${isSelf ? '#ffffff' : 'var(--accent-primary)'}`,
            fontSize: '0.78rem'
          }}>
            <span style={{ fontWeight: 700, display: 'block', color: isSelf ? '#ffffff' : 'var(--accent-primary)' }}>
              {message.reply_to.sender_display_name}
            </span>
            <p style={{ opacity: 0.88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {message.reply_to.content}
            </p>
          </div>
        )}

        {/* Content rendering */}
        {message.is_deleted ? (
          <span style={{ fontStyle: 'italic', opacity: 0.7, fontSize: '0.88rem' }}>
            This message was deleted
          </span>
        ) : message.message_type === 'image' && message.media_url ? (
          <div>
            <img
              src={message.media_url}
              alt="Shared Attachment"
              role="button"
              tabIndex={0}
              onClick={() => onOpenImage(message.media_url!)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenImage(message.media_url!);
                }
              }}
              className="press-scale-sm"
              style={{
                width: '100%',
                maxHeight: '320px',
                borderRadius: '14px',
                objectFit: 'cover',
                cursor: 'pointer'
              }}
            />
            {message.content && (
              <p style={{ fontSize: '0.92rem', padding: '6px 8px 2px 8px' }}>
                {message.content}
              </p>
            )}
          </div>
        ) : message.message_type === 'voice' && message.media_url ? (
          <AudioPlayer src={message.media_url} duration={message.media_duration} isSelf={isSelf} />
        ) : (
          <p style={{ fontSize: '0.93rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
            {message.content}
          </p>
        )}

        {/* Timestamp & Status Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '4px',
          marginTop: '4px',
          opacity: 0.8,
          fontSize: '0.68rem'
        }}>
          {message.is_edited && !message.is_deleted && <span>edited</span>}
          <span>{formatTime(message.created_at)}</span>
          {isSelf && (
            <CheckCheck size={14} style={{ color: '#ffffff' }} />
          )}
        </div>

        {/* Action Popover Menu (Hover / Long press) */}
        {showActions && !message.is_deleted && (
          <div style={{
            position: 'absolute',
            top: '-36px',
            right: isSelf ? 0 : 'auto',
            left: isSelf ? 'auto' : 0,
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '9999px',
            padding: '4px 8px',
            boxShadow: 'var(--shadow-md)',
            zIndex: 15,
            animation: 'fadeIn 0.15s ease'
          }}>
            <button onClick={() => setShowEmojiPicker((prev) => !prev)} className="interactive-btn" style={{ padding: '4px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }} title="React">
              <Smile size={16} />
            </button>
            <button onClick={() => onReply(message)} className="interactive-btn" style={{ padding: '4px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }} title="Reply">
              <CornerUpLeft size={16} />
            </button>
            {message.content && (
              <button onClick={handleCopy} className="interactive-btn" style={{ padding: '4px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }} title="Copy">
                <Copy size={16} />
              </button>
            )}
            {isSelf && (
              <>
                {message.message_type === 'text' && (
                  <button onClick={() => onEdit(message)} className="interactive-btn" style={{ padding: '4px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }} title="Edit">
                    <Edit2 size={16} />
                  </button>
                )}
                <button onClick={() => onDelete(message.id)} className="interactive-btn" style={{ padding: '4px', borderRadius: 'var(--radius-sm)', color: '#ef4444' }} title="Delete">
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Emoji Quick Picker Popover */}
        {showEmojiPicker && (
          <div style={{
            position: 'absolute',
            top: '-72px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '6px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '9999px',
            padding: '6px 12px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 20,
            animation: 'fadeIn 0.15s ease'
          }}>
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onReaction(message.id, emoji);
                  setShowEmojiPicker(false);
                }}
                className="press-scale-xs"
                style={{ fontSize: '1.2rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', padding: '2px' }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reactions Bar */}
      {message.reactions && message.reactions.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '4px',
          marginTop: '3px',
          alignSelf: isSelf ? 'flex-end' : 'flex-start'
        }}>
          {Object.entries(
            message.reactions.reduce((acc, r) => {
              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          ).map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={() => onReaction(message.id, emoji)}
              className="press-scale-xs interactive-btn"
              style={{
                padding: '2px 6px',
                borderRadius: '9999px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {emoji} {count > 1 ? count : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
