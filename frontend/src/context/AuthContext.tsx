import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { authApi } from '../api/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: str) => Promise<void>;
  logout: () => void;
  updateUser: (updated: User) => void;
  authorizedUsers: User[];
  fetchAuthorizedUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('mingo_token') || localStorage.getItem('fourchat_token'));
  const [loading, setLoading] = useState<boolean>(true);
  const [authorizedUsers, setAuthorizedUsers] = useState<User[]>([]);

  const fetchAuthorizedUsers = async () => {
    try {
      const list = await authApi.getUsers();
      setAuthorizedUsers(list);
    } catch (e) {
      console.error('Failed to fetch authorized users:', e);
    }
  };

  useEffect(() => {
    fetchAuthorizedUsers();
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const u = await authApi.getMe();
          setUser(u);
        } catch (e) {
          console.error('Invalid session token:', e);
          localStorage.removeItem('mingo_token');
          localStorage.removeItem('fourchat_token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [token]);

  const login = async (username: string, password: str) => {
    const res = await authApi.login(username, password);
    localStorage.setItem('mingo_token', res.access_token);
    setToken(res.access_token);
    setUser(res.user);
  };

  const logout = async () => {
    await authApi.logout();
    localStorage.removeItem('mingo_token');
    localStorage.removeItem('fourchat_token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updated: User) => {
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      logout,
      updateUser,
      authorizedUsers,
      fetchAuthorizedUsers
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
