import { apiClient } from './client';
import { Conversation } from '../types';

export const conversationsApi = {
  list: async (): Promise<Conversation[]> => {
    const res = await apiClient.get<Conversation[]>('/conversations');
    return res.data;
  },

  getDirect: async (targetUserId: string): Promise<Conversation> => {
    const res = await apiClient.post<Conversation>(`/conversations/direct/${targetUserId}`);
    return res.data;
  },

  markRead: async (conversationId: string, lastMessageId?: string): Promise<void> => {
    await apiClient.post(`/conversations/${conversationId}/read`, null, {
      params: { last_message_id: lastMessageId }
    });
  }
};
