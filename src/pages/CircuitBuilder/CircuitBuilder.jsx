import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useProgress } from '../../context/ProgressContext.jsx';
import { storage } from '../../utils/storage.js';
import { simulateCircuit, getProbabilities, measure, blochCoords, getQubitProbabilities, getReducedQubitState } from '../../utils/quantum.js';
import { getChallengeProgress, saveChallengeProgress, submitCircuitMission } from '../../services/quantumApi.js';
import AITutor from '../../components/ai/AITutor.jsx';
import BlochSphere from '../../components/BlochSphere.jsx';
import CircuitExplainer from '../../components/CircuitExplainer.jsx';

const GATE_COLORS = { H:'#7c4dff', X:'#ff5252', Y:'#ff9800', Z:'#2196f3', S:'#00bcd4', T:'#4caf50', CNOT:'#e91e63', M:'#9e9e9e', SWAP:'#795548', I:'#607d8b', Rx:'#f44336', Ry:'#ff6d00', Rz:'#1565c0' };

const BASIC_GATES = ['H','X','Y','Z','S','T','CNOT','SWAP','M'];
const ROTATION_GATES = ['Rx','Ry','Rz'];
const ALL_GATES = [...BASIC_GATES, ...ROTATION_GATES];

const REPAIR_SCENARIOS = {
  'superposition-reset': {
    missionId: 'build-superposition',
    title: 'Repair: restore superposition',
    instruction: 'This circuit incorrectly flips q0. Remove the X gate, then create the required equal superposition with exactly one H gate on q0.',
    qubits: 1,
    operations: [{ gate: 'X', target: 0, col: 0 }],
  },
  'broken-bell-pair': {
    missionId: 'build-bell-state',
    title: 'Repair: fix broken Bell state',
    instruction: 'This circuit has a stray Z gate before the CNOT. Remove the Z gate so that H(q0) is followed directly by CNOT(q0, q1).',
    qubits: 2,
    operations: [
      { gate: 'H', target: 0, col: 0 },
      { gate: 'Z', target: 0, col: 1 },
      { gate: 'CNOT', control: 0, target: 1, col: 2 },
    ],
  },
  'ghz-repair': {
    missionId: 'build-ghz-state',
    title: 'Repair: complete 3-qubit GHZ state',
    instruction: 'Complete the GHZ circuit by adding CNOT(q0, q2) after CNOT(q0, q1).',
    qubits: 3,
    operations: [
      { gate: 'H', target: 0, col: 0 },
      { gate: 'CNOT', control: 0, target: 1, col: 1 },
    ],
  },
};

const BOSS_SCENARIOS = {
  'entanglement-guardian': {
    missionId: 'build-bell-state',
    title: 'Boss Battle: The Entanglement Guardian',
    stages: [
      'Prepare q0 in superposition with H.',
      'Entangle q0 and q1 with CNOT.',
      'Simulate and submit the verified Bell-state circuit.',
    ],
  },
  'ghz-overlord': {
    missionId: 'build-ghz-state',
    title: 'Boss Battle: The Tri-Qubit Overlord',
    stages: [
      'Prepare 3 qubits and initialize q0 in superposition with H.',
      'Entangle q0 with q1 using CNOT(q0, q1).',
      'Cascade entanglement to q2 with CNOT(q0, q2).',
      'Simulate and submit the verified 3-qubit GHZ state.',
    ],
  },
};

function opsToQasm(ops, nQubits) {
  let qasm = `OPENQASM 2.0;\ninclude "qelib1.inc";\n\nqreg q[${nQubits}];\ncreg c[${nQubits}];\n\n`;
  ops.forEach(op => {
    const g = op.gate.toLowerCase();
    if (['h', 'x', 'y', 'z', 's', 't'].includes(g)) {
      qasm += `${g} q[${op.target}];\n`;
    } else if (g === 'cnot' || g === 'cx') {
      qasm += `cx q[${op.control !== undefined ? op.control : 0}], q[${op.target}];\n`;
    } else if (g === 'swap') {
      qasm += `swap q[${op.control !== undefined ? op.control : 0}], q[${op.target}];\n`;
    } else if (['rx', 'ry', 'rz'].includes(g)) {
      qasm += `${g}(${(op.angle || Math.PI/2).toFixed(4)}) q[${op.target}];\n`;
    } else if (g === 'm') {
      qasm += `measure q[${op.target}] -> c[${op.target}];\n`;
    }
  });
  return qasm;
}

