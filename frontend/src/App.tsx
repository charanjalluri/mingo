import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useWebSocket } from './context/WebSocketContext';
import { useSoundNotification } from './hooks/useSoundNotification';
import { Conversation } from './types';
import { conversationsApi } from './api/conversations';

import { LoginModal } from './components/auth/LoginModal';
import { Sidebar } from './components/sidebar/Sidebar';
import { ChatWindow } from './components/chat/ChatWindow';
import { ProfileDrawer } from './components/profile/ProfileDrawer';

export const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const { subscribe } = useWebSocket();
  const { playNotificationChime } = useSoundNotification();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      const list = await conversationsApi.list();
      setConversations(list);
      if (!activeConversationId && list.length > 0) {
        // Select Mingo Squad group by default
        const squad = list.find((c) => c.type === 'group') || list[0];
        setActiveConversationId(squad.id);
      }
    } catch (e) {
      console.error('Failed to load conversations:', e);
    }
  }, [user, activeConversationId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Handle incoming real-time WebSocket events for sidebar unread counts & sound notification
  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      const { type, payload } = event;

      if (type === 'new_message') {
        if (payload.sender_id !== user?.id) {
          playNotificationChime();
        }

        setConversations((prev) => {
          return prev.map((c) => {
            if (c.id === payload.conversation_id) {
              const isCurrent = c.id === activeConversationId;
              return {
                ...c,
                last_message: payload,
                unread_count: isCurrent ? 0 : c.unread_count + 1,
                updated_at: payload.created_at
              };
            }
            return c;
          }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        });
      }
    });

    return () => unsubscribe();
  }, [subscribe, user?.id, activeConversationId, playNotificationChime]);

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    conversationsApi.markRead(id);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
    );
  };

  const handleStartDirectChat = async (targetUserId: string) => {
    try {
      const directConv = await conversationsApi.getDirect(targetUserId);
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === directConv.id);
        if (exists) return prev;
        return [directConv, ...prev];
      });
      setActiveConversationId(directConv.id);
    } catch (e) {
      console.error('Failed to start direct chat:', e);
    }
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        backgroundColor: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-primary)',
        fontSize: '1rem',
        fontWeight: 600
      }}>
        Initializing Mingo...
      </div>
    );
  }

  if (!user) {
    return <LoginModal />;
  }

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      backgroundColor: 'var(--bg-app)',
      overflow: 'hidden'
    }}>
      {/* Sidebar View */}
      {(!isMobileView || !activeConversationId) && (
        <div style={{
          width: isMobileView ? '100%' : '340px',
          height: '100%',
          flexShrink: 0
        }}>
          <Sidebar
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onOpenProfile={() => setShowProfile(true)}
            onStartDirectChat={handleStartDirectChat}
            onSearchQuery={() => {}}
          />
        </div>
      )}

      {/* Main Chat View */}
      {(!isMobileView || activeConversationId) && activeConversation ? (
        <ChatWindow
          conversation={activeConversation}
          onBackMobile={isMobileView ? () => setActiveConversationId(null) : undefined}
        />
      ) : !isMobileView ? (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.95rem'
        }}>
          Select a conversation from the sidebar to start chatting.
        </div>
      ) : null}

      {/* Profile Settings Drawer */}
      {showProfile && (
        <ProfileDrawer onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
};
