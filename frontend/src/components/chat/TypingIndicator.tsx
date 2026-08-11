import React from 'react';

export const TypingIndicator: React.FC<{ userNames: string[] }> = ({ userNames }) => {
  if (userNames.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      margin: '4px 0',
      width: 'fit-content',
      borderRadius: 'var(--radius-lg)',
      backgroundColor: 'var(--bg-bubble-other)',
      border: '1px solid var(--border-subtle)'
    }}>
      <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        {userNames.join(', ')} is typing...
      </span>
    </div>
  );
};
