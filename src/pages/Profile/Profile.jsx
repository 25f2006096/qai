import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useProgress } from '../../context/ProgressContext.jsx';
import { MODULES, GOALS, EDUCATION_LEVELS } from '../../data/modules.js';
import { getRankTitle, getProgressToNextLevel } from '../../utils/gamification.js';
import { storage } from '../../utils/storage.js';

const COSMETIC_AVATARS = [
  { id: 'qubit', name: 'Qubit Initiate', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Qubit' },
  { id: 'schrodinger', name: 'Schrödinger', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Schrodinger' },
  { id: 'superposition', name: 'Superposition', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Superposition' },
  { id: 'entangled', name: 'Entangled Pair', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Entangled' },
  { id: 'hadamard', name: 'Hadamard Core', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Hadamard' },
  { id: 'bloch', name: 'Bloch Sphere', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bloch' },
  { id: 'bell', name: 'Bell State', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bell' },
  { id: 'feynman', name: 'Feynman Unit', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Feynman' },
];

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { progress, gamification, getOverallKnowledge } = useProgress();
  const nav = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [goal, setGoal] = useState(user?.goal || GOALS[0]);
  const [education, setEducation] = useState(user?.education || EDUCATION_LEVELS[1]);
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar_url || COSMETIC_AVATARS[0].url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activityDays, setActivityDays] = useState({});

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      if (user.goal) setGoal(user.goal);
      if (user.education) setEducation(user.education);
      if (user.avatar_url) setSelectedAvatar(user.avatar_url);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;
    if (user?.id) {
      storage.getActivityLog(user.id).then(log => {
        if (mounted) setActivityDays(log || {});
      }).catch(() => {});
    }
    return () => { mounted = false; };
  }, [user?.id]);

  const totalXP = gamification?.total_xp ?? user?.total_xp ?? 0;
  const level = gamification?.level?.number ?? 1;
  const rank = getRankTitle(totalXP);
  const levelProgress = getProgressToNextLevel(totalXP);
  const overallKnowledge = getOverallKnowledge();
  const completedModuleIds = progress?.completedModules || [];
  const completedCount = completedModuleIds.length;
  const verifiedAchievements = gamification?.achievements || [];

  const handleAvatarSelect = (url) => {
    setSelectedAvatar(url);
  };

  const handleCustomUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Avatar image must be smaller than 2MB.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const publicUrl = await storage.uploadAvatar(user.id, file);
      if (publicUrl) {
        setSelectedAvatar(publicUrl);
        await updateUser({ avatar_url: publicUrl });
        setMessage('Custom avatar uploaded and applied.');
      } else {
        setError('Avatar upload failed. Please verify storage configuration.');
      }
    } catch (err) {
      setError(err.message || 'Avatar upload error.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!name.trim()) {
      setError('Display name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await updateUser({
        name: name.trim(),
        goal,
        education,
        avatar_url: selectedAvatar,
      });
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3500);
    } catch (err) {
      setError(err.message || 'Unable to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (n) => {
    if (!n) return '?';
    return n.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="page fade-in" style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header Profile Summary */}
      <div className="card" style={{ marginBottom: 24, padding: 24, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between', borderLeft: '5px solid var(--accent)' }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--accent)', background: 'var(--bg-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {selectedAvatar ? (
              <img src={selectedAvatar} alt={user?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <span style={{ fontSize: '1.8rem', fontWeight: 700 }}>{getInitials(name)}</span>
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: '1.7rem', margin: 0 }}>{user?.name || 'Quantum Learner'}</h1>
              <span className={`tag ${user?.isAdmin ? 'tag-warning' : user?.isInstructor ? 'tag-success' : 'tag-info'}`}>
                {user?.isAdmin ? '⚙️ Admin' : user?.isInstructor ? '🎓 Instructor' : '🎓 Student'}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: '0.9rem' }}>
              {user?.email} · Joined {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Recently'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ textAlign: 'center', padding: '8px 16px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Level & Rank</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)' }}>Lvl {level}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{rank}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 16px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total XP</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>⚡ {totalXP}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Verified</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 16px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current Streak</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444' }}>🔥 {user?.current_streak || 0}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Days</div>
          </div>
        </div>
      </div>

      {/* Level progression bar */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Level {level} Progress to Level {level + 1}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{levelProgress.current} / {levelProgress.total} XP ({levelProgress.percentage}%)</span>
        </div>
        <div className="progress-bar" style={{ height: 8 }}>
          <div className="progress-fill success" style={{ width: `${levelProgress.percentage}%` }} />
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 24, marginBottom: 24 }}>
        {/* Profile Settings Form */}
        <div className="card">
          <h2 style={{ fontSize: '1.15rem', marginBottom: 16 }}>👤 Edit Profile & Preferences</h2>

          {error && <div className="tag tag-danger" style={{ marginBottom: 12, padding: 8, display: 'block' }}>{error}</div>}
          {message && <div className="tag tag-success" style={{ marginBottom: 12, padding: 8, display: 'block' }}>{message}</div>}

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                className="form-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Learning Goal</label>
              <select
                className="form-select"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              >
                {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Education Level</label>
              <select
                className="form-select"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
              >
                {EDUCATION_LEVELS.map(ed => <option key={ed} value={ed}>{ed}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Registered Account Email</label>
              <input
                className="form-input"
                type="email"
                value={user?.email || ''}
                disabled
                style={{ opacity: 0.7, cursor: 'not-allowed' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Email is managed via authentication security.</span>
            </div>

            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving changes...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>

        {/* Avatar Customization */}
        <div className="card">
          <h2 style={{ fontSize: '1.15rem', marginBottom: 12 }}>🎨 Avatar Customization</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Select a cosmetic quantum persona or upload your personal avatar image.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {COSMETIC_AVATARS.map((av) => (
              <button
                key={av.id}
                type="button"
                onClick={() => handleAvatarSelect(av.url)}
                style={{
                  border: selectedAvatar === av.url ? '2px solid var(--accent)' : '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 8,
                  background: selectedAvatar === av.url ? 'rgba(124, 77, 255, 0.08)' : 'var(--bg-glass)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <img src={av.url} alt={av.name} style={{ width: 48, height: 48, borderRadius: '50%', marginBottom: 4 }} />
                <div style={{ fontSize: '0.7rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {av.name}
                </div>
              </button>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 14 }}>
            <label className="form-label">Upload Custom Image (PNG, JPG, WebP &lt; 2MB)</label>
            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleCustomUpload}
              disabled={uploading}
              className="form-input"
              style={{ fontSize: '0.85rem' }}
            />
            {uploading && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Uploading image to storage...</span>}
          </div>
        </div>
      </div>

      {/* Learning Analytics & Stats */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: 16 }}>📊 Learning Overview & Demonstrations</h2>
        <div className="grid grid-4" style={{ gap: 16, marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-value">{completedCount} / 24</div>
            <div className="stat-label">Modules Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{overallKnowledge}%</div>
            <div className="stat-label">Overall Knowledge Score</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{verifiedAchievements.length}</div>
            <div className="stat-label">Verified Badges</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{progress?.circuitsChallengesCompleted || 0}</div>
            <div className="stat-label">Circuit Challenges Solved</div>
          </div>
        </div>

        {/* Activity Heatmap Preview */}
        <div>
          <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>📅 Recent Learning Activity Days</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {Object.keys(activityDays).length > 0 ? (
              Object.entries(activityDays).slice(-14).map(([date, count]) => (
                <div key={date} style={{ padding: '6px 10px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: 6, fontSize: '0.75rem', textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-muted)' }}>{date}</div>
                  <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{count} action{count > 1 ? 's' : ''}</div>
                </div>
              ))
            ) : (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Activity is recorded when you complete lessons, circuits, and assessments.</span>
            )}
          </div>
        </div>
      </div>

      {/* Completed Modules List */}
      <div className="card">
        <h2 style={{ fontSize: '1.15rem', marginBottom: 12 }}>📚 Completed Modules ({completedCount})</h2>
        {completedCount > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {MODULES.filter(m => completedModuleIds.includes(m.id)).map(m => (
              <div key={m.id} style={{ padding: 12, border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>M{m.id}: {m.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.category} · Score: {progress?.moduleScores?.[m.id] || 100}%</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => nav(`/modules/${m.id}`)}>Review</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No modules completed yet. Head to your <button className="btn-link" style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => nav('/roadmap')}>Roadmap</button> to begin learning!
          </div>
        )}
      </div>
    </div>
  );
}
