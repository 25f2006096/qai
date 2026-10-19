import { useProgress } from '../../context/ProgressContext.jsx';
import { ACHIEVEMENTS } from '../../data/modules.js';
import AITutor from '../../components/ai/AITutor.jsx';

const QUANTUM_ARTIFACTS = [
  { id: 'superposition-core', name: 'Superposition Core', icon: '🌀', desc: 'A stabilized single-qubit quantum state in pure superposition.', req: 'Complete Module 2 or Create a Superposition', isUnlocked: (p, g) => (p?.completedModules?.includes(2) || (g?.missions || []).some(m => m.id === 'build-superposition' && m.status === 'completed')) },
  { id: 'entanglement-prism', name: 'Entanglement Prism', icon: '💎', desc: 'A pair of Bell-state correlated qubits entangled across space.', req: 'Complete Module 4 or Build a Bell State', isUnlocked: (p, g) => (p?.completedModules?.includes(4) || (g?.missions || []).some(m => m.id === 'build-bell-state' && m.status === 'completed')) },
  { id: 'teleportation-tome', name: 'Teleportation Tome', icon: '📜', desc: 'Ancient manuscript detailing quantum state transfer protocol.', req: 'Complete Module 9 (Fundamental Algorithms)', isUnlocked: (p) => p?.completedModules?.includes(9) },
  { id: 'grover-compass', name: 'Grover Search Compass', icon: '🧭', desc: 'An oracle-guided amplitude amplifier locating items in √N queries.', req: 'Complete Module 10 (Advanced Algorithms)', isUnlocked: (p) => p?.completedModules?.includes(10) },
  { id: 'qml-lattice', name: 'Quantum Neural Lattice', icon: '🕸️', desc: 'A parameterized variational circuit trained for quantum machine learning.', req: 'Complete Module 11 (Quantum Machine Learning)', isUnlocked: (p) => p?.completedModules?.includes(11) },
  { id: 'surface-aegis', name: 'Surface Code Aegis', icon: '🛡️', desc: 'Fault-tolerant topological syndrome measurement shield.', req: 'Complete Module 13 (Quantum Error Correction)', isUnlocked: (p) => p?.completedModules?.includes(13) },
  { id: 'transmon-qubit', name: 'Superconducting Transmon', icon: '⚡', desc: 'A physical Josephson-junction cryogenic quantum hardware artifact.', req: 'Complete Module 15 (Quantum Hardware)', isUnlocked: (p) => p?.completedModules?.includes(15) },
  { id: 'hamiltonian-orb', name: 'Hamiltonian Chronicle Orb', icon: '🔮', desc: 'Full-depth Trotterized quantum simulation of molecular systems.', req: 'Complete Module 24 (Quantum Simulation)', isUnlocked: (p) => p?.completedModules?.includes(24) },
];

export default function Achievements() {
  const { progress, gamification, gamificationLoading, gamificationError, refreshGamification } = useProgress();
  const verifiedAchievements = gamification?.achievements || [];

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title">🏆 Achievements & Artifacts</h1>
        <p className="page-subtitle">Verified badges are awarded by trusted mission validation. Collect quantum artifacts and track course milestones.</p>
      </div>

      {/* Quantum Artifacts Collection */}
      <section className="card" style={{ marginBottom: 24 }} aria-labelledby="quantum-artifacts-heading">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div>
            <h2 id="quantum-artifacts-heading" style={{ fontSize: '1.05rem' }}>🔮 Quantum Artifact Collection</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '.82rem', marginTop: 4 }}>Rare artifacts unlocked through conceptual breakthroughs, verified missions, and algorithmic mastery.</p>
          </div>
          <span className="tag tag-accent">
            {QUANTUM_ARTIFACTS.filter(a => a.isUnlocked(progress, gamification)).length} / {QUANTUM_ARTIFACTS.length} Collected
          </span>
        </div>
        <div className="grid grid-4" style={{ gap: 16 }}>
          {QUANTUM_ARTIFACTS.map(artifact => {
            const unlocked = artifact.isUnlocked(progress, gamification);
            return (
              <div
                key={artifact.id}
                className={`achievement-badge ${unlocked ? 'unlocked' : 'locked'}`}
                style={{
                  padding: 16,
                  textAlign: 'center',
                  background: unlocked ? 'rgba(124, 77, 255, 0.08)' : 'var(--bg-glass)',
                  border: unlocked ? '1px solid var(--accent)' : '1px dashed var(--border-glass)',
                  borderRadius: 12,
                }}
              >
                <div style={{ fontSize: '2.4rem', marginBottom: 8, filter: unlocked ? 'none' : 'grayscale(100%) opacity(40%)' }}>
                  {artifact.icon}
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 4 }}>{artifact.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>{artifact.desc}</div>
                <span className={`tag ${unlocked ? 'tag-success' : 'tag-info'}`} style={{ fontSize: '0.7rem' }}>
                  {unlocked ? '✓ In Collection' : artifact.req}
                </span>
              </div>
            );
          })}
        </div>
      </section>

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
