import React from 'react';
import { Message } from '../../types';
import { X, CornerUpLeft } from 'lucide-react';

interface ReplyPreviewProps {
  message: Message;
  onCancel: () => void;
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({ message, onCancel }) => {
  return (
    <div style={{
      padding: '8px 14px',
      backgroundColor: 'var(--bg-card)',
      borderTop: '1px solid var(--border-subtle)',
      borderLeft: '4px solid var(--accent-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
        <CornerUpLeft size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <div style={{ overflow: 'hidden' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-primary)', display: 'block' }}>
            Replying to {message.sender_display_name}
          </span>
          <p style={{
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {message.message_type === 'image' ? '📷 Photo' : message.message_type === 'voice' ? '🎤 Voice note' : message.content}
          </p>
        </div>
      </div>

      <button
        onClick={onCancel}
        className="interactive-btn press-scale-sm"
        style={{ padding: '4px', color: 'var(--text-muted)', borderRadius: '50%' }}
        title="Cancel reply"
      >
        <X size={16} />
      </button>
    </div>
  );
};