function qasmToOps(qasmText) {
  const lines = qasmText.split('\n');
  let nQ = 2;
  const newOps = [];
  let colCounter = 0;
  lines.forEach(line => {
    const clean = line.trim();
    const qregMatch = clean.match(/qreg\s+q\[(\d+)\]/i);
    if (qregMatch) nQ = parseInt(qregMatch[1], 10);

    const singleMatch = clean.match(/^(h|x|y|z|s|t)\s+q\[(\d+)\];/i);
    if (singleMatch) {
      newOps.push({ gate: singleMatch[1].toUpperCase(), target: parseInt(singleMatch[2], 10), col: colCounter++ });
    }
    const rotMatch = clean.match(/^(rx|ry|rz)\(([^)]+)\)\s+q\[(\d+)\];/i);
    if (rotMatch) {
      const gName = rotMatch[1].charAt(0).toUpperCase() + rotMatch[1].slice(1).toLowerCase();
      newOps.push({ gate: gName, angle: parseFloat(rotMatch[2]), target: parseInt(rotMatch[3], 10), col: colCounter++ });
    }
    const cxMatch = clean.match(/^(cx|cnot)\s+q\[(\d+)\]\s*,\s*q\[(\d+)\];/i);
    if (cxMatch) {
      newOps.push({ gate: 'CNOT', control: parseInt(cxMatch[2], 10), target: parseInt(cxMatch[3], 10), col: colCounter++ });
    }
    const swapMatch = clean.match(/^swap\s+q\[(\d+)\]\s*,\s*q\[(\d+)\];/i);
    if (swapMatch) {
      newOps.push({ gate: 'SWAP', control: parseInt(swapMatch[1], 10), target: parseInt(swapMatch[2], 10), col: colCounter++ });
    }
    const mMatch = clean.match(/^measure\s+q\[(\d+)\]/i);
    if (mMatch) {
      newOps.push({ gate: 'M', target: parseInt(mMatch[1], 10), col: colCounter++ });
    }
  });
  return { nQubits: Math.max(1, Math.min(5, nQ)), ops: newOps };
}

