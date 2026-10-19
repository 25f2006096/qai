import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useProgress } from '../../context/ProgressContext.jsx';
import { MODULES, SKILL_LABELS, ACHIEVEMENTS } from '../../data/modules.js';
import { getNextModule } from '../../utils/adaptive.js';
import { getProgressToNextLevel } from '../../utils/gamification.js';
import { getWeeklyLeaderboard } from '../../services/quantumApi.js';
import AITutor from '../../components/ai/AITutor.jsx';
import AchievementNotification from '../../components/gamification/AchievementNotification.jsx';
import { getWorldMap } from '../../utils/worldMap.js';

export default function Dashboard() {
  const { user } = useAuth();
  const { progress, skills, gamification, getOverallKnowledge } = useProgress();
  const nav = useNavigate();
  const knowledge = getOverallKnowledge();
  const nextMod = progress && skills ? getNextModule(progress, skills, user?.goal) : null;
  const completedCount = progress?.completedModules?.length || 0;
  const dailyQuests = gamification?.daily_quests || [];
  const weeklyQuests = gamification?.weekly_quests || [];
  const rewardHistory = gamification?.reward_history || [];
  const loadingQuests = false;
  const [weeklyBoard, setWeeklyBoard] = useState(null);

  // Gamification state with safe defaults
  const totalXP = gamification?.total_xp ?? user?.total_xp ?? 0;
  const level = gamification?.level?.number ?? gamification?.level ?? user?.level ?? 1;
  const levelProgress = getProgressToNextLevel(totalXP);

  const weakSkills = skills ? Object.entries(skills).filter(([, v]) => v < 40 && v > 0).sort((a, b) => a[1] - b[1]).slice(0, 3) : [];
  const strongSkills = skills ? Object.entries(skills).filter(([, v]) => v >= 60).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];

  const unlockedAchievements = progress ? ACHIEVEMENTS.filter(a => a.condition(progress)) : [];
  const verifiedAchievements = gamification?.achievements || [];

  const recentModules = MODULES.filter(m => progress?.completedModules?.includes(m.id)).slice(-3);
  const nextRegion = getWorldMap(progress).find(region => region.state === 'available');

  useEffect(() => {
    let active = true;
    getWeeklyLeaderboard().then(response => {
      if (active) setWeeklyBoard(response?.leaderboard || null);
    }).catch(() => {
      if (active) setWeeklyBoard(null);
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="page fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: 4 }}>Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Goal: <span style={{ color: 'var(--accent-light)' }}>{user?.goal || 'Learning quantum computing'}</span></p>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Level</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent)' }}>{level}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{gamification?.level?.name || 'Quantum Initiate'} · {totalXP} verified XP</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Streak</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>🔥 {progress?.streak || 0}</div>
          </div>
        </div>
      </div>

      {/* Solution Vision Card */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(124, 77, 255, 0.1) 0%, rgba(33, 150, 243, 0.1) 100%)', border: '1px solid var(--border-glass)', marginBottom: 28 }}>
        <h3 style={{ color: 'var(--accent-light)', marginBottom: 8, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✨</span> AI-Powered Adaptive Learning Platform
        </h3>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          Welcome to your personalized quantum learning environment. The platform uses a <strong>Quantum Skill Assessment</strong> to map your knowledge across math, programming, algorithms, and hardware, and constructs a <strong>personalized learning roadmap</strong>. Experience interactive lesson modules, official documentation courses, drag-and-drop <strong>quantum circuit building</strong>, and our integrated <strong>Quantum Lab</strong> for running both simulators and real quantum hardware.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-4" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-value">{knowledge}%</div>
          <div className="stat-label">Quantum Knowledge</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{completedCount}/24</div>
          <div className="stat-label">Modules Done</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalXP}</div>
          <div className="stat-label">Total XP</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{verifiedAchievements.length}</div>
          <div className="stat-label">Verified Badges</div>
        </div>
      </div>

      {/* Level Progress */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-light)' }}>Level {level} Progress</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{levelProgress.current} / {levelProgress.total} XP</span>
        </div>
        <div className="progress-bar" style={{ height: 8 }}>
          <div className="progress-fill success" style={{ width: `${levelProgress.percentage}%` }} />
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 28 }}>
        {/* Continue Learning */}
        <div className="card card-glow" style={{ cursor: 'pointer' }} onClick={() => nextMod && nav(`/modules/${nextMod.id}`)}>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>▶ Continue Learning</div>
          {nextMod ? (
            <>
              <h3 style={{ marginBottom: 6 }}>Module {nextMod.id}: {nextMod.title}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{nextMod.desc}</p>
              <div style={{ marginTop: 16 }}>
                <button className="btn btn-primary btn-sm">Continue →</button>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--success)', fontWeight: 700 }}>🎉 All recommended modules complete!</div>
          )}
        </div>

        {/* Quests (Daily & Weekly) */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>📋 Active Quests</div>
            <span className="tag tag-info" style={{ fontSize: '0.7rem' }}>Daily & Weekly</span>
          </div>
          {loadingQuests ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading quests...</div>
          ) : (dailyQuests.length > 0 || weeklyQuests.length > 0) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...dailyQuests, ...weeklyQuests].map(quest => (
                <button key={quest.id} type="button" onClick={() => quest.route && nav(quest.route)} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: 8, color: 'inherit', textAlign: 'left', cursor: quest.route ? 'pointer' : 'default' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{quest.title}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{quest.description}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{quest.current_count} / {quest.target_count}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>+{quest.xp_reward} XP</span>
                    {quest.completed ? (
                      <span style={{ fontSize: '1rem' }}>✅</span>
                    ) : (
                      <div className="progress-bar" style={{ width: 60, height: 4 }}>
                        <div className="progress-fill" style={{ width: `${Math.min((quest.current_count / quest.target_count) * 100, 100)}%` }} />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No quests available</div>
          )}
        </div>
      </div>

      {nextRegion && (
        <section className="card" style={{ marginBottom: 28, borderLeft: '4px solid var(--accent)' }} aria-labelledby="world-map-preview-heading">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '.75rem', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Quantum World Map</div>
              <h2 id="world-map-preview-heading" style={{ fontSize: '1.2rem', margin: '5px 0' }}>{nextRegion.icon} {nextRegion.name}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>{nextRegion.description}</p>
            </div>
            <button className="btn btn-secondary" onClick={() => nav('/world-map')}>Open map →</button>
          </div>
        </section>
      )}

      <div className="grid grid-2" style={{ marginBottom: 28 }}>
        <section className="card" aria-labelledby="weekly-learning-board-heading">
          <h2 id="weekly-learning-board-heading" style={{ fontSize: '1rem', margin: 0 }}>Weekly learning leaderboard</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '.76rem', margin: '4px 0 10px' }}>Ranks verified learning XP earned this UTC week. Contest ratings are separate.</p>
          {weeklyBoard?.entries?.length ? (
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
              {weeklyBoard.entries.slice(0, 5).map(entry => (
                <li key={entry.user_id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-glass)' }}>
                  <strong>#{entry.rank}</strong><span>{entry.display_name}{entry.is_viewer ? ' (you)' : ''}</span><span style={{ color: 'var(--accent)', fontWeight: 700 }}>{entry.weekly_xp} XP</span>
                </li>
              ))}
            </ol>
          ) : <p style={{ color: 'var(--text-muted)', fontSize: '.84rem', margin: 0 }}>The verified weekly leaderboard is unavailable until its database migration is applied and the service is configured.</p>}
        </section>

        <section className="card" aria-labelledby="reward-history-heading">
          <h2 id="reward-history-heading" style={{ fontSize: '1rem', margin: 0 }}>⚡ Verified Reward Feed</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '.76rem', margin: '4px 0 10px' }}>Server-confirmed learning accomplishments and XP transactions.</p>
          {rewardHistory.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
              {rewardHistory.slice(0, 5).map((r, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-glass)', fontSize: '0.82rem' }}>
                  <span>
                    <strong style={{ textTransform: 'capitalize' }}>{r.event_type.replace('_', ' ')}</strong>: {r.event_key}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Recent'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '.84rem', margin: 0 }}>
              No verified rewards recorded yet. Complete a circuit mission or contest challenge to earn server-verified rewards.
            </p>
          )}
        </section>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 28 }}>
        {/* Knowledge Radar placeholder */}
        <div className="card">
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>📊 Top Skills</div>
          {Object.entries(skills || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([skill, val]) => (
            <div key={skill} className="skill-bar-item" style={{ marginBottom: 10 }}>
              <div className="skill-bar-header">
                <span className="skill-bar-label" style={{ fontSize: '0.8rem' }}>{SKILL_LABELS[skill]}</span>
                <span className="skill-bar-value" style={{ fontSize: '0.8rem' }}>{val}%</span>
              </div>
              <div className="progress-bar" style={{ height: 6 }}>
                <div className={`progress-fill ${val >= 70 ? 'success' : ''}`} style={{ width: `${val}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Strong Areas */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: '0.9rem' }}>💪 Strong Areas</div>
          {strongSkills.length > 0 ? strongSkills.map(([s, v]) => (
            <div key={s} className="tag tag-success" style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span>✓ {SKILL_LABELS[s]}</span><span>{v}%</span>
            </div>
          )) : <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Complete the assessment to see your strengths</div>}
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 28 }}>
        {/* Needs Improvement */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: '0.9rem' }}>⚠ Needs Work</div>
          {weakSkills.length > 0 ? weakSkills.map(([s, v]) => (
            <div key={s} className="tag tag-warning" style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span>⚠ {SKILL_LABELS[s]}</span><span>{v}%</span>
            </div>
          )) : <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No major weak areas yet — great job!</div>}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: '0.9rem' }}>🚀 Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => nav('/roadmap')}>🗺️ View My Roadmap</button>
            <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => nav('/circuit')}>⚡ Circuit Builder</button>
            <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => nav('/lab')}>🔬 Quantum Lab</button>
          </div>
        </div>

        {/* Course milestones */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: '0.9rem' }}>📚 Course Milestones</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '.75rem', marginBottom: 12 }}>Derived from your current curriculum progress. Verified mission badges appear on the Achievements page.</p>
          <div className="grid grid-2">
            {unlockedAchievements.slice(0, 4).map(a => (
              <div key={a.id} className="achievement-badge unlocked">
                <div className="achievement-icon">{a.icon}</div>
                <div className="achievement-name">{a.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Modules */}
      {recentModules.length > 0 && (
        <div className="card" style={{ marginBottom: 28 }}>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>✅ Recently Completed</div>
          <div className="grid grid-3">
            {recentModules.map(m => (
              <div key={m.id} className="module-card" onClick={() => nav(`/modules/${m.id}`)}>
                <div className="module-num">Module {m.id}</div>
                <div className="module-title">{m.title}</div>
                <div className="tag tag-success" style={{ marginTop: 8 }}>✓ Completed</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AITutor />
      <AchievementNotification />
    </div>
  );
}
