import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useProgress } from '../../context/ProgressContext.jsx';
import { storage } from '../../utils/storage.js';

const NAV = [
  { to: '/contests', icon: '🏁', label: 'Contests' },
  { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { to: '/roadmap', icon: '🗺️', label: 'My Roadmap' },
  { to: '/world-map', icon: '🧭', label: 'World Map' },
  { to: '/modules', icon: '📚', label: 'Modules' },
  { to: '/circuit', icon: '⚡', label: 'Circuit Builder' },
  { to: '/race', icon: '⚔', label: 'Quantum Race' },
  { to: '/lab', icon: '🔬', label: 'Quantum Lab' },
  { to: '/skillmap', icon: '📊', label: 'Skill Map' },
  { to: '/achievements', icon: '🏆', label: 'Achievements' },
  { to: '/notifications', icon: '🔔', label: 'Notifications' },
  { to: '/profile', icon: '👤', label: 'My Profile' },
];

export default function Sidebar() {
  const { user, logout, updateUser } = useAuth();
  const { getOverallKnowledge } = useProgress();
  const navigate = useNavigate();
  const knowledge = getOverallKnowledge();
  const instructorNav = [
    { to: '/instructor', icon: '🎓', label: 'Instructor Dashboard' },
  ];
  const navigation = user?.isInstructor ? instructorNav : NAV;
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatar_url]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be smaller than 2MB");
      return;
    }
    
    setUploading(true);
    const newUrl = await storage.uploadAvatar(user.id, file);
    if (newUrl) {
      updateUser({ avatar_url: newUrl });
    } else {
      alert("Failed to upload avatar.");
    }
    setUploading(false);
  };

  // Generate user initials for avatar fallback
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">⚛ QuantumLearn</div>

      {/* User Profile Card */}
      {user && (
        <div className="sidebar-profile">
          <div className="sidebar-avatar" onClick={() => document.getElementById('avatar-upload').click()} style={{ cursor: 'pointer', position: 'relative' }} title="Change Avatar">
            <input id="avatar-upload" type="file" accept="image/png, image/jpeg, image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} disabled={uploading} />
            {uploading ? (
              <div className="sidebar-avatar-fallback" style={{ fontSize: '0.8rem' }}>...</div>
            ) : (user.avatar_url && !avatarError) ? (
              <img src={user.avatar_url} alt={user.name} className="sidebar-avatar-img" onError={() => setAvatarError(true)} />
            ) : (
              <div className="sidebar-avatar-fallback">{getInitials(user.name)}</div>
            )}
            <div className="sidebar-avatar-status" />
          </div>
          <div className="sidebar-user-info" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }} title="View Profile">
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-user-role">{user.isAdmin ? '⚙️ Admin' : user.isInstructor ? '🎓 Instructor' : '🎓 Student'}</div>
          </div>
          <div className="sidebar-user-badges">
            <div className="sidebar-badge xp-badge" title="Total XP">
              <span className="badge-icon">⚡</span>
              <span className="badge-value">{user.total_xp || 0}</span>
              <span className="badge-label">XP</span>
            </div>
            <div className="sidebar-badge streak-badge" title="Current Streak">
              <span className="badge-icon">🔥</span>
              <span className="badge-value">{user.current_streak || 0}</span>
              <span className="badge-label">Days</span>
            </div>
          </div>
        </div>
      )}

      <nav className="sidebar-nav">
        {navigation.map(n => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <span className="icon">{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
        {user?.isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <span className="icon">⚙️</span><span>Admin</span>
          </NavLink>
        )}
      </nav>
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-glass)' }}>
        {user?.isInstructor ? <>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Instructor workspace</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>QuantumLearn AI</div>
        </> : <>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Knowledge Score</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)', marginBottom: 8 }}>
          {knowledge}%
        </div>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${knowledge}%` }} /></div>
        </>}
        <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 12 }} onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
