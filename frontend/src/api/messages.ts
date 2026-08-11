import { apiClient } from './client';
import { Message, Reaction } from '../types';

export const messagesApi = {
  getMessages: async (conversationId: string, limit = 50, beforeId?: string): Promise<Message[]> => {
    const res = await apiClient.get<Message[]>('/messages', {
      params: { conversation_id: conversationId, limit, before_id: beforeId }
    });
    return res.data;
  },

  searchMessages: async (q: string, conversationId?: string): Promise<Message[]> => {
    const res = await apiClient.get<Message[]>('/messages/search', {
      params: { q, conversation_id: conversationId }
    });
    return res.data;
  },

  sendMessage: async (data: {
    conversation_id: string;
    content?: string;
    message_type?: 'text' | 'image' | 'voice';
    media_url?: string;
    media_duration?: number;
    reply_to_id?: string;
  }): Promise<Message> => {
    const res = await apiClient.post<Message>('/messages', data);
    return res.data;
  },

  editMessage: async (id: string, content: string): Promise<Message> => {
    const res = await apiClient.put<Message>(`/messages/${id}`, { content });
    return res.data;
  },

  deleteMessage: async (id: string): Promise<void> => {
    await apiClient.delete(`/messages/${id}`);
  },

  toggleReaction: async (id: string, emoji: string): Promise<{ reactions: Reaction[] }> => {
    const res = await apiClient.post<{ reactions: Reaction[] }>(`/messages/${id}/reactions`, { emoji });
    return res.data;
  }
};
