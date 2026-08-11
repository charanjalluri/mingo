import React, { useState } from 'react';
import { Conversation, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ConversationItem } from './ConversationItem';
import { Search, Settings, Sun, Moon, LogOut, MessageSquarePlus } from 'lucide-react';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onOpenProfile: () => void;
  onStartDirectChat: (targetUserId: string) => void;
  onSearchQuery: (query: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenProfile,
  onStartDirectChat,
  onSearchQuery
}) => {
  const { user, logout, authorizedUsers } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [showMemberSelector, setShowMemberSelector] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    onSearchQuery(val);
  };

  const filteredConversations = conversations.filter((c) => {
    if (!search.trim()) return true;
    const name = c.name || c.participants.map((p) => p.display_name).join(' ');
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const otherUsers = authorizedUsers.filter((u) => u.id !== user?.id);

  return (
    <aside style={{
      width: '100%',
      height: '100%',
      backgroundColor: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none'
    }}>
      {/* Top Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div
          onClick={onOpenProfile}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          title="Open Profile Settings"
        >
          <img
            src={user?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username}`}
            alt={user?.display_name || 'Profile'}
            style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-primary)' }}
          />
          <div>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {user?.display_name}
            </h2>
            <span style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 600 }}>Online</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setShowMemberSelector((prev) => !prev)}
            style={{ padding: '8px', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}
            title="Start Direct Chat"
          >
            <MessageSquarePlus size={20} />
          </button>

          <button
            onClick={toggleTheme}
            style={{ padding: '8px', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <button
            onClick={onOpenProfile}
            style={{ padding: '8px', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}
            title="Settings"
          >
            <Settings size={20} />
          </button>

          <button
            onClick={logout}
            style={{ padding: '8px', borderRadius: 'var(--radius-md)', color: '#ef4444' }}
            title="Log out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Direct Chat Member Selector Modal */}
      {showMemberSelector && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-subtle)',
          animation: 'fadeIn 0.15s ease'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Direct Message Squad Member:
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            {otherUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  onStartDirectChat(u.id);
                  setShowMemberSelector(false);
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textAlign: 'left'
                }}
              >
                <img
                  src={u.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                  alt={u.display_name}
                  style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {u.display_name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: 'var(--bg-input)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)'
        }}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search conversations..."
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '0.88rem',
              color: 'var(--text-primary)'
            }}
          />
        </div>
      </div>

      {/* Conversation List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px 8px' }}>
        {filteredConversations.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No conversations found.
          </div>
        ) : (
          filteredConversations.map((c) => (
            <ConversationItem
              key={c.id}
              conversation={c}
              isActive={c.id === activeConversationId}
              onSelect={() => onSelectConversation(c.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
};
