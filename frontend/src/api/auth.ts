import { apiClient } from './client';
import { User } from '../types';

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export const authApi = {
  getUsers: async (): Promise<User[]> => {
    const res = await apiClient.get<User[]>('/auth/users');
    return res.data;
  },

  login: async (username: string, password: str): Promise<LoginResponse> => {
    const res = await apiClient.post<LoginResponse>('/auth/login', { username, password });
    return res.data;
  },

  getMe: async (): Promise<User> => {
    const res = await apiClient.get<User>('/auth/me');
    return res.data;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch (e) {
      // Ignore errors on logout
    }
  },

  updateProfile: async (data: { display_name?: string; bio?: string; avatar_url?: string }): Promise<User> => {
    const res = await apiClient.put<User>('/auth/profile', data);
    return res.data;
  },

  changePassword: async (old_password: string, new_password: string): Promise<void> => {
    await apiClient.post('/auth/change-password', { old_password, new_password });
  }
};
