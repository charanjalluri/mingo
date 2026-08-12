import React from 'react';
import { ArrowDown } from 'lucide-react';

interface NewMessagesBadgeProps {
  unreadCount?: number;
  onClick: () => void;
}

export const NewMessagesBadge: React.FC<NewMessagesBadgeProps> = ({ unreadCount = 0, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="press-scale-sm"
      style={{
        position: 'absolute',
        bottom: '80px',
        right: '24px',
        padding: '8px 14px',
        borderRadius: '9999px',
        backgroundColor: 'var(--accent-primary)',
        color: '#ffffff',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.82rem',
        fontWeight: 600,
        zIndex: 20,
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <span>{unreadCount > 0 ? `${unreadCount} new message${unreadCount > 1 ? 's' : ''}` : 'New messages'}</span>
      <ArrowDown size={16} />
    </button>
  );
};
