import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getChats, getMessages, markAllAsRead } from '../services/api';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);

export const useChat = () => useContext(ChatContext);

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const { on, off, emit } = useSocket();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Fetch chats
  const fetchChats = useCallback(async () => {
    if (!user) return;
    setLoadingChats(true);
    try {
      const res = await getChats();
      setChats(res.data);
    } catch (err) {
      console.error('Failed to fetch chats:', err);
    } finally {
      setLoadingChats(false);
    }
  }, [user]);

  // Fetch messages for active chat
  const fetchMessages = useCallback(async (chatId) => {
    setLoadingMessages(true);
    try {
      const res = await getMessages(chatId);
      setMessages(res.data);
      // Mark all as read
      await markAllAsRead(chatId);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Open a chat
  const openChat = useCallback(async (chat) => {
    setActiveChat(chat);
    if (chat) {
      await fetchMessages(chat.id);
      emit('join_chat', { chat_id: chat.id });
    }
  }, [fetchMessages, emit]);

  // Close active chat
  const closeChat = useCallback(() => {
    if (activeChat) {
      emit('leave_chat', { chat_id: activeChat.id });
    }
    setActiveChat(null);
    setMessages([]);
  }, [activeChat, emit]);

  // Initial load
  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Listen for new messages
  useEffect(() => {
    const handleNewMessage = (message) => {
      // If message is for active chat, add to messages
      if (activeChat && message.chat_id === activeChat.id) {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.find(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
        // Mark as read
        if (message.sender_id !== user?.id) {
          markAllAsRead(activeChat.id).catch(() => {});
          emit('message_read', {
            chat_id: activeChat.id,
            message_ids: [message.id],
          });
        }
      }
      // Refresh chat list
      fetchChats();
    };

    const handleChatUpdated = () => {
      fetchChats();
    };

    const handleTyping = (data) => {
      if (data.user_id !== user?.id) {
        setTypingUsers(prev => ({
          ...prev,
          [data.chat_id]: { user_id: data.user_id, username: data.username },
        }));
      }
    };

    const handleStopTyping = (data) => {
      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[data.chat_id];
        return next;
      });
    };

    const handleMessagesRead = (data) => {
      if (activeChat && data.chat_id === activeChat.id) {
        setMessages(prev =>
          prev.map(msg =>
            data.message_ids.includes(msg.id)
              ? { ...msg, read_by: [...new Set([...(msg.read_by || []), data.user_id])] }
              : msg
          )
        );
      }
    };

    on('new_message', handleNewMessage);
    on('chat_updated', handleChatUpdated);
    on('user_typing', handleTyping);
    on('user_stop_typing', handleStopTyping);
    on('messages_read', handleMessagesRead);

    return () => {
      off('new_message', handleNewMessage);
      off('chat_updated', handleChatUpdated);
      off('user_typing', handleTyping);
      off('user_stop_typing', handleStopTyping);
      off('messages_read', handleMessagesRead);
    };
  }, [on, off, activeChat, user, fetchChats, emit]);

  return (
    <ChatContext.Provider value={{
      chats,
      activeChat,
      messages,
      typingUsers,
      loadingChats,
      loadingMessages,
      fetchChats,
      fetchMessages,
      openChat,
      closeChat,
      setMessages,
      setActiveChat,
    }}>
      {children}
    </ChatContext.Provider>
  );
}
