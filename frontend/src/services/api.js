import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
});

// Add JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const registerUser = (data) => api.post('/auth/register', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const googleAuth = (credential) => api.post('/auth/google', { credential });
export const getGoogleClientId = () => api.get('/auth/google-client-id');

// Users
export const getMe = () => api.get('/users/me');
export const updateMe = (data) => api.put('/users/me', data);
export const searchUsers = (query) => api.get(`/users/search?q=${encodeURIComponent(query)}`);
export const getUser = (id) => api.get(`/users/${id}`);

// Chats
export const createChat = (participantId) => api.post('/chats', { participant_id: participantId });
export const getChats = () => api.get('/chats');
export const getChat = (chatId) => api.get(`/chats/${chatId}`);
export const createGroup = (data) => api.post('/chats/group', data);
export const updateGroup = (chatId, data) => api.put(`/chats/group/${chatId}`, data);

// Messages
export const getMessages = (chatId, skip = 0, limit = 50) =>
  api.get(`/messages/${chatId}?skip=${skip}&limit=${limit}`);
export const sendMessage = (data) => api.post('/messages', data);
export const markAsRead = (messageId) => api.put(`/messages/${messageId}/read`);
export const markAllAsRead = (chatId) => api.put(`/messages/${chatId}/read-all`);
export const deleteMessage = (messageId) => api.delete(`/messages/${messageId}`);

// Upload
export const uploadFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export default api;
