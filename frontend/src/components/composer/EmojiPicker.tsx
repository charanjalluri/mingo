import React from 'react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

const EMOJI_CATEGORIES = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
  '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
  '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
  '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✌️', '🤟',
  '🤘', '🤙', '🖐️', '✋', '👌', '🤏', '👈', '👉', '👆', '👇',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
  '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🔥', '✨',
  '🌟', '💫', '💥', '🎉', '🎊', '🚀', '💯', '🎯', '⚽', '🍕'
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect }) => {
  return (
    <div style={{
      position: 'absolute',
      bottom: '64px',
      left: '16px',
      width: '280px',
      height: '200px',
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      padding: '12px',
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: '6px',
      overflowY: 'auto',
      zIndex: 50,
      animation: 'fadeIn 0.15s ease-out'
    }}>
      {EMOJI_CATEGORIES.map((emoji, i) => (
        <button
          key={i}
          onClick={() => onSelect(emoji)}
          className="press-scale-xs interactive-btn"
          style={{
            fontSize: '1.2rem',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer'
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};
