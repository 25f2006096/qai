import { useProgress } from '../../context/ProgressContext.jsx';
import { ACHIEVEMENTS } from '../../data/modules.js';
import AITutor from '../../components/ai/AITutor.jsx';

export default function Achievements() {
  const { progress, gamification, gamificationLoading, gamificationError, refreshGamification } = useProgress();
  const verifiedAchievements = gamification?.achievements || [];

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title">🏆 Achievements & Badges</h1>
        <p className="page-subtitle">Verified badges are awarded by trusted mission validation. Course milestones reflect your current learning progress.</p>
      </div>

      {verifiedAchievements.length > 0 && (
        <section className="card" style={{ marginBottom: 24 }} aria-labelledby="verified-achievements-heading">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div>
              <h2 id="verified-achievements-heading" style={{ fontSize: '1.05rem' }}>✨ Verified achievements</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '.82rem', marginTop: 4 }}>Unlocked by trusted mission validation and saved to your learner record.</p>
            </div>
            <span className="tag tag-success">{verifiedAchievements.length} earned</span>
          </div>
          <div className="grid grid-4">
            {verifiedAchievements.map(achievement => (
              <div key={achievement.id} className="achievement-badge unlocked">
                <div className="achievement-icon">{achievement.icon}</div>
                <div className="achievement-name">{achievement.name}</div>
                <div className="achievement-desc" style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{achievement.description}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {gamificationLoading && !gamification && <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Loading verified achievement records…</p>}
      {gamificationError && (
        <div className="mission-feedback error" role="status" style={{ marginBottom: 16 }}>
          Unable to load verified achievement records. <button className="text-action" onClick={refreshGamification}>Retry</button>
        </div>
      )}

      <section aria-labelledby="course-milestones-heading">
        <div style={{ marginBottom: 14 }}>
          <h2 id="course-milestones-heading" style={{ fontSize: '1.05rem' }}>📚 Course milestones</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.82rem', marginTop: 4 }}>Calculated from your module and learning activity progress; these are not server-verified reward records.</p>
        </div>
        <div className="grid grid-3">
        {ACHIEVEMENTS.map(a => {
          const unlocked = progress ? a.condition(progress) : false;
          return (
            <div key={a.id} className={`achievement-badge ${unlocked ? 'unlocked' : 'locked'}`} style={{ padding: 24, textAlign: 'center' }}>
              <div className="achievement-icon" style={{ fontSize: '3rem', marginBottom: 12 }}>{a.icon}</div>
              <div className="achievement-name" style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>{a.name}</div>
              <div className="achievement-desc" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{a.desc}</div>
              <div style={{ marginTop: 12 }}>
                <span className={`tag ${unlocked ? 'tag-success' : 'tag-info'}`}>
                  {unlocked ? '✓ Unlocked' : '🔒 Locked'}
                </span>
              </div>
            </div>
          );
        })}
        </div>
      </section>

      <AITutor />
    </div>
  );
}
