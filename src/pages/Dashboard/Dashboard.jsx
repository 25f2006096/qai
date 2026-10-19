import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useProgress } from '../../context/ProgressContext.jsx';
import { MODULES, SKILL_LABELS, ACHIEVEMENTS } from '../../data/modules.js';
import { getNextModule } from '../../utils/adaptive.js';
import { levelForXp, missionLabel } from '../../utils/gamification.js';
import AITutor from '../../components/ai/AITutor.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const { progress, skills, gamification, gamificationLoading, gamificationError, refreshGamification, getOverallKnowledge } = useProgress();
  const nav = useNavigate();
  const knowledge = getOverallKnowledge();
  const nextMod = progress && skills ? getNextModule(progress, skills, user?.goal) : null;
  const completedCount = progress?.completedModules?.length || 0;
  const localLevel = levelForXp(user?.total_xp || 0);
  const level = gamification?.level || {
    number: localLevel.number,
    name: localLevel.name,
    next_threshold: localLevel.nextThreshold,
    progress_percent: localLevel.progressPercent,
  };
  const totalXp = gamification?.total_xp ?? user?.total_xp ?? 0;
  const streak = gamification?.current_streak ?? user?.current_streak ?? 0;
  const nextMission = gamification?.next_mission;
  const earnedMissionBadges = gamification?.achievements || [];
  const dailyQuests = gamification?.daily_quests || [
    { id: 'daily-sim', title: 'Quantum Experimenter', description: 'Simulate at least 1 circuit or run an experiment today.', target: 1, progress: 0, completed: false, xp_reward: 15, icon: '🔬' },
    { id: 'daily-quiz', title: 'Knowledge Seeker', description: 'Answer at least 3 practice questions or assessment checkpoints.', target: 3, progress: 0, completed: false, xp_reward: 20, icon: '📝' },
    { id: 'daily-mission', title: 'Mission Specialist', description: 'Complete 1 verified circuit mission.', target: 1, progress: 0, completed: false, xp_reward: 25, icon: '🎯' },
  ];
  const leaderboard = gamification?.leaderboard || [];

  const weakSkills = skills ? Object.entries(skills).filter(([, v]) => v < 40 && v > 0).sort((a, b) => a[1] - b[1]).slice(0, 3) : [];
  const strongSkills = skills ? Object.entries(skills).filter(([, v]) => v >= 60).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];

  const unlockedAchievements = progress ? ACHIEVEMENTS.filter(a => a.condition(progress)) : [];

  const recentModules = MODULES.filter(m => progress?.completedModules?.includes(m.id)).slice(-3);

  return (
    <div className="page fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: 4 }}>Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Goal: <span style={{ color: 'var(--accent-light)' }}>{user?.goal || 'Learning quantum computing'}</span></p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Streak</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>🔥 {streak}</div>
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
          <div className="stat-value">{progress?.questionsAnswered || 0}</div>
          <div className="stat-label">Questions Answered</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{unlockedAchievements.length}</div>
          <div className="stat-label">Achievements</div>
        </div>
      </div>

      {/* Compact server-authoritative gamification summary */}
      <div className="grid grid-2" style={{ marginBottom: 28 }}>
        <section className="card" aria-labelledby="level-progress-heading">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div id="level-progress-heading" style={{ fontSize: '0.75rem', color: 'var(--accent-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>⚡ Learning Progress</div>
              <h3 style={{ marginTop: 6 }}>Level {level.number}: {level.name}</h3>
            </div>
            <div className="tag tag-accent">{totalXp} XP</div>
          </div>
          <div className="progress-bar" aria-label={`Level progress: ${level.progress_percent || 0}%`}>
            <div className="progress-fill" style={{ width: `${level.progress_percent || 0}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>{level.progress_percent || 0}% to next level</span>
            <span>{level.next_threshold ? `${totalXp} / ${level.next_threshold} XP` : 'Maximum level reached'}</span>
          </div>
          {gamificationError && (
            <div role="status" style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--warning)' }}>
              Rewards are unavailable right now. <button className="text-action" onClick={refreshGamification}>Retry</button>
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="next-mission-heading">
          <div id="next-mission-heading" style={{ fontSize: '0.75rem', color: 'var(--accent-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>🎯 Your Next Mission</div>
          {gamificationLoading && !gamification ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading your verified missions…</p>
          ) : nextMission ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <h3>{nextMission.title}</h3>
                <span className="tag tag-accent">+{nextMission.xp_reward} XP</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.5 }}>{nextMission.description}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <span className="tag tag-info">{nextMission.estimated_minutes} min</span>
                <span className="tag tag-info">{missionLabel(nextMission.status)}</span>
                <button className="btn btn-primary btn-sm" onClick={() => nav(nextMission.route)}>Open Mission →</button>
              </div>
            </>
          ) : gamification ? (
            <>
              <h3>All verified missions complete</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginTop: 6 }}>Keep exploring the curriculum, lab, and contests to deepen your skills.</p>
            </>
          ) : (
            <>
              <h3>Continue your learning path</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginTop: 6 }}>Verified circuit missions appear here when reward services are available.</p>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => nav('/circuit')}>Open Circuit Builder</button>
            </>
          )}
        </section>
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
      </div>

      {/* Daily Quests & Weekly Leaderboard */}
      <div className="grid grid-2" style={{ marginBottom: 28 }}>
        {/* Daily Quests */}
        <section className="card" aria-labelledby="daily-quests-heading">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div id="daily-quests-heading" style={{ fontSize: '0.75rem', color: 'var(--accent-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              ⚡ Daily Quests
            </div>
            <span className="tag tag-info">Resets daily</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dailyQuests.map(quest => (
              <div key={quest.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                <span style={{ fontSize: '1.4rem' }}>{quest.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <strong style={{ fontSize: '0.85rem' }}>{quest.title}</strong>
                    <span className={`tag ${quest.completed ? 'tag-success' : 'tag-accent'}`} style={{ fontSize: '0.7rem' }}>
                      {quest.completed ? '✓ Completed' : `+${quest.xp_reward} XP`}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{quest.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Weekly Leaderboard */}
        <section className="card" aria-labelledby="leaderboard-heading">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div id="leaderboard-heading" style={{ fontSize: '0.75rem', color: 'var(--accent-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              🏆 Top Learners (Weekly)
            </div>
            <span className="tag tag-info">Verified XP</span>
          </div>
          {leaderboard.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {leaderboard.slice(0, 5).map(entry => (
                <div key={entry.rank} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 22, fontWeight: 700, color: entry.rank === 1 ? '#eab308' : entry.rank === 2 ? '#94a3b8' : entry.rank === 3 ? '#d97706' : 'var(--text-muted)', fontSize: '0.85rem' }}>
                      #{entry.rank}
                    </span>
                    <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>{entry.display_name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {entry.current_streak > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>🔥 {entry.current_streak}d</span>}
                    <span className="tag tag-accent" style={{ fontSize: '0.75rem' }}>{entry.total_xp} XP</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '12px 0' }}>
              Complete verified missions and quizzes to place on the weekly leaderboard!
            </p>
          )}
        </section>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 28 }}>
        {/* Strong Areas */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: '0.9rem' }}>💪 Strong Areas</div>
          {strongSkills.length > 0 ? strongSkills.map(([s, v]) => (
            <div key={s} className="tag tag-success" style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span>✓ {SKILL_LABELS[s]}</span><span>{v}%</span>
            </div>
          )) : <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Complete the assessment to see your strengths</div>}
        </div>

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

      {/* Achievements */}
      {(earnedMissionBadges.length > 0 || unlockedAchievements.length > 0) && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 16 }}>🏆 Recent Achievements</div>
          <div className="grid grid-4">
            {[...earnedMissionBadges, ...unlockedAchievements.filter(a => !earnedMissionBadges.some(earned => earned.id === a.id))].slice(0, 4).map(a => (
              <div key={a.id} className="achievement-badge unlocked">
                <div className="achievement-icon">{a.icon}</div>
                <div className="achievement-name">{a.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AITutor />
    </div>
  );
}
