import { useState, useRef, useEffect } from 'react';
import AITutor from '../../components/ai/AITutor.jsx';

const ALGORITHMS = {
  grover: {
    name: "Grover's Search",
    icon: '🔍',
    classicalName: 'Linear Search',
    quantumName: "Grover's Algorithm",
    classicalComplexity: 'O(N)',
    quantumComplexity: 'O(√N)',
    classicalSteps: (N) => N,
    quantumSteps: (N) => Math.ceil(Math.PI / 4 * Math.sqrt(N)),
    description: 'Find a target item in an unsorted database.',
    classicalDesc: 'Checks each item one-by-one sequentially.',
    quantumDesc: 'Uses superposition + amplitude amplification.',
    color: '#7c4dff',
    insight: (N, ct, qt) => `Classical linear search checked all ${ct} items. Grover's algorithm used quantum superposition to find the target in just ${qt} iterations — a ${(ct/qt).toFixed(1)}× speedup!`,
  },
  shor: {
    name: "Shor's Factoring",
    icon: '🔐',
    classicalName: 'Trial Division (GNFS)',
    quantumName: "Shor's Algorithm",
    classicalComplexity: 'O(exp(N^1/3))',
    quantumComplexity: 'O(N³)',
    classicalSteps: (N) => Math.ceil(Math.pow(Math.E, Math.pow(N, 1/3) * 1.5)),
    quantumSteps: (N) => Math.ceil(Math.pow(Math.log2(N + 2), 3) * 3),
    description: 'Factor a large integer N into its prime components.',
    classicalDesc: 'Uses General Number Field Sieve — exponential time.',
    quantumDesc: 'Uses quantum Fourier transform to find period — polynomial time.',
    color: '#f59e0b',
    insight: (N, ct, qt) => `Factoring a ${N}-bit number: classical took ${ct} steps (exponential). Shor's quantum algorithm solved it in ${qt} steps (polynomial). This threatens RSA encryption!`,
  },
  deutsch: {
    name: 'Deutsch-Jozsa',
    icon: '⚡',
    classicalName: 'Classical Sampling',
    quantumName: 'Deutsch-Jozsa',
    classicalComplexity: 'O(2^N)',
    quantumComplexity: 'O(1)',
    classicalSteps: (N) => Math.ceil(N / 2) + 1,
    quantumSteps: () => 1,
    description: 'Determine if a function is constant or balanced.',
    classicalDesc: 'Must query up to N/2 + 1 inputs to be certain.',
    quantumDesc: 'Solves the problem in exactly ONE quantum query.',
    color: '#10b981',
    insight: (N, ct, qt) => `Classical algorithm needed ${ct} queries. Deutsch-Jozsa required exactly ${qt} quantum query — an exponential ${ct}× speedup! This was the first provable quantum advantage.`,
  },
  simon: {
    name: "Simon's Algorithm",
    icon: '🎭',
    classicalName: 'Brute Force',
    quantumName: "Simon's Algorithm",
    classicalComplexity: 'O(2^(N/2))',
    quantumComplexity: 'O(N²)',
    classicalSteps: (N) => Math.ceil(Math.pow(2, N / 2)),
    quantumSteps: (N) => Math.ceil(N * N * 0.8),
    description: 'Find hidden bitstring s in a 2-to-1 function.',
    classicalDesc: 'Must try exponentially many inputs to find the period.',
    quantumDesc: 'Finds period using N quantum queries + linear algebra.',
    color: '#3b82f6',
    insight: (N, ct, qt) => `Brute force needed ${ct} queries (exponential). Simon's algorithm found the hidden period in ${qt} quantum queries — exponential speedup demonstrated!`,
  },
  hhl: {
    name: 'HHL Linear Systems',
    icon: '📐',
    classicalName: 'Gaussian Elimination',
    quantumName: 'HHL Algorithm',
    classicalComplexity: 'O(N³)',
    quantumComplexity: 'O(log N)',
    classicalSteps: (N) => Math.ceil(Math.pow(N, 3) / 100),
    quantumSteps: (N) => Math.ceil(Math.log2(N + 2) * 4),
    description: 'Solve a system of N linear equations Ax=b.',
    classicalDesc: 'Gaussian elimination — cubic time in matrix dimension.',
    quantumDesc: 'HHL algorithm — exponentially faster using quantum RAM.',
    color: '#ec4899',
    insight: (N, ct, qt) => `Solving N=${N} linear equations: classical took ${ct} steps (O(N³)). HHL quantum algorithm needed only ${qt} steps — an exponential log-factor speedup for large N!`,
  },
  qft: {
    name: 'Quantum Fourier Transform',
    icon: '🌊',
    classicalName: 'Fast Fourier Transform (FFT)',
    quantumName: 'Quantum Fourier Transform',
    classicalComplexity: 'O(N log N)',
    quantumComplexity: 'O(log² N)',
    classicalSteps: (N) => Math.ceil(N * Math.log2(N + 2) / 8),
    quantumSteps: (N) => Math.ceil(Math.pow(Math.log2(N + 2), 2) * 1.5),
    description: 'Compute the discrete Fourier transform.',
    classicalDesc: 'FFT is the fastest classical DFT — O(N log N).',
    quantumDesc: 'QFT achieves exponential compression — O(log² N) gates.',
    color: '#06b6d4',
    insight: (N, ct, qt) => `DFT on N=${N} elements: FFT needed ${ct} operations. QFT completed in ${qt} quantum operations — exponentially fewer gate operations!`,
  },
};

