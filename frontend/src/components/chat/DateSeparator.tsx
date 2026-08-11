import React from 'react';
import { formatDateDivider } from '../../utils/dateUtils';

export const DateSeparator: React.FC<{ isoString: string }> = ({ isoString }) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '16px 0 8px 0',
      userSelect: 'none'
    }}>
      <span style={{
        padding: '4px 12px',
        borderRadius: '9999px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-muted)',
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {formatDateDivider(isoString)}
      </span>
    </div>
  );
};
