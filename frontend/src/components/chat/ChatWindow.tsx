import React, { useState, useEffect } from 'react';
import { Conversation, Message } from '../../types';
import { messagesApi } from '../../api/messages';
import { useWebSocket } from '../../context/WebSocketContext';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ReplyPreview } from './ReplyPreview';
import { ChatComposer } from '../composer/ChatComposer';
import { Lightbox } from '../media/Lightbox';
import { Search, X } from 'lucide-react';

interface ChatWindowProps {
  conversation: Conversation;
  onBackMobile?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ conversation, onBackMobile }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState<Message | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  
  // Search overlay state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);

  const { subscribe, sendTyping } = useWebSocket();

  // Load message history on conversation change
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setReplyMessage(null);

    messagesApi.getMessages(conversation.id, 60).then((msgs) => {
      if (isMounted) {
        setMessages(msgs);
        setLoading(false);
      }
    }).catch((err) => {
      console.error('Failed to load messages:', err);
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [conversation.id]);

  // Subscribe to real-time WebSocket events
  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      const { type, payload } = event;

      if (type === 'new_message' && payload.conversation_id === conversation.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [...prev, payload];
        });
      } else if (type === 'message_updated' && payload.conversation_id === conversation.id) {
        setMessages((prev) => prev.map((m) => (m.id === payload.id ? payload : m)));
      } else if (type === 'message_deleted' && payload.conversation_id === conversation.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === payload.message_id ? { ...m, is_deleted: true, content: undefined, media_url: undefined } : m))
        );
      } else if (type === 'reaction_updated' && payload.conversation_id === conversation.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === payload.message_id ? { ...m, reactions: payload.reactions } : m))
        );
      } else if (type === 'typing_status' && payload.conversation_id === conversation.id) {
        setTypingUsers((prev) => {
          const updated = { ...prev };
          if (payload.is_typing) {
            updated[payload.user_id] = payload.user_display_name;
          } else {
            delete updated[payload.user_id];
          }
          return updated;
        });
      }
    });

    return () => unsubscribe();
  }, [conversation.id, subscribe]);

  const handleSendMessage = async (data: { content?: string; message_type?: 'text' | 'image' | 'voice'; media_url?: string; media_duration?: number }) => {
    try {
      const created = await messagesApi.sendMessage({
        conversation_id: conversation.id,
        reply_to_id: replyMessage?.id,
        ...data
      });

      setMessages((prev) => {
        if (prev.some((m) => m.id === created.id)) return prev;
        return [...prev, created];
      });

      setReplyMessage(null);
    } catch (e) {
      console.error('Send message failed:', e);
      alert('Failed to send message.');
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      const res = await messagesApi.toggleReaction(messageId, emoji);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: res.reactions } : m))
      );
    } catch (e) {
      console.error('Reaction toggle failed:', e);
    }
  };

  const handleEdit = async (msg: Message) => {
    const newContent = prompt('Edit message:', msg.content || '');
    if (newContent && newContent.trim() && newContent !== msg.content) {
      try {
        const updated = await messagesApi.editMessage(msg.id, newContent.trim());
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? updated : m)));
      } catch (e) {
        alert('Failed to edit message.');
      }
    }
  };

  const handleDelete = async (messageId: string) => {
    if (confirm('Delete this message for everyone?')) {
      try {
        await messagesApi.deleteMessage(messageId);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, is_deleted: true, content: undefined, media_url: undefined } : m))
        );
      } catch (e) {
        alert('Failed to delete message.');
      }
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const results = await messagesApi.searchMessages(searchQuery.trim(), conversation.id);
      setSearchResults(results);
    } catch (e) {
      console.error('Search failed:', e);
    }
  };

  const typingNames = Object.values(typingUsers);

  return (
    <div style={{
      flex: 1,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-chat)',
      position: 'relative'
    }}>
      <ChatHeader
        conversation={conversation}
        typingUserNames={typingNames}
        onBackMobile={onBackMobile}
        onToggleSearch={() => setShowSearch((prev) => !prev)}
      />

      {/* In-chat Search Bar Overlay */}
      {showSearch && (
        <form onSubmit={handleSearchSubmit} style={{
          padding: '10px 16px',
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center'
        }}>
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in conversation..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '0.9rem',
              color: 'var(--text-primary)'
            }}
          />
          <button type="button" onClick={() => setShowSearch(false)} className="interactive-btn press-scale-sm" style={{ color: 'var(--text-muted)', padding: '4px', borderRadius: '50%' }} title="Close search">
            <X size={18} />
          </button>
        </form>
      )}

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Loading chat history...
        </div>
      ) : (
        <MessageList
          messages={messages}
          isGroup={conversation.type === 'group'}
          typingUserNames={typingNames}
          onReply={(msg) => setReplyMessage(msg)}
          onReaction={handleReaction}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onOpenImage={(url) => setLightboxSrc(url)}
        />
      )}

      {replyMessage && (
        <ReplyPreview message={replyMessage} onCancel={() => setReplyMessage(null)} />
      )}

      <ChatComposer
        onSendMessage={handleSendMessage}
        onTyping={(isTyping) => sendTyping(conversation.id, isTyping)}
      />

      {lightboxSrc && (
        <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  );
};
