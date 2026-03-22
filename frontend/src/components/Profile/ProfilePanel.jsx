import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { updateMe, uploadFile } from '../../services/api';
import { BiArrowBack, BiPencil, BiCheck } from 'react-icons/bi';
import { BsCamera } from 'react-icons/bs';
import { useRef } from 'react';

export default function ProfilePanel({ onClose }) {
  const { user, updateUser } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [about, setAbout] = useState(user?.about || '');
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef(null);

  const handleSaveName = async () => {
    if (!username.trim()) return;
    setSaving(true);
    try {
      const res = await updateMe({ username });
      updateUser(res.data);
      setEditingName(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAbout = async () => {
    setSaving(true);
    try {
      const res = await updateMe({ about });
      updateUser(res.data);
      setEditingAbout(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const uploadRes = await uploadFile(file);
      const res = await updateMe({ avatar: uploadRes.data.url });
      updateUser(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="profile-panel">
      <div className="profile-panel-header">
        <button className="icon-btn" onClick={onClose}><BiArrowBack /></button>
        <h3>Profile</h3>
      </div>
      <div className="profile-panel-body">
        <div className="profile-avatar-section">
          <div className="avatar avatar-lg" style={{ position: 'relative', cursor: 'pointer' }}
            onClick={() => avatarInputRef.current?.click()}>
            {user?.avatar ? (
              <img src={`http://localhost:8000${user.avatar}`} alt="" />
            ) : (
              user?.username?.[0]?.toUpperCase()
            )}
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--accent)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: 'white'
            }}>
              <BsCamera />
            </div>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleAvatarUpload}
          />
        </div>

        {/* Name */}
        <div className="profile-field">
          <div className="profile-field-label">Your name</div>
          {editingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                className="profile-field-value"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  borderBottom: '2px solid var(--accent)', outline: 'none',
                  color: 'var(--text-primary)', fontSize: 16, fontFamily: 'inherit',
                  paddingBottom: 4,
                }}
              />
              <button className="icon-btn" onClick={handleSaveName} disabled={saving}>
                <BiCheck style={{ color: 'var(--accent)' }} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="profile-field-value">{user?.username}</span>
              <button className="icon-btn" onClick={() => setEditingName(true)}>
                <BiPencil />
              </button>
            </div>
          )}
        </div>

        {/* About */}
        <div className="profile-field">
          <div className="profile-field-label">About</div>
          {editingAbout ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                autoFocus
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  borderBottom: '2px solid var(--accent)', outline: 'none',
                  color: 'var(--text-primary)', fontSize: 16, fontFamily: 'inherit',
                  paddingBottom: 4,
                }}
              />
              <button className="icon-btn" onClick={handleSaveAbout} disabled={saving}>
                <BiCheck style={{ color: 'var(--accent)' }} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="profile-field-value">{user?.about}</span>
              <button className="icon-btn" onClick={() => setEditingAbout(true)}>
                <BiPencil />
              </button>
            </div>
          )}
        </div>

        {/* Email */}
        <div className="profile-field">
          <div className="profile-field-label">Email</div>
          <span className="profile-field-value">{user?.email}</span>
        </div>
      </div>
    </div>
  );
}