export default function CircuitBuilder({ embedded = false, initialQubits = 2, gateBudget, onOpsChange } = {}) {
  const { user } = useAuth();
  const { trackGateUsage, gamification, refreshGamification } = useProgress();
  const [nQubits, setNQubits] = useState(initialQubits);
  const [ops, setOps] = useState([]); // {gate, target, control?, col, angle?}
  const [dragGate, setDragGate] = useState(null);
  const [shots, setShots] = useState(1000);
  const [results, setResults] = useState(null);
  const [history, setHistory] = useState([[]]);
  const [histIdx, setHistIdx] = useState(0);
  const [saveName, setSaveName] = useState('');
  const [saved, setSaved] = useState([]);
  const [showExplainer, setShowExplainer] = useState(false);
  const [rotAngle, setRotAngle] = useState(Math.PI / 2);
  const [selectedQubitForBloch, setSelectedQubitForBloch] = useState(0);
  const [viewMode, setViewMode] = useState('visual'); // 'visual' | 'qasm'
  const [qasmText, setQasmText] = useState('');
  const [shareToast, setShareToast] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [missionStatus, setMissionStatus] = useState(null);
  const [missionError, setMissionError] = useState('');
  const [missionSubmitting, setMissionSubmitting] = useState(false);
  const [missionToast, setMissionToast] = useState(null);
  const repairLoaded = useRef(false);
  const [bossStage, setBossStage] = useState(0);
  const [bossFeedback, setBossFeedback] = useState('');
  const [challengeSaveState, setChallengeSaveState] = useState('');

  const queryMissionId = !embedded ? new URLSearchParams(window.location.search).get('mission') : null;
  const repairId = !embedded ? new URLSearchParams(window.location.search).get('repair') : null;
  const repairScenario = repairId ? REPAIR_SCENARIOS[repairId] : null;
  const bossId = !embedded ? new URLSearchParams(window.location.search).get('boss') : null;
  const bossScenario = bossId ? BOSS_SCENARIOS[bossId] : null;
  const missions = gamification?.missions || [];
  const activeMission = missions.find(mission => mission.id === queryMissionId)
    || (queryMissionId ? null : missions.find(mission => !['completed', 'mastered'].includes(mission.status)));

  // Load saved circuits & check URL query params for shared circuits
  useEffect(() => {
    if (embedded) return;
    storage.getSavedCircuits(user?.id).then(setSaved);
    const params = new URLSearchParams(window.location.search);
    const sharedData = params.get('circuit');
    if (sharedData) {
      try {
        const decoded = JSON.parse(atob(sharedData));
        if (decoded.nQubits && Array.isArray(decoded.ops)) {
          setNQubits(decoded.nQubits);
          setOps(decoded.ops);
        }
      } catch (e) { console.error('Failed to parse shared circuit', e); }
    }
  }, [user, embedded]);

  useEffect(() => {
    if (embedded || repairLoaded.current || !repairScenario) return;
    repairLoaded.current = true;
    setNQubits(repairScenario.qubits);
    setOps(repairScenario.operations);
    setHistory([repairScenario.operations]);
    setHistIdx(0);
    setResults(null);
  }, [embedded, repairScenario]);

  useEffect(() => {
    let active = true;
    if (embedded || !bossId || !user) return undefined;
    getChallengeProgress(bossId).then((response) => {
      const savedProgress = response?.progress;
      if (!active || !savedProgress) return;
      if (Number.isInteger(savedProgress.stage)) setBossStage(savedProgress.stage);
      if (savedProgress.circuit_data?.qubits && Array.isArray(savedProgress.circuit_data?.operations)) {
        setNQubits(savedProgress.circuit_data.qubits);
        setOps(savedProgress.circuit_data.operations);
        setHistory([savedProgress.circuit_data.operations]);
        setHistIdx(0);
      }
      setChallengeSaveState('Restored your saved checkpoint.');
    }).catch(() => {
      if (active) setChallengeSaveState('Checkpoint saving becomes available after migration 17 is applied.');
    });
    return () => { active = false; };
  }, [embedded, bossId, user?.id]);

  useEffect(() => {
    if (embedded) setNQubits(initialQubits);
  }, [embedded, initialQubits]);

  useEffect(() => {
    onOpsChange?.(ops);
  }, [ops, onOpsChange]);

  // Keep QASM text updated when ops change
  useEffect(() => {
    setQasmText(opsToQasm(ops, nQubits));
  }, [ops, nQubits]);

  const handleQasmChange = (text) => {
    setQasmText(text);
    const parsed = qasmToOps(text);
    if (parsed.ops.length >= 0) {
      setNQubits(parsed.nQubits);
      setOps(parsed.ops);
    }
  };

  const copyShareLink = () => {
    const data = btoa(JSON.stringify({ nQubits, ops }));
    const url = `${window.location.origin}${window.location.pathname}?circuit=${data}`;
    navigator.clipboard.writeText(url);
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
  };

  const maxCols = Math.max(8, ops.reduce((m, o) => Math.max(m, o.col + 2), 8));

  // Live simulation state for probabilities and Bloch sphere
  const liveState = useMemo(() => {
    const nonMeasure = ops.filter(o => o.gate !== 'M');
    if (nonMeasure.length === 0) return null;
    try {
      return simulateCircuit(nonMeasure, nQubits);
    } catch { return null; }
  }, [ops, nQubits]);

  // Per-qubit probabilities
  const qubitProbs = useMemo(() => {
    if (!liveState) return Array(nQubits).fill({ p0: 100, p1: 0 });
    return Array.from({ length: nQubits }, (_, q) => getQubitProbabilities(liveState, nQubits, q));
  }, [liveState, nQubits]);

  // Bloch sphere coords for selected qubit
  const blochData = useMemo(() => {
    if (!liveState) return { x: 0, y: 0, z: 1 };
    if (nQubits === 1) return blochCoords(liveState);
    const reduced = getReducedQubitState(liveState, nQubits, selectedQubitForBloch);
    return { x: reduced.x, y: reduced.y, z: reduced.z };
  }, [liveState, nQubits, selectedQubitForBloch]);

  const addOp = (gate, qubit, col) => {
    if (gate !== 'M' && gateBudget && ops.filter(op => op.gate !== 'M').length >= gateBudget) return;
    const isRotation = ROTATION_GATES.includes(gate);
    let newOp = { gate, target: qubit, col };
    if (isRotation) newOp.angle = rotAngle;
    if (gate === 'CNOT') newOp = { gate: 'CNOT', control: qubit > 0 ? qubit - 1 : 1, target: qubit, col };
    if (gate === 'SWAP') newOp = { gate: 'SWAP', control: qubit > 0 ? qubit - 1 : 1, target: qubit, col };
    const newOps = [...ops, newOp];
    pushHistory(newOps);
    if (trackGateUsage) trackGateUsage(gate);
  };

  const pushHistory = (newOps) => {
    const newHist = [...history.slice(0, histIdx + 1), newOps];
    setHistory(newHist); setHistIdx(newHist.length - 1); setOps(newOps); setResults(null);
  };

  const undo = () => { if (histIdx > 0) { setHistIdx(h => h - 1); setOps(history[histIdx - 1]); } };
  const redo = () => { if (histIdx < history.length - 1) { setHistIdx(h => h + 1); setOps(history[histIdx + 1]); } };
  const clear = () => { pushHistory([]); };

  const simulate = () => {
    const nonMeasure = ops.filter(o => o.gate !== 'M');
    if (nonMeasure.length === 0) return;
    try {
      const state = simulateCircuit(nonMeasure, nQubits);
      setResults({ state, probs: getProbabilities(state), counts: measure(state, nQubits, shots) });
    } catch (e) { setResults({ error: e.message }); }
  };

  const submitMission = async () => {
    if (!activeMission || !user || missionSubmitting) return;
    setMissionSubmitting(true);
    setMissionError('');
    setMissionToast(null);
    try {
      const response = await submitCircuitMission(activeMission.id, {
        qubits: nQubits,
        operations: ops,
      });
      const reward = response?.reward || {};
      setMissionStatus(reward.awarded ? 'completed' : 'already-completed');
      await refreshGamification();
      setMissionToast(reward.awarded
        ? { message: `Mission complete: +${reward.xp_awarded + (reward.daily_quest_xp || 0)} XP${reward.daily_quest_xp ? ' (including daily quest bonus)' : ''}`, achievements: reward.new_achievements || [] }
        : { message: 'Mission already completed. Your XP was not duplicated.', achievements: [] });
    } catch (error) {
      setMissionError(error.message || 'The mission could not be verified. Review the circuit and try again.');
    } finally {
      setMissionSubmitting(false);
    }
  };

  const validateBossStage = () => {
    if (!bossScenario) return;
    const gates = ops.filter(operation => operation.gate !== 'M').sort((a, b) => a.col - b.col);
    if (bossScenario.missionId === 'build-bell-state') {
      const hasSuperposition = gates.length === 1 && gates[0]?.gate === 'H' && gates[0]?.target === 0;
      const hasBellState = gates.length === 2 && gates[0]?.gate === 'H' && gates[0]?.target === 0
        && gates[1]?.gate === 'CNOT' && gates[1]?.control === 0 && gates[1]?.target === 1;
      if (bossStage === 0) {
        if (!hasSuperposition) return setBossFeedback('Stage 1 needs exactly H on q0. Remove unrelated gates and try again.');
        setBossStage(1); return setBossFeedback('Stage 1 verified locally. Add CNOT with q0 as control and q1 as target.');
      }
      if (bossStage === 1) {
        if (!hasBellState) return setBossFeedback('Stage 2 needs H(q0) followed by CNOT(q0, q1).');
        setBossStage(2); return setBossFeedback('Stage 2 verified locally. Run the simulator, then submit the existing verified mission.');
      }
      if (!results || results.error) return setBossFeedback('Run a successful simulation before completing the final stage.');
      setBossFeedback('Final stage is ready. Use Verify & Claim XP for server validation.');
    } else if (bossScenario.missionId === 'build-ghz-state') {
      const stage0Ok = nQubits >= 3 && gates.length === 1 && gates[0]?.gate === 'H' && gates[0]?.target === 0;
      const stage1Ok = nQubits >= 3 && gates.length === 2 && gates[0]?.gate === 'H' && gates[0]?.target === 0
        && gates[1]?.gate === 'CNOT' && gates[1]?.control === 0 && gates[1]?.target === 1;
      const stage2Ok = nQubits >= 3 && gates.length === 3 && gates[0]?.gate === 'H' && gates[0]?.target === 0
        && gates[1]?.gate === 'CNOT' && gates[1]?.control === 0 && gates[1]?.target === 1
        && gates[2]?.gate === 'CNOT' && gates[2]?.control === 0 && gates[2]?.target === 2;
      if (bossStage === 0) {
        if (!stage0Ok) return setBossFeedback('Stage 1 requires at least 3 qubits and exactly H on q0.');
        setBossStage(1); return setBossFeedback('Stage 1 verified. Now add CNOT from q0 to q1.');
      }
      if (bossStage === 1) {
        if (!stage1Ok) return setBossFeedback('Stage 2 requires H(q0) and CNOT(q0, q1).');
        setBossStage(2); return setBossFeedback('Stage 2 verified. Now add CNOT from q0 to q2.');
      }
      if (bossStage === 2) {
        if (!stage2Ok) return setBossFeedback('Stage 3 requires H(q0), CNOT(q0, q1), and CNOT(q0, q2).');
        setBossStage(3); return setBossFeedback('Stage 3 verified! Run a simulation, then submit the circuit.');
      }
      if (!results || results.error) return setBossFeedback('Run a successful simulation before completing the final stage.');
      setBossFeedback('Final stage ready! Submit for verified server validation.');
    }
  };

  const saveBossCheckpoint = async () => {
    if (!bossId || !user) return;
    setChallengeSaveState('Saving checkpoint…');
    try {
      await saveChallengeProgress(bossId, {
        stage: bossStage,
        circuit_data: { qubits: nQubits, operations: ops },
        completed: missionStatus === 'completed',
      });
      setChallengeSaveState('Checkpoint saved securely to your learner record.');
    } catch (error) {
      setChallengeSaveState(error.message || 'Checkpoint could not be saved. Your verified reward state is unchanged.');
    }
  };

  const saveCircuit = async () => {
    if (!user || !saveName.trim()) return;
    await storage.insertCircuit(user.id, saveName, nQubits, ops);
    const circuits = await storage.getSavedCircuits(user.id);
    setSaved(circuits);
    setSaveName('');
  };

  const loadCircuit = (c) => { setNQubits(c.nQubits); pushHistory(c.ops); };

  const dropOnCell = (qubit, col) => {
    if (!dragGate) return;
    addOp(dragGate, qubit, col);
    setDragGate(null);
  };

  const cellOps = (q, c) => ops.filter(o => o.target === q && o.col === c);

  return (
    <div className={embedded ? '' : 'page fade-in'}>
      {!embedded && (
        <div className="page-header">
          <h1 className="page-title">⚡ Quantum Circuit Builder</h1>
          <p className="page-subtitle">Drag gates onto qubit wires, see live state probabilities, and visualize on the Bloch sphere</p>
        </div>
      )}

      {!embedded && activeMission && (
        <section className="mission-panel" aria-labelledby="circuit-mission-heading">
          <div style={{ flex: 1 }}>
            <div className="mission-kicker">🎯 Verified circuit mission</div>
            <h2 id="circuit-mission-heading">{activeMission.title}</h2>
            <p>{activeMission.description}</p>
            {repairScenario && repairScenario.missionId === activeMission.id && (
              <div className="mission-feedback" role="status" style={{ marginTop: 10 }}>
                <strong>{repairScenario.title}:</strong> {repairScenario.instruction}
              </div>
            )}
            {bossScenario && bossScenario.missionId === activeMission.id && (
              <div className="mission-feedback" role="status" style={{ marginTop: 10 }}>
                <strong>{bossScenario.title}</strong> · Stage {bossStage + 1} of {bossScenario.stages.length}: {bossScenario.stages[bossStage]}
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary btn-sm" onClick={validateBossStage}>Check stage</button>
                  <button className="btn btn-secondary btn-sm" onClick={saveBossCheckpoint}>Save checkpoint</button>
                </div>
                {bossFeedback && <div style={{ marginTop: 7 }}>{bossFeedback}</div>}
                <div style={{ color: 'var(--text-muted)', fontSize: '.72rem', marginTop: 8 }}>{challengeSaveState || 'Checkpoint state is saved only after migration 17 is applied; verified mission rewards remain server-owned.'}</div>
              </div>
            )}
            <div className="mission-meta">
              <span className="tag tag-accent">+{activeMission.xp_reward} XP</span>
              <span className="tag tag-info">{activeMission.estimated_minutes} min</span>
              <span className="tag tag-info">Backend-validated</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={submitMission} disabled={missionSubmitting || !results || Boolean(results?.error) || ops.filter(op => op.gate !== 'M').length === 0}>
              {missionSubmitting ? 'Verifying…' : missionStatus === 'completed' ? '✓ Verified' : 'Verify & Claim XP'}
            </button>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>{results ? 'Rewards are granted once after server validation.' : 'Run a local simulation before verifying.'}</span>
          </div>
          {missionError && <div className="mission-feedback error" role="alert">{missionError}</div>}
        </section>
      )}

      {!embedded && !repairScenario && queryMissionId === 'build-superposition' && (
        <button className="text-action" style={{ marginBottom: 12 }} onClick={() => window.location.assign('/circuit?mission=build-superposition&repair=superposition-reset')}>
          Try the guided Circuit Repair Mission →
        </button>
      )}
      {!embedded && !bossScenario && queryMissionId === 'build-bell-state' && (
        <button className="text-action" style={{ marginBottom: 12 }} onClick={() => window.location.assign('/circuit?mission=build-bell-state&boss=entanglement-guardian')}>
          Challenge the Entanglement Guardian →
        </button>
      )}
      {!embedded && !bossScenario && queryMissionId === 'build-ghz-state' && (
        <button className="text-action" style={{ marginBottom: 12 }} onClick={() => window.location.assign('/circuit?mission=build-ghz-state&boss=ghz-overlord')}>
          Challenge the Tri-Qubit Overlord →
        </button>
      )}

      {/* Gate Palette */}
      <div className="gate-palette" style={{ marginBottom: 16, flexDirection: 'column', gap: 12 }}>
        {/* Basic Gates */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, width: 60 }}>Gates</span>
          {BASIC_GATES.map(g => (
            <div key={g} className="gate-btn" draggable
              style={{ borderColor: dragGate === g ? GATE_COLORS[g] : '', background: dragGate === g ? `${GATE_COLORS[g]}20` : '' }}
              onDragStart={() => setDragGate(g)}
              onDragEnd={() => !results && setDragGate(null)}
              title={g === 'M' ? 'Measure' : g === 'CNOT' ? 'Controlled-NOT' : g === 'SWAP' ? 'Swap' : `${g} Gate`}
            >
              <span style={{ color: GATE_COLORS[g] }}>{g}</span>
            </div>
          ))}
        </div>
        {/* Rotation Gates */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, width: 60 }}>Rotations</span>
          {ROTATION_GATES.map(g => (
            <div key={g} className="gate-btn" draggable
              style={{
                borderColor: dragGate === g ? GATE_COLORS[g] : '',
                background: dragGate === g ? `${GATE_COLORS[g]}20` : '',
                width: 'auto', padding: '0 12px',
              }}
              onDragStart={() => setDragGate(g)}
              onDragEnd={() => !results && setDragGate(null)}
              title={`${g} rotation gate`}
            >
              <span style={{ color: GATE_COLORS[g] }}>{g}(θ)</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>θ =</span>
            <input
              type="range" min={0} max={Math.PI * 2} step={0.01}
              value={rotAngle} onChange={e => setRotAngle(parseFloat(e.target.value))}
              style={{ width: 80 }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontFamily: 'var(--font-mono)', minWidth: 40 }}>
              {(rotAngle * 180 / Math.PI).toFixed(0)}°
            </span>
          </div>
        </div>
        {/* Qubit selector + Mode Toggle + Share + Explain button */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, width: 60 }}>Qubits</span>
          {!embedded && [1,2,3,4,5].map(n => (
            <button key={n} className={`btn btn-sm ${nQubits === n ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setNQubits(n); clear(); }}>{n}</button>
          ))}
          {embedded && <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 700 }}>{nQubits}</span>}

          <div style={{ marginLeft: 16, display: 'flex', gap: 4, background: 'var(--bg-glass)', padding: 3, borderRadius: 6, border: '1px solid var(--border-glass)' }}>
            <button
              className={`btn btn-sm ${viewMode === 'visual' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none', padding: '4px 10px', fontSize: '0.75rem' }}
              onClick={() => setViewMode('visual')}
            >
              🎨 Drag & Drop Visual Canvas
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'qasm' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none', padding: '4px 10px', fontSize: '0.75rem' }}
              onClick={() => setViewMode('qasm')}
            >
              💻 Live OpenQASM Text Editor
            </button>
          </div>

          {!embedded && (
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={copyShareLink}
            title="Copy direct shareable link for this circuit"
          >
            🔗 Share Circuit
          </button>
          )}

          {!embedded && (
          <button
            className="btn btn-sm"
            style={{ background: 'linear-gradient(135deg, #7c4dff, #448aff)', color: 'white', border: 'none', cursor: 'pointer' }}
            onClick={() => setShowExplainer(true)}
            title="Get AI analysis of your circuit"
          >
            🧠 Explain Circuit with AI
          </button>
          )}
        </div>

        {/* Gate budget indicator for embedded contest mode */}
        {embedded && gateBudget && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--bg-glass)', borderRadius: 6, border: '1px solid var(--border-glass)', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Gates used:</span>
            <strong style={{ color: ops.filter(o => o.gate !== 'M').length > gateBudget ? 'var(--danger)' : 'var(--accent)' }}>
              {ops.filter(o => o.gate !== 'M').length} / {gateBudget}
            </strong>
          </div>
        )}
      </div>

      {/* Main Builder Area: Visual Canvas vs Live QASM Code Editor */}
      {viewMode === 'visual' ? (
        <div className="circuit-canvas" style={{ padding: 16, overflowX: 'auto', marginBottom: 20, minHeight: nQubits * 70 + 40 }}>
          {Array.from({ length: nQubits }, (_, q) => (
            <div key={q} style={{ display: 'flex', alignItems: 'center', height: 68, marginBottom: 4 }}>
              <div style={{ width: 48, fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)', flexShrink: 0 }}>q[{q}]</div>
              {/* Live probability badge */}
              <div className="qubit-prob-badge" title={`|0⟩: ${qubitProbs[q].p0}%, |1⟩: ${qubitProbs[q].p1}%`}>
                <span style={{ color: '#3b82f6' }}>|0⟩{qubitProbs[q].p0}%</span>
                <span style={{ color: '#ef4444' }}>|1⟩{qubitProbs[q].p1}%</span>
              </div>
              <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                {/* Wire */}
                <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'var(--border-glass)', zIndex: 0 }} />
                {/* Cells */}
                <div style={{ display: 'flex', gap: 0, position: 'relative', zIndex: 1 }}>
                  {Array.from({ length: maxCols }, (_, c) => {
                    const cell = cellOps(q, c);
                    return (
                      <div key={c}
                        style={{ width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: dragGate ? 'crosshair' : 'default' }}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => dropOnCell(q, c)}
                      >
                        {cell.map((op, i) => (
                          <div key={i}
                            className="circuit-gate-cell"
                            style={{ background: `${GATE_COLORS[op.gate] || '#7c4dff'}15`, border: `2px solid ${GATE_COLORS[op.gate] || '#7c4dff'}`, color: GATE_COLORS[op.gate] || '#7c4dff' }}
                            onClick={() => { const newOps = ops.filter(o => !(o.target === op.target && o.col === op.col && o.gate === op.gate)); pushHistory(newOps); }}
                            title={`Remove ${op.gate} gate`}
                          >
                            {op.gate}{op.angle !== undefined ? `\n${(op.angle * 180 / Math.PI).toFixed(0)}°` : ''}{op.control !== undefined ? `\n↑${op.control}` : ''}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
          {ops.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 8, fontSize: '0.85rem' }}>
              👆 Drag gates from the palette onto qubit wires to build your circuit
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0, color: 'var(--accent)' }}>📝 Live Bi-Directional OpenQASM 2.0 Editor</h4>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Changes typed here automatically parse & sync to circuit state</span>
          </div>
          <textarea
            className="form-input"
            rows={12}
            value={qasmText}
            onChange={e => handleQasmChange(e.target.value)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.88rem',
              lineHeight: 1.6,
              background: '#0f172a',
              color: '#38bdf8',
              borderRadius: 8,
              padding: 16,
              width: '100%',
              boxSizing: 'border-box'
            }}
          />
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={simulate} disabled={ops.filter(o => o.gate !== 'M').length === 0}>▶ Simulate</button>
        <button className="btn btn-secondary" onClick={undo} disabled={histIdx === 0}>↩ Undo</button>
        <button className="btn btn-secondary" onClick={redo} disabled={histIdx >= history.length - 1}>↪ Redo</button>
        <button className="btn btn-secondary" onClick={clear}>🗑 Clear</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Shots:</span>
          {[100, 1000, 10000].map(s => (
            <button key={s} className={`btn btn-sm ${shots === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShots(s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* Bloch Sphere + Results */}
      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        {/* Bloch Sphere */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>🌐 Bloch Sphere</h3>
            {nQubits > 1 && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qubit:</span>
                {Array.from({ length: nQubits }, (_, q) => (
                  <button
                    key={q}
                    className={`btn btn-sm ${selectedQubitForBloch === q ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSelectedQubitForBloch(q)}
                    style={{ minWidth: 32, padding: '4px 8px' }}
                  >q{q}</button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <BlochSphere coords={blochData} size={220} label={`q${selectedQubitForBloch}`} />
          </div>
        </div>

        {/* Quick state summary */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>📊 Live State</h3>
          {liveState ? (
            <>
              {Array.from({ length: nQubits }, (_, q) => {
                const probs = qubitProbs[q];
                return (
                  <div key={q} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                      <span>q[{q}]</span>
                      <span style={{ color: 'var(--accent)' }}>|0⟩:{probs.p0}% |1⟩:{probs.p1}%</span>
                    </div>
                    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'rgba(0,0,0,0.05)' }}>
                      <div style={{ width: `${probs.p0}%`, background: '#3b82f6', transition: 'width 0.4s ease' }} />
                      <div style={{ width: `${probs.p1}%`, background: '#ef4444', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: 6, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {ops.filter(o => o.gate !== 'M').length} gate{ops.filter(o => o.gate !== 'M').length !== 1 ? 's' : ''} • {nQubits} qubit{nQubits !== 1 ? 's' : ''} • Depth {Math.max(0, ...ops.map(o => o.col)) + 1}
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Add gates to see live state analysis</div>
          )}
        </div>
      </div>

      {/* Results */}
      {results && !results.error && (
        <div className="grid grid-2">
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>📊 Probabilities</h3>
            {Object.entries(results.counts).sort((a, b) => b[1] - a[1]).map(([state, count]) => {
              const pct = Math.round((count / shots) * 100);
              return (
                <div key={state} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                    <span>|{state}⟩</span><span>{pct}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: 10 }}>
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>🔢 Measurement Counts ({shots} shots)</h3>
            {Object.entries(results.counts).sort((a, b) => b[1] - a[1]).map(([state, count]) => (
              <div key={state} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: 6, marginBottom: 6, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                <span>|{state}⟩</span>
                <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {results?.error && (
        <div className="card" style={{ borderColor: 'var(--danger)', background: 'rgba(255,82,82,0.05)' }}>
          <div style={{ color: 'var(--danger)' }}>⚠ Simulation error: {results.error}</div>
        </div>
      )}

      {/* Save */}
      {!embedded && (
      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginBottom: 12 }}>💾 Save Circuit</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" placeholder="Circuit name..." value={saveName} onChange={e => setSaveName(e.target.value)} style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={saveCircuit} disabled={!saveName.trim() || ops.length === 0}>Save</button>
        </div>
        {saved.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>Saved circuits:</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {saved.map((c, i) => (
                <button key={i} className="btn btn-secondary btn-sm" onClick={() => loadCircuit(c)}>📂 {c.name}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {!embedded && shareToast && (
        <div className="tag tag-success" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, padding: '12px 20px', borderRadius: 8, boxShadow: 'var(--shadow-lg)' }}>
          🔗 Shareable Circuit Link Copied to Clipboard!
        </div>
      )}

      {!embedded && missionToast && (
        <div className="mission-toast" role="status" aria-live="polite">
          <strong>🎉 {missionToast.message}</strong>
          {missionToast.achievements?.length > 0 && (
            <span>{missionToast.achievements.map(achievement => `${achievement.icon} ${achievement.name}`).join(' · ')}</span>
          )}
        </div>
      )}

      {!embedded && saveToast && (
        <div className="tag tag-success" style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 1000, padding: '12px 20px', borderRadius: 8, boxShadow: 'var(--shadow-lg)' }}>
          💾 Circuit Saved Successfully!
        </div>
      )}

      {!embedded && showExplainer && (
        <CircuitExplainer
          ops={ops}
          nQubits={nQubits}
          onClose={() => setShowExplainer(false)}
        />
      )}

      {!embedded && <AITutor mission={activeMission} />}
    </div>
  );
}
