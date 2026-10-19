import { useNavigate } from 'react-router-dom';
import { useProgress } from '../../context/ProgressContext.jsx';
import { MODULES, MODULE_CATEGORIES } from '../../data/modules.js';
import { missionLabel } from '../../utils/gamification.js';
import AITutor from '../../components/ai/AITutor.jsx';

export default function ModuleList() {
  const nav = useNavigate();
  const { progress, gamification } = useProgress();
  const missionByModule = (gamification?.missions || []).reduce((lookup, mission) => {
    if (mission.id === 'build-superposition') lookup[2] = mission;
    if (mission.id === 'build-bell-state') lookup[4] = mission;
    return lookup;
  }, {});

  const getStatus = (mod) => {
    if (progress?.completedModules?.includes(mod.id)) return 'completed';
    const prereqsMet = mod.prereqs.every(p => progress?.completedModules?.includes(p));
    if (prereqsMet || mod.prereqs.length === 0) return 'available';
    return 'locked';
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title">📚 All Modules</h1>
        <p className="page-subtitle">24 comprehensive modules from quantum foundations to advanced research</p>
      </div>
      {MODULE_CATEGORIES.map(cat => {
        const mods = MODULES.filter(m => m.category === cat);
        return (
          <div key={cat} style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
              {cat === 'Foundations' ? '🧱' : cat === 'Intermediate' ? '📐' : cat === 'Advanced' ? '🚀' : '⭐'} {cat}
            </h2>
            <div className="grid grid-3">
              {mods.map(mod => {
                const status = getStatus(mod);
                const score = progress?.moduleScores?.[mod.id];
                const mission = missionByModule[mod.id];
                return (
                  <div
                    key={mod.id}
                    className={`module-card ${status === 'locked' ? 'locked' : ''}`}
                    onClick={() => status !== 'locked' && nav(`/modules/${mod.id}`)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span className="module-num">Module {mod.id}</span>
                      <span style={{ fontSize: '1rem' }}>
                        {status === 'completed' ? '✅' : status === 'locked' ? '🔒' : '▶'}
                      </span>
                    </div>
                    <div className="module-title">{mod.title}</div>
                    <div className="module-desc">{mod.desc}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="tag tag-accent" style={{ fontSize: '0.7rem' }}>{cat}</div>
                      {score !== undefined && (
                        <div className="tag tag-success" style={{ fontSize: '0.7rem' }}>{score}%</div>
                      )}
                    </div>
                    {mod.prereqs.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Prereqs: {mod.prereqs.map(p => `M${p}`).join(', ')}
                      </div>
                    )}
                    {mission && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>🎯 {mission.title}</span>
                        <span className={`tag ${['completed', 'mastered'].includes(mission.status) ? 'tag-success' : 'tag-accent'}`} style={{ fontSize: '0.68rem' }}>
                          {['completed', 'mastered'].includes(mission.status) ? missionLabel(mission.status) : `+${mission.xp_reward} XP`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <AITutor />
    </div>
  );
}
