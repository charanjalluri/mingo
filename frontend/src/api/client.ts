import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('mingo_token') || localStorage.getItem('fourchat_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
