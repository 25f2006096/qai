import { useState, useEffect, useRef } from 'react';
import { useProgress } from '../../context/ProgressContext.jsx';

export default function AchievementNotification() {
  const [notification, setNotification] = useState(null);
  const [visible, setVisible] = useState(false);
  const processedAchievements = useRef(new Set());
  const { gamification } = useProgress();

  useEffect(() => {
    const latest = (gamification?.achievements || []).find((achievement) => !processedAchievements.current.has(achievement.id));
    if (!latest) return undefined;
    processedAchievements.current.add(latest.id);
    setNotification(latest);
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [gamification?.achievements]);

  if (!visible || !notification) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 1000,
        animation: 'slideIn 0.5s ease-out',
      }}
    >
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(124, 77, 255, 0.15) 0%, rgba(33, 150, 243, 0.15) 100%)',
          border: '1px solid var(--accent)',
          padding: 16,
          minWidth: 300,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ fontSize: '2.5rem' }}>{notification.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-light)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            Achievement Unlocked!
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 2 }}>{notification.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{notification.desc}</div>
        </div>
        <button
          onClick={() => setVisible(false)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '1.2rem',
            padding: 4,
          }}
        >
          ×
        </button>
      </div>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
