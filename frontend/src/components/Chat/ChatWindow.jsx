import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useSocket } from '../../contexts/SocketContext';
import { uploadFile } from '../../services/api';
import { format, parseISO, isToday, isYesterday, isSameDay } from 'date-fns';
import {
  BiArrowBack, BiSearch, BiDotsVerticalRounded,
  BiSmile, BiPlus, BiSend, BiMicrophone
} from 'react-icons/bi';
import { BsCheckAll, BsCheck, BsImage, BsFileEarmark, BsMicFill, BsChatDotsFill } from 'react-icons/bs';
import { IoClose, IoDocumentOutline } from 'react-icons/io5';
import { HiOutlinePaperClip } from 'react-icons/hi2';
import EmojiPicker from 'emoji-picker-react';

function formatMsgTime(dateStr) {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'HH:mm');
  } catch {
    return '';
  }
}

function formatDateSeparator(dateStr) {
  if (!dateStr) return '';
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  } catch {
    return '';
  }
}

function shouldShowDateSeparator(messages, index) {
  if (index === 0) return true;
  try {
    const curr = parseISO(messages[index].created_at);
    const prev = parseISO(messages[index - 1].created_at);
    return !isSameDay(curr, prev);
  } catch {
    return false;
  }
}

export default function ChatWindow() {
  const { user } = useAuth();
  const { activeChat, messages, typingUsers, closeChat, loadingMessages } = useChat();
  const { onlineUsers, emit } = useSocket();
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
    }
  }, [text]);

  // Get other user info
  const otherUser = activeChat?.type === 'private'
    ? activeChat.participants?.find(p => p.id !== user?.id)
    : null;

  const chatName = activeChat?.type === 'group'
    ? activeChat.group_name
    : otherUser?.username || 'Unknown';

  const isOnline = otherUser ? onlineUsers.has(otherUser.id) : false;

  const typingInfo = typingUsers[activeChat?.id];

  const getStatus = () => {
    if (typingInfo) return `${typingInfo.username} is typing...`;
    if (activeChat?.type === 'group') {
      const names = activeChat.participants?.map(p => p.id === user?.id ? 'You' : p.username).join(', ');
      return names;
    }
    if (isOnline) return 'online';
    return 'offline';
  };

  // Send message
  const sendMessage = useCallback(() => {
    if (!text.trim() || !activeChat) return;

    emit('send_message', {
      chat_id: activeChat.id,
      content: text.trim(),
      type: 'text',
    });

    setText('');
    emit('stop_typing', { chat_id: activeChat.id });
    setShowEmoji(false);
  }, [text, activeChat, emit]);

  // Handle typing
  const handleTyping = () => {
    emit('typing', { chat_id: activeChat.id });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      emit('stop_typing', { chat_id: activeChat.id });
    }, 2000);
  };

  // Handle key press
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Handle file upload
  const handleFileUpload = async (file, type) => {
    if (!file || !activeChat) return;
    setUploading(true);
    try {
      const res = await uploadFile(file);
      emit('send_message', {
        chat_id: activeChat.id,
        content: file.name,
        type: type,
        file_url: res.data.url,
      });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      setShowAttach(false);
    }
  };

  // Emoji select
  const onEmojiClick = (emojiData) => {
    setText(prev => prev + emojiData.emoji);
    textareaRef.current?.focus();
  };

  // Read receipt icon
  const getReadStatus = (msg) => {
    if (msg.sender_id !== user?.id) return null;
    const participants = activeChat?.participants?.length || 2;
    const readCount = msg.read_by?.length || 0;
    if (readCount >= participants) {
      return <BsCheckAll className="message-status read" />;
    }
    return <BsCheckAll className="message-status delivered" />;
  };

  if (!activeChat) {
    return (
      <div className="no-chat-selected">
        <div className="no-chat-selected-icon">
          <BsChatDotsFill />
        </div>
        <h2>Conversa Web</h2>
        <p>Send and receive messages in real-time. Connect with friends and groups seamlessly from any device.</p>
      </div>
    );
  }

  return (
    <div className="chat-window">
      {/* Chat Header */}
      <div className="chat-header">
        <button className="icon-btn back-btn" onClick={closeChat}>
          <BiArrowBack />
        </button>
        <div className="chat-item-avatar">
          <div className="avatar">
            {activeChat.type === 'group'
              ? activeChat.group_name?.[0]?.toUpperCase()
              : otherUser?.avatar
                ? <img src={`http://localhost:8000${otherUser.avatar}`} alt="" />
                : otherUser?.username?.[0]?.toUpperCase()
            }
          </div>
          {isOnline && <div className="online-dot"></div>}
        </div>
        <div className="chat-header-info">
          <div className="chat-header-name">{chatName}</div>
          <div className={`chat-header-status ${isOnline ? 'online' : ''} ${typingInfo ? 'typing' : ''}`}>
            {getStatus()}
          </div>
        </div>
        <div className="chat-header-actions">
          <button className="icon-btn"><BiSearch /></button>
          <button className="icon-btn"><BiDotsVerticalRounded /></button>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-area">
        {loadingMessages ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : (
          messages.map((msg, index) => (
            <div key={msg.id}>
              {shouldShowDateSeparator(messages, index) && (
                <div className="date-separator">
                  <span>{formatDateSeparator(msg.created_at)}</span>
                </div>
              )}
              <div className={`message ${msg.sender_id === user?.id ? 'sent' : 'received'}`}>
                <div className="message-bubble">
                  {/* Sender name in group chats */}
                  {activeChat.type === 'group' && msg.sender_id !== user?.id && (
                    <div className="message-sender">{msg.sender_name}</div>
                  )}

                  {/* Message content by type */}
                  {msg.deleted ? (
                    <span className="message-deleted">🚫 This message was deleted</span>
                  ) : msg.type === 'image' && msg.file_url ? (
                    <>
                      <img
                        src={`http://localhost:8000${msg.file_url}`}
                        alt="Sent image"
                        className="message-image"
                      />
                      {msg.content && msg.content !== msg.file_url && (
                        <div className="message-content">{msg.content}</div>
                      )}
                    </>
                  ) : msg.type === 'file' && msg.file_url ? (
                    <a
                      href={`http://localhost:8000${msg.file_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="message-file"
                    >
                      <IoDocumentOutline className="message-file-icon" />
                      <div className="message-file-info">
                        <div className="message-file-name">{msg.content || 'Document'}</div>
                      </div>
                    </a>
                  ) : (
                    <div className="message-content">{msg.content}</div>
                  )}

                  <div className="message-meta">
                    <span className="message-time">{formatMsgTime(msg.created_at)}</span>
                    {getReadStatus(msg)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Typing indicator */}
        {typingInfo && (
          <div className="message received">
            <div className="message-bubble">
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Emoji Picker */}
      {showEmoji && (
        <div className="emoji-picker-container">
          <EmojiPicker
            onEmojiClick={onEmojiClick}
            theme="dark"
            width={350}
            height={400}
          />
        </div>
      )}

      {/* Attachment Menu */}
      {showAttach && (
        <div className="attachment-menu">
          <div className="attachment-item" onClick={() => imageInputRef.current?.click()}>
            <div className="attachment-item-icon image"><BsImage /></div>
            Photos & Videos
          </div>
          <div className="attachment-item" onClick={() => fileInputRef.current?.click()}>
            <div className="attachment-item-icon document"><BsFileEarmark /></div>
            Document
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0], 'image')}
      />
      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0], 'file')}
      />

      {/* Message Input */}
      <div className="message-input-area">
        <div className="message-input-actions">
          <button
            className="icon-btn"
            onClick={() => { setShowEmoji(!showEmoji); setShowAttach(false); }}
            id="emoji-btn"
          >
            <BiSmile />
          </button>
          <button
            className="icon-btn"
            onClick={() => { setShowAttach(!showAttach); setShowEmoji(false); }}
            id="attach-btn"
          >
            <HiOutlinePaperClip />
          </button>
        </div>
        <div className="message-input-wrapper">
          <textarea
            ref={textareaRef}
            placeholder="Type a message"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            id="message-input"
          />
        </div>
        <button
          className="send-btn"
          onClick={sendMessage}
          disabled={!text.trim() && !uploading}
          id="send-btn"
        >
          <BiSend />
        </button>
      </div>
    </div>
  );
}
