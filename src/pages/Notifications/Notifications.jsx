import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markNotificationRead } from '../../services/quantumApi.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Notifications() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getNotifications();
      setNotifications(res?.notifications || []);
      setUnreadCount(res?.unread_count || 0);
    } catch (err) {
      setError(err.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadNotifications();
  }, [user]);

  const handleMarkOne = async (id) => {
    setActionLoading(true);
    try {
      await markNotificationRead(id, false);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('Failed to mark notification read:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAll = async () => {
    setActionLoading(true);
    try {
      await markNotificationRead(null, true);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed to mark all read:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const categoryIcon = (category) => {
    switch (category) {
      case 'achievement': return '🏆';
      case 'level_up': return '⚡';
      case 'mission': return '🎯';
      case 'quest': return '📋';
      case 'contest': return '🏁';
      default: return '🔔';
    }
  };

  return (
    <div className="page fade-in" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">🔔 Notifications</h1>
          <p className="page-subtitle">Stay informed about achievements, quests, level milestones, and events.</p>
        </div>
        {unreadCount > 0 && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleMarkAll}
            disabled={actionLoading}
          >
            Mark all as read
          </button>
        )}
      </div>

      {error && (
        <div className="mission-feedback error" style={{ marginBottom: 16 }}>
          {error} <button className="text-action" onClick={loadNotifications}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          Loading your notifications…
        </div>
      ) : notifications.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notifications.map(item => (
            <div
              key={item.id}
              className="card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
                padding: '16px 20px',
                borderLeft: !item.read ? '4px solid var(--accent)' : '1px solid var(--border-glass)',
                background: !item.read ? 'rgba(124, 77, 255, 0.03)' : 'var(--bg-card)',
              }}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ fontSize: '1.6rem', lineHeight: 1 }}>{categoryIcon(item.category)}</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ fontSize: '0.95rem', margin: 0, fontWeight: item.read ? 600 : 700 }}>
                      {item.title}
                    </h3>
                    {!item.read && (
                      <span className="tag tag-accent" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                        New
                      </span>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 6px 0' }}>
                    {item.body}
                  </p>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {item.created_at ? new Date(item.created_at).toLocaleString() : 'Recently'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {item.route && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => nav(item.route)}
                  >
                    View →
                  </button>
                )}
                {!item.read && (
                  <button
                    className="btn btn-sm"
                    style={{ background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}
                    onClick={() => handleMarkOne(item.id)}
                    title="Mark read"
                  >
                    ✓
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✨</div>
          <h3 style={{ marginBottom: 6 }}>All caught up!</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            You have no notifications right now. Complete circuit challenges or advance along the roadmap to earn milestone notifications.
          </p>
        </div>
      )}
    </div>
  );
}
