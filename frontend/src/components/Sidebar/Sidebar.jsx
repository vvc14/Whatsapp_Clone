import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useSocket } from '../../contexts/SocketContext';
import { searchUsers, createChat, createGroup } from '../../services/api';
import { formatDistanceToNow, parseISO, isToday, isYesterday, format } from 'date-fns';
import { BiSearch, BiMessageRoundedAdd, BiGroup, BiLogOut} from 'react-icons/bi';
import { BsWhatsapp, BsCheckAll, BsImage, BsFileEarmark, BsMicFill } from 'react-icons/bs';
import { HiOutlineUserCircle } from 'react-icons/hi2';
import { IoClose } from 'react-icons/io5';
import ProfilePanel from '../Profile/ProfilePanel';

function formatMessageTime(dateStr) {
  if (!dateStr) return '';
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'dd/MM/yyyy');
  } catch {
    return '';
  }
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { chats, activeChat, openChat, fetchChats } = useChat();
  const { onlineUsers } = useSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [filter, setFilter] = useState('all');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupParticipants, setGroupParticipants] = useState([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState([]);
  const searchTimerRef = useRef(null);

  // Search users
  const handleSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await searchUsers(query);
      setSearchResults(res.data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => handleSearch(searchQuery), 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery, handleSearch]);

  // Start private chat
  const startChat = async (userId) => {
    try {
      const res = await createChat(userId);
      await fetchChats();
      openChat(res.data);
      setShowSearch(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      console.error('Failed to create chat:', err);
    }
  };

  // Group search
  useEffect(() => {
    if (!groupSearchQuery.trim()) {
      setGroupSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await searchUsers(groupSearchQuery);
        setGroupSearchResults(res.data.filter(u => !groupParticipants.find(p => p.id === u.id)));
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [groupSearchQuery, groupParticipants]);

  const addGroupParticipant = (u) => {
    setGroupParticipants(prev => [...prev, u]);
    setGroupSearchQuery('');
    setGroupSearchResults([]);
  };

  const removeGroupParticipant = (id) => {
    setGroupParticipants(prev => prev.filter(p => p.id !== id));
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || groupParticipants.length === 0) return;
    try {
      const res = await createGroup({
        name: groupName,
        participants: groupParticipants.map(p => p.id),
      });
      await fetchChats();
      openChat(res.data);
      setShowNewGroup(false);
      setGroupName('');
      setGroupParticipants([]);
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  // Filter chats
  const filteredChats = chats.filter(chat => {
    if (filter === 'unread') return chat.unread_count > 0;
    if (filter === 'groups') return chat.type === 'group';
    return true;
  });

  const getChatName = (chat) => {
    if (chat.type === 'group') return chat.group_name;
    const other = chat.participants?.find(p => p.id !== user?.id);
    return other?.username || 'Unknown';
  };

  const getChatAvatar = (chat) => {
    if (chat.type === 'group') return chat.group_name?.[0] || 'G';
    const other = chat.participants?.find(p => p.id !== user?.id);
    return other?.avatar ? null : (other?.username?.[0] || '?');
  };

  const getChatAvatarUrl = (chat) => {
    if (chat.type === 'group') return chat.group_avatar;
    const other = chat.participants?.find(p => p.id !== user?.id);
    return other?.avatar;
  };

  const isUserOnline = (chat) => {
    if (chat.type === 'group') return false;
    const other = chat.participants?.find(p => p.id !== user?.id);
    return other ? onlineUsers.has(other.id) : false;
  };

  const getLastMessagePreview = (chat) => {
    if (!chat.last_message) return 'No messages yet';
    const lm = chat.last_message;
    const prefix = lm.sender_id === user?.id ? 'You: ' : '';
    if (lm.type === 'image') return `${prefix}📷 Photo`;
    if (lm.type === 'file') return `${prefix}📄 Document`;
    if (lm.type === 'audio') return `${prefix}🎵 Audio`;
    return `${prefix}${lm.content}`;
  };

  return (
    <div className="sidebar">
      {showProfile && <ProfilePanel onClose={() => setShowProfile(false)} />}

      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-header-left">
          <h2>Chats</h2>
        </div>
        <div className="sidebar-header-actions">
          <button className="icon-btn" title="Profile" onClick={() => setShowProfile(true)} id="btn-profile">
            <HiOutlineUserCircle />
          </button>
          <button className="icon-btn" title="New Chat" onClick={() => setShowSearch(!showSearch)} id="btn-new-chat">
            <BiMessageRoundedAdd />
          </button>
          <button className="icon-btn" title="New Group" onClick={() => setShowNewGroup(true)} id="btn-new-group">
            <BiGroup />
          </button>
          <button className="icon-btn" title="Logout" onClick={logout} id="btn-logout">
            <BiLogOut />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="search-box">
        <div className="search-input-wrapper">
          <BiSearch />
          <input
            placeholder={showSearch ? 'Search users...' : 'Search or start new chat'}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!showSearch) setShowSearch(true);
            }}
            onFocus={() => setShowSearch(true)}
            id="search-input"
          />
          {showSearch && (
            <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
              setSearchResults([]);
            }}>
              <IoClose />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {!showSearch && (
        <div className="chat-filters">
          <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`filter-btn ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>Unread</button>
          <button className={`filter-btn ${filter === 'groups' ? 'active' : ''}`} onClick={() => setFilter('groups')}>Groups</button>
        </div>
      )}

      {/* Search Results or Chat List */}
      <div className="chat-list">
        {showSearch && searchQuery ? (
          searching ? (
            <div className="loading-spinner"><div className="spinner"></div></div>
          ) : searchResults.length > 0 ? (
            searchResults.map(u => (
              <div key={u.id} className="chat-item" onClick={() => startChat(u.id)}>
                <div className="chat-item-avatar">
                  <div className="avatar">
                    {u.avatar ? <img src={`http://localhost:8000${u.avatar}`} alt="" /> : u.username?.[0]?.toUpperCase()}
                  </div>
                  {onlineUsers.has(u.id) && <div className="online-dot"></div>}
                </div>
                <div className="chat-item-info">
                  <div className="chat-item-top">
                    <span className="chat-item-name">{u.username}</span>
                  </div>
                  <div className="chat-item-bottom">
                    <span className="chat-item-preview">{u.about}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <p>No users found</p>
            </div>
          )
        ) : (
          filteredChats.length > 0 ? (
            filteredChats.map(chat => (
              <div
                key={chat.id}
                className={`chat-item ${activeChat?.id === chat.id ? 'active' : ''}`}
                onClick={() => openChat(chat)}
                id={`chat-item-${chat.id}`}
              >
                <div className="chat-item-avatar">
                  <div className="avatar">
                    {getChatAvatarUrl(chat) ? (
                      <img src={`http://localhost:8000${getChatAvatarUrl(chat)}`} alt="" />
                    ) : (
                      getChatAvatar(chat)?.toUpperCase()
                    )}
                  </div>
                  {isUserOnline(chat) && <div className="online-dot"></div>}
                </div>
                <div className="chat-item-info">
                  <div className="chat-item-top">
                    <span className="chat-item-name">{getChatName(chat)}</span>
                    <span className={`chat-item-time ${chat.unread_count > 0 ? 'unread' : ''}`}>
                      {formatMessageTime(chat.last_message?.created_at || chat.updated_at)}
                    </span>
                  </div>
                  <div className="chat-item-bottom">
                    <span className="chat-item-preview">{getLastMessagePreview(chat)}</span>
                    {chat.unread_count > 0 && (
                      <span className="unread-badge">{chat.unread_count}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <p>No chats yet. Start a conversation!</p>
            </div>
          )
        )}
      </div>

      {/* New Group Modal */}
      {showNewGroup && (
        <div className="modal-overlay" onClick={() => setShowNewGroup(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <button className="icon-btn" onClick={() => setShowNewGroup(false)}><IoClose /></button>
              <h3>New Group</h3>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Group Name</label>
                <input
                  placeholder="Enter group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  id="group-name-input"
                />
              </div>

              {/* Selected participants */}
              {groupParticipants.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {groupParticipants.map(p => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'var(--accent-dark)', padding: '4px 10px', borderRadius: 20,
                      fontSize: 13, color: 'var(--text-primary)'
                    }}>
                      {p.username}
                      <IoClose style={{ cursor: 'pointer' }} onClick={() => removeGroupParticipant(p.id)} />
                    </div>
                  ))}
                </div>
              )}

              <div className="form-group">
                <label>Add Participants</label>
                <input
                  placeholder="Search users..."
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  id="group-search-input"
                />
              </div>

              {groupSearchResults.map(u => (
                <div key={u.id} className="user-result" onClick={() => addGroupParticipant(u)}>
                  <div className="avatar avatar-sm">{u.username?.[0]?.toUpperCase()}</div>
                  <div className="user-result-info">
                    <div className="user-result-name">{u.username}</div>
                    <div className="user-result-about">{u.about}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNewGroup(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || groupParticipants.length === 0}
                id="create-group-btn"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