export default function QuantumRace() {
  const [selectedAlgo, setSelectedAlgo] = useState('grover');
  const [N, setN] = useState(64);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [classicalStep, setClassicalStep] = useState(0);
  const [quantumStep, setQuantumStep] = useState(0);
  const [classicalDone, setClassicalDone] = useState(false);
  const [quantumDone, setQuantumDone] = useState(false);
  const [classicalTime, setClassicalTime] = useState(0);
  const [quantumTime, setQuantumTime] = useState(0);
  const [activeTab, setActiveTab] = useState('race');
  const classicalRef = useRef(null);
  const quantumRef = useRef(null);

  const algo = ALGORITHMS[selectedAlgo];
  const classicalMax = algo.classicalSteps(N);
  const quantumMax = algo.quantumSteps(N);

  const reset = () => {
    setRunning(false); setFinished(false);
    setClassicalStep(0); setQuantumStep(0);
    setClassicalDone(false); setQuantumDone(false);
    setClassicalTime(0); setQuantumTime(0);
    if (classicalRef.current) clearTimeout(classicalRef.current);
    if (quantumRef.current) clearTimeout(quantumRef.current);
  };

  useEffect(() => { reset(); }, [selectedAlgo, N]);
  useEffect(() => () => { clearTimeout(classicalRef.current); clearTimeout(quantumRef.current); }, []);

  const startRace = () => {
    reset();
    setTimeout(() => {
      setRunning(true);
      const cMax = algo.classicalSteps(N);
      const qMax = algo.quantumSteps(N);
      const DURATION = 3500;
      const cDelay = Math.max(16, Math.floor(DURATION / cMax));
      const qDelay = Math.max(16, Math.floor(DURATION / qMax));

      let cStep = 0;
      const classicalTick = () => {
        cStep++;
        setClassicalStep(cStep);
        if (cStep >= cMax) { setClassicalDone(true); setClassicalTime(cMax); }
        else classicalRef.current = setTimeout(classicalTick, cDelay);
      };
      classicalRef.current = setTimeout(classicalTick, cDelay);

      let qStep = 0;
      const quantumTick = () => {
        qStep++;
        setQuantumStep(qStep);
        if (qStep >= qMax) { setQuantumDone(true); setQuantumTime(qMax); }
        else quantumRef.current = setTimeout(quantumTick, qDelay);
      };
      quantumRef.current = setTimeout(quantumTick, qDelay);
    }, 50);
  };

  useEffect(() => {
    if (classicalDone && quantumDone) { setFinished(true); setRunning(false); }
  }, [classicalDone, quantumDone]);

  const speedup = classicalTime > 0 && quantumTime > 0 ? (classicalTime / quantumTime).toFixed(1) : '—';
  const classicalPct = classicalMax > 0 ? Math.min(100, (classicalStep / classicalMax) * 100) : 0;
  const quantumPct = quantumMax > 0 ? Math.min(100, (quantumStep / quantumMax) * 100) : 0;

  const COMPARISON_SIZES = [8, 16, 32, 64, 128, 256];

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title">⚔️ Classical vs. Quantum Race</h1>
        <p className="page-subtitle">An educational complexity visualizer across 6 landmark quantum algorithms</p>
      </div>

      <div className="card" role="note" style={{ marginBottom: 24, borderLeft: '4px solid var(--info)', padding: '14px 18px' }}>
        <strong>Learning visualizer</strong>
        <p style={{ color: 'var(--text-secondary)', fontSize: '.84rem', marginTop: 4 }}>This page compares estimated operation counts. It is not a live multiplayer race, does not submit competition scores, and does not award XP.</p>
      </div>

      {/* Algorithm Selector */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>🎯 Select Algorithm</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {Object.entries(ALGORITHMS).map(([key, a]) => (
            <button
              key={key}
              onClick={() => setSelectedAlgo(key)}
              style={{
                padding: '12px 14px', borderRadius: 10, border: `2px solid ${selectedAlgo === key ? a.color : 'var(--border-glass)'}`,
                background: selectedAlgo === key ? `${a.color}18` : 'var(--bg-glass)',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: '1.3rem', marginBottom: 4 }}>{a.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: selectedAlgo === key ? a.color : 'var(--text-primary)', lineHeight: 1.3 }}>{a.name}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{a.quantumComplexity}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="explainer-tabs" style={{ marginBottom: 24 }}>
        {[{ id: 'race', label: '🏁 Live Race' }, { id: 'learn', label: '📚 How It Works' }, { id: 'compare', label: '📊 Complexity Table' }].map(t => (
          <button key={t.id} className={`explainer-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* RACE TAB */}
      {activeTab === 'race' && (
        <>
          {/* Controls */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Problem Size (N)</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: algo.color, fontWeight: 700 }}>N = {N}</span>
                </div>
                <input type="range" min={8} max={256} step={8} value={N}
                  onChange={e => setN(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: algo.color }} disabled={running} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  <span>8</span><span>64</span><span>128</span><span>256</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Classical steps: <strong style={{ color: '#ef4444' }}>{classicalMax.toLocaleString()}</strong></div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quantum steps: <strong style={{ color: algo.color }}>{quantumMax.toLocaleString()}</strong></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={startRace} disabled={running}
                  style={{ background: running ? undefined : `linear-gradient(135deg, ${algo.color}, #448aff)` }}>
                  {running ? '⏳ Racing...' : '🏁 Start Race'}
                </button>
                <button className="btn btn-secondary" onClick={reset} disabled={running && !finished}>🔄 Reset</button>
              </div>
            </div>
          </div>

          {/* Race Bars */}
          <div className="grid grid-2" style={{ marginBottom: 24, gap: 20 }}>
            {/* Classical */}
            <div className="card" style={{ borderTop: '3px solid #ef4444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 1 }}>Classical</div>
                  <h3 style={{ margin: 0 }}>{algo.classicalName}</h3>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 800, color: '#ef4444' }}>{algo.classicalComplexity}</div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>{algo.classicalDesc}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                <span>Progress</span>
                <span style={{ color: classicalDone ? '#10b981' : 'var(--text-secondary)' }}>
                  {classicalStep.toLocaleString()} / {classicalMax.toLocaleString()} {classicalDone && '✓'}
                </span>
              </div>
              <div className="race-bar" style={{ height: 24, borderRadius: 12 }}>
                <div className="race-fill classical" style={{ width: `${classicalPct}%`, borderRadius: 12, transition: 'width 0.1s linear', background: 'linear-gradient(90deg, #ef4444, #f97316)' }}>
                  {classicalPct > 12 && <span className="race-fill-label">{Math.round(classicalPct)}%</span>}
                </div>
              </div>
              <div style={{ marginTop: 14, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444' }}>{classicalStep.toLocaleString()}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>steps completed</div>
              </div>
            </div>

            {/* Quantum */}
            <div className="card" style={{ borderTop: `3px solid ${algo.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: algo.color, textTransform: 'uppercase', letterSpacing: 1 }}>Quantum</div>
                  <h3 style={{ margin: 0 }}>{algo.quantumName}</h3>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 800, color: algo.color }}>{algo.quantumComplexity}</div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>{algo.quantumDesc}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                <span>Progress</span>
                <span style={{ color: quantumDone ? '#10b981' : 'var(--text-secondary)' }}>
                  {quantumStep.toLocaleString()} / {quantumMax.toLocaleString()} {quantumDone && '✓'}
                </span>
              </div>
              <div className="race-bar" style={{ height: 24, borderRadius: 12 }}>
                <div className="race-fill quantum" style={{ width: `${quantumPct}%`, borderRadius: 12, transition: 'width 0.1s linear', background: `linear-gradient(90deg, ${algo.color}, #448aff)` }}>
                  {quantumPct > 12 && <span className="race-fill-label">{Math.round(quantumPct)}%</span>}
                </div>
              </div>
              <div style={{ marginTop: 14, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: algo.color }}>{quantumStep.toLocaleString()}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>steps completed</div>
              </div>
            </div>
          </div>

          {/* Results */}
          {finished && (
            <div className="card fade-in" style={{ marginBottom: 24, borderTop: `3px solid ${algo.color}` }}>
              <h3 style={{ marginBottom: 20, textAlign: 'center' }}>🏆 Race Results — {algo.icon} {algo.name}</h3>
              <div className="grid grid-3" style={{ marginBottom: 20 }}>
                <div style={{ textAlign: 'center', padding: '16px 8px', background: 'rgba(239,68,68,0.06)', borderRadius: 10 }}>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444' }}>{classicalTime.toLocaleString()}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Classical Steps</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px 8px', background: `${algo.color}10`, borderRadius: 10, border: `1px solid ${algo.color}30` }}>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, background: `linear-gradient(135deg, ${algo.color}, #448aff)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{speedup}×</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Quantum Speedup</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px 8px', background: `${algo.color}06`, borderRadius: 10 }}>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: algo.color }}>{quantumTime.toLocaleString()}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Quantum Steps</div>
                </div>
              </div>
              <div style={{ padding: '16px 20px', background: `${algo.color}08`, borderRadius: 8, border: `1px solid ${algo.color}20` }}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: algo.color }}>💡 What just happened?</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                  {algo.insight(N, classicalTime, quantumTime)}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* LEARN TAB */}
      {activeTab === 'learn' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {Object.entries(ALGORITHMS).map(([key, a]) => (
            <div key={key} className="card" style={{ borderLeft: `4px solid ${a.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: '1.8rem' }}>{a.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: a.color }}>{a.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{a.classicalComplexity} → {a.quantumComplexity}</div>
                </div>
              </div>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>{a.description}</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, padding: '8px 10px', background: 'rgba(239,68,68,0.06)', borderRadius: 6, fontSize: '0.75rem' }}>
                  <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>Classical</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{a.classicalDesc}</div>
                </div>
                <div style={{ flex: 1, padding: '8px 10px', background: `${a.color}08`, borderRadius: 6, fontSize: '0.75rem' }}>
                  <div style={{ fontWeight: 700, color: a.color, marginBottom: 4 }}>Quantum</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{a.quantumDesc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* COMPARE TAB */}
      {activeTab === 'compare' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(ALGORITHMS).map(([key, a]) => (
            <div key={key} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: '1.4rem' }}>{a.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, color: a.color }}>{a.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.classicalComplexity} → {a.quantumComplexity}</div>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)' }}>N</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', color: '#ef4444' }}>Classical</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', color: a.color }}>Quantum</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--accent)' }}>Speedup</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON_SIZES.map(n => {
                      const c = a.classicalSteps(n);
                      const q = a.quantumSteps(n);
                      const sp = (c / q).toFixed(1);
                      return (
                        <tr key={n} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{n}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#ef4444' }}>{c.toLocaleString()}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: a.color }}>{q.toLocaleString()}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{sp}×</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <AITutor />
    </div>
  );
}
