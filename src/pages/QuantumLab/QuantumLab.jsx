import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { simulateCircuit, getProbabilities, measure, initState, applyGate, getReducedBlochCoords } from '../../utils/quantum.js';
import AITutor from '../../components/ai/AITutor.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useProgress } from '../../context/ProgressContext.jsx';
import { storage } from '../../utils/storage.js';
import { submitIbmJob, executeCircuit, getCapabilities, getIbmBackends } from '../../services/quantumApi.js';
import Editor from '@monaco-editor/react';

const PRESETS = {
  'Bell State |Φ⁺⟩': {
    nQubits: 2,
    desc: 'Maximally entangled 2-qubit Bell state: 1/√2 (|00⟩ + |11⟩)',
    ops: [{ gate: 'H', target: 0, col: 0 }, { gate: 'CNOT', control: 0, target: 1, col: 1 }]
  },
  'GHZ State': {
    nQubits: 3,
    desc: '3-qubit Greenberger–Horne–Zeilinger entangled state: 1/√2 (|000⟩ + |111⟩)',
    ops: [{ gate: 'H', target: 0, col: 0 }, { gate: 'CNOT', control: 0, target: 1, col: 1 }, { gate: 'CNOT', control: 0, target: 2, col: 2 }]
  },
  'W State': {
    nQubits: 3,
    desc: 'Symmetric 3-qubit W-state: 1/√3 (|001⟩ + |010⟩ + |100⟩)',
    ops: [
      { gate: 'Ry', target: 0, angle: 1.9106, col: 0 }, // 2*acos(1/sqrt(3))
      { gate: 'CNOT', control: 0, target: 1, col: 1 },
      { gate: 'X', target: 0, col: 2 },
      { gate: 'H', target: 2, col: 3 },
      { gate: 'CNOT', control: 1, target: 2, col: 4 },
      { gate: 'CNOT', control: 0, target: 1, col: 5 },
      { gate: 'X', target: 0, col: 6 }
    ]
  },
  'Quantum Teleportation': {
    nQubits: 3,
    desc: 'Transfers unknown state |ψ⟩ from q0 to q2 using Bell entanglement',
    ops: [
      { gate: 'H', target: 0, col: 0 }, // State prep on q0
      { gate: 'H', target: 1, col: 1 }, { gate: 'CNOT', control: 1, target: 2, col: 2 }, // Bell pair (q1, q2)
      { gate: 'CNOT', control: 0, target: 1, col: 3 }, { gate: 'H', target: 0, col: 4 }, // Bell measurement
      { gate: 'CNOT', control: 1, target: 2, col: 5 }, { gate: 'Z', target: 2, col: 6 } // Recovery
    ]
  },
  'Deutsch-Jozsa': {
    nQubits: 2,
    desc: 'Determines if a 1-bit function is constant or balanced in 1 query',
    ops: [
      { gate: 'X', target: 1, col: 0 },
      { gate: 'H', target: 0, col: 1 }, { gate: 'H', target: 1, col: 1 },
      { gate: 'CNOT', control: 0, target: 1, col: 2 }, // Balanced oracle
      { gate: 'H', target: 0, col: 3 }
    ]
  },
  'Grover Search': {
    nQubits: 2,
    desc: 'Searches unsorted database for target state |11⟩ with quadratic speedup',
    ops: [
      { gate: 'H', target: 0, col: 0 }, { gate: 'H', target: 1, col: 0 }, // Uniform superposition
      { gate: 'CZ', control: 0, target: 1, col: 1 }, // Oracle for |11>
      { gate: 'H', target: 0, col: 2 }, { gate: 'H', target: 1, col: 2 }, // Diffuser
      { gate: 'X', target: 0, col: 3 }, { gate: 'X', target: 1, col: 3 },
      { gate: 'CZ', control: 0, target: 1, col: 4 },
      { gate: 'X', target: 0, col: 5 }, { gate: 'X', target: 1, col: 5 },
      { gate: 'H', target: 0, col: 6 }, { gate: 'H', target: 1, col: 6 }
    ]
  },
  'Superdense Coding': {
    nQubits: 2,
    desc: 'Transmits 2 classical bits by sending only 1 physical qubit',
    ops: [
      { gate: 'H', target: 0, col: 0 }, { gate: 'CNOT', control: 0, target: 1, col: 1 }, // Bell pair
      { gate: 'X', target: 0, col: 2 }, { gate: 'Z', target: 0, col: 3 }, // Encode '11'
      { gate: 'CNOT', control: 0, target: 1, col: 4 }, { gate: 'H', target: 0, col: 5 } // Decode
    ]
  },
  'Bernstein-Vazirani': {
    nQubits: 3,
    desc: 'Finds hidden bitstring s = 11 in a single quantum query',
    ops: [
      { gate: 'X', target: 2, col: 0 },
      { gate: 'H', target: 0, col: 1 }, { gate: 'H', target: 1, col: 1 }, { gate: 'H', target: 2, col: 1 },
      { gate: 'CNOT', control: 0, target: 2, col: 2 }, { gate: 'CNOT', control: 1, target: 2, col: 3 }, // s = 11 oracle
      { gate: 'H', target: 0, col: 4 }, { gate: 'H', target: 1, col: 4 }
    ]
  },
  'Quantum Phase Estimation': {
    nQubits: 2,
    desc: 'Estimates the phase θ of an eigenstate U|u⟩ = e^(2πiθ)|u⟩',
    ops: [
      { gate: 'H', target: 0, col: 0 }, { gate: 'X', target: 1, col: 0 },
      { gate: 'S', target: 1, col: 1 }, // Controlled-Phase
      { gate: 'H', target: 0, col: 2 } // Inverse QFT
    ]
  }
};

const NOISE_MODELS = {
  ideal: { name: 'Ideal (Zero Noise)', desc: 'Pure statevector simulation without environmental interference.' },
  depolarizing: { name: 'Depolarizing Noise', desc: 'Isotropic bit and phase flip error channel.' },
  amplitude: { name: 'Amplitude Damping (T1)', desc: 'Simulates energy relaxation / decay from |1⟩ to |0⟩.' },
  phase: { name: 'Phase Damping (T2)', desc: 'Simulates loss of quantum phase coherence without energy loss.' },
  readout: { name: 'Readout Error', desc: 'Thermal noise perturbation during measurement sampling.' }
};

const IBM_TOPOLOGIES = {
  'ibmq_qasm_simulator': {
    name: 'IBM Aer Simulator',
    qubits: 32,
    qv: 128,
    t1: '100.0 µs',
    t2: '120.0 µs',
    err1: '0.01%',
    err2: '0.05%',
    coupling: 'All-to-All (Complete Graph)',
  },
  'ibm_brisbane': {
    name: 'IBM Brisbane (Eagle r3)',
    qubits: 127,
    qv: 512,
    t1: '245.8 µs',
    t2: '138.2 µs',
    err1: '0.024%',
    err2: '0.78%',
    coupling: 'Heavy-Hexagonal Grid Lattice',
  },
  'ibm_kyiv': {
    name: 'IBM Kyiv (Eagle r3)',
    qubits: 127,
    qv: 256,
    t1: '210.4 µs',
    t2: '115.6 µs',
    err1: '0.031%',
    err2: '0.92%',
    coupling: 'Heavy-Hexagonal Grid Lattice',
  },
  'ibm_osaka': {
    name: 'IBM Osaka (Eagle r3)',
    qubits: 127,
    qv: 512,
    t1: '278.1 µs',
    t2: '162.4 µs',
    err1: '0.019%',
    err2: '0.65%',
    coupling: 'Heavy-Hexagonal Grid Lattice',
  },
};


class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("QuantumLab Component Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, color: '#ef4444', background: '#1e1b4b', borderRadius: 12, margin: 20 }}>
          <h2>⚠️ Quantum Lab Rendering Error</h2>
          <pre style={{ background: '#0f172a', padding: 16, borderRadius: 8, color: '#f87171', overflowX: 'auto' }}>
            {this.state.error?.stack || this.state.error?.toString()}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function QuantumLabInner() {
  const { user } = useAuth();
  const { gamification } = useProgress();
  const nav = useNavigate();
  const [activeTab, setActiveTab] = useState('setup'); // 'setup', 'results', 'state', 'code', 'hardware', 'history'
  const [preset, setPreset] = useState('Bell State |Φ⁺⟩');
  const [customOps, setCustomOps] = useState(PRESETS['Bell State |Φ⁺⟩'].ops);
  const [nQubits, setNQubits] = useState(PRESETS['Bell State |Φ⁺⟩'].nQubits);
  const [shots, setShots] = useState(1000);
  const [noiseModel, setNoiseModel] = useState('ideal');
  const [noiseProb, setNoiseProb] = useState(0.05); // 5%
  const [selectedDevice, setSelectedDevice] = useState('ibm_brisbane');

  // Custom gate inputs
  const [newGate, setNewGate] = useState('H');
  const [newTarget, setNewTarget] = useState(0);
  const [newControl, setNewControl] = useState(1);
  const [newAngle, setNewAngle] = useState(1.5708); // pi/2

  // Experiment output
  const [results, setResults] = useState(null);
  const [expName, setExpName] = useState('');
  const [experiments, setExperiments] = useState([]);
  const [comparedExps, setComparedExps] = useState([]);
  const [copiedToast, setCopiedToast] = useState(false);
  const [expSaveToast, setExpSaveToast] = useState(false);

  // Load saved experiments
  useEffect(() => {
    storage.getLabExperiments(user?.id).then(setExperiments);
  }, [user]);

  const applyPreset = (name) => {
    setPreset(name);
    if (PRESETS[name]) {
      setNQubits(PRESETS[name].nQubits);
      setCustomOps([...PRESETS[name].ops]);
    }
  };

  const addGateToCircuit = () => {
    const op = { gate: newGate, target: Number(newTarget), col: customOps.length };
    if (newGate === 'CNOT' || newGate === 'SWAP' || newGate === 'CZ') {
      op.control = Number(newControl);
    }
    if (['Rx', 'Ry', 'Rz'].includes(newGate)) {
      op.angle = Number(newAngle);
    }
    setCustomOps([...customOps, op]);
  };

  const removeGate = (index) => {
    const updated = customOps.filter((_, i) => i !== index);
    setCustomOps(updated);
  };

  const clearCircuit = () => {
    setCustomOps([]);
  };

  const runExperiment = () => {
    try {
      const ops = customOps.filter(o => o.gate !== 'M');
      if (ops.length === 0) return;
      let idealState = simulateCircuit(ops, nQubits);
      let state = idealState.map(a => ({ r: a.r, i: a.i }));

      // Apply Noise Channel Simulation
      if (noiseModel !== 'ideal') {
        const p = noiseProb;
        if (noiseModel === 'depolarizing') {
          state = state.map(a => ({
            r: a.r * (1 - p) + (Math.random() - 0.5) * p,
            i: a.i * (1 - p) + (Math.random() - 0.5) * p
          }));
        } else if (noiseModel === 'amplitude') {
          state = state.map((a, idx) => {
            const isOdd = idx % 2 === 1;
            return isOdd ? { r: a.r * Math.sqrt(1 - p), i: a.i * Math.sqrt(1 - p) } : a;
          });
        } else if (noiseModel === 'phase') {
          state = state.map(a => ({
            r: a.r * (1 - p * 0.5), i: a.i * (1 - p)
          }));
        } else if (noiseModel === 'readout') {
          // Readout error: applied during measurement, not state - just add small perturbation
          state = state.map(a => ({
            r: a.r + (Math.random() - 0.5) * p * 0.1,
            i: a.i + (Math.random() - 0.5) * p * 0.1
          }));
        }

        // Renormalize
        const norm = Math.sqrt(state.reduce((s, a) => s + a.r * a.r + a.i * a.i, 0)) || 1;
        state = state.map(a => ({ r: a.r / norm, i: a.i / norm }));
      }

      // Calculate Quantum Fidelity F = |<psi_ideal|psi_noisy>|^2
      let overlapR = 0, overlapI = 0;
      for (let i = 0; i < idealState.length; i++) {
        overlapR += idealState[i].r * state[i].r + idealState[i].i * state[i].i;
        overlapI += idealState[i].r * state[i].i - idealState[i].i * state[i].r;
      }
      const fidelity = Math.min(100, Math.max(0, (overlapR * overlapR + overlapI * overlapI) * 100));

      const probs = getProbabilities(state);
      const counts1 = measure(state, nQubits, shots);
      const counts2 = measure(state, nQubits, shots * 10);
      const bloch = getReducedBlochCoords(state, nQubits, 0);

      setResults({
        probs, counts1, counts2, state, idealState, fidelity,
        nQubits, shots, noiseModel, noiseProb, bloch, date: new Date().toISOString()
      });
      setActiveTab('results');
    } catch (err) {
      console.error('Experiment error:', err);
      setResults(null);
    }
  };

  // Run experiment on mount and when qubit count or preset changes
  useEffect(() => {
    runExperiment();
  }, []);

  const saveExp = async () => {
    if (!expName.trim() || !results) return;
    const userId = user?.id || null;
    const newExp = {
      name: expName,
      preset,
      shots,
      noiseModel,
      fidelity: results.fidelity,
      results: { counts1: results.counts1, probs: results.probs }
    };
    await storage.insertLabExperiment(userId, newExp);
    await storage.incrementLabExperiments(userId);
    const exps = await storage.getLabExperiments(userId);
    setExperiments(exps);
    setExpName('');
    setExpSaveToast(true);
    setTimeout(() => setExpSaveToast(false), 2500);
  };

  const deleteExp = async (id) => {
    const userId = user?.id || null;
    await storage.deleteLabExperiment(id, userId);
    const filtered = experiments.filter(e => e.id !== id);
    setExperiments(filtered);
  };

  const [codeFramework, setCodeFramework] = useState('qiskit'); // 'qiskit', 'pennylane', 'cirq', 'qasm'
  const [editedCode, setEditedCode] = useState(null);
  const [codeRun, setCodeRun] = useState(null);
  const [jobDispatch, setJobDispatch] = useState(null); // { status: 'idle'|'submitting'|'queued'|'running'|'completed', jobId: '' }
  const [hardwareStatus, setHardwareStatus] = useState({ loading: true, configured: false, error: '' });
  const [availableDevices, setAvailableDevices] = useState([]);

  useEffect(() => {
    let active = true;
    getCapabilities()
      .then(async capabilities => {
        if (!capabilities?.ibm_quantum) {
          if (active) setHardwareStatus({ loading: false, configured: false, error: '' });
          return;
        }
        try {
          const response = await getIbmBackends();
          const backends = response?.backends || [];
          if (!backends.length) throw new Error('No operational IBM hardware backends are available for this account.');
          if (active) {
            setAvailableDevices(backends);
            setSelectedDevice(backends[0].name);
            setHardwareStatus({ loading: false, configured: true, error: '' });
          }
        } catch (error) {
          if (active) setHardwareStatus({ loading: false, configured: false, error: error.message || 'Unable to load available IBM backends.' });
        }
      })
      .catch(() => {
        if (active) setHardwareStatus({ loading: false, configured: false, error: 'The quantum backend is unavailable. Deploy the FastAPI Web Service to enable code execution and hardware jobs.' });
      });
    return () => { active = false; };
  }, []);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2500);
  };

  const generateQiskitCode = () => {
    let code = `# Qiskit 1.x Python Script Generated by QuantumLearn AI
from qiskit import QuantumCircuit

# Initialize QuantumCircuit with ${nQubits} qubits and ${nQubits} classical bits
qc = QuantumCircuit(${nQubits}, ${nQubits})

# Apply Quantum Gates
`;
    customOps.forEach(op => {
      if (op.gate === 'H') code += `qc.h(${op.target})\n`;
      else if (op.gate === 'X') code += `qc.x(${op.target})\n`;
      else if (op.gate === 'Y') code += `qc.y(${op.target})\n`;
      else if (op.gate === 'Z') code += `qc.z(${op.target})\n`;
      else if (op.gate === 'S') code += `qc.s(${op.target})\n`;
      else if (op.gate === 'T') code += `qc.t(${op.target})\n`;
      else if (['Rx', 'Ry', 'Rz'].includes(op.gate)) code += `qc.${op.gate.toLowerCase()}(${op.angle || 1.5708}, ${op.target})\n`;
      else if (op.gate === 'CNOT') code += `qc.cx(${op.control}, ${op.target})\n`;
      else if (op.gate === 'SWAP') code += `qc.swap(${op.control || 0}, ${op.target})\n`;
      else if (op.gate === 'CZ') code += `qc.cz(${op.control || 0}, ${op.target})\n`;
    });

    code += `
# Measurement — QuantumLearn executes this safely on its backend.
qc.measure_all()
`;
    return code;
  };

  const generatePennyLaneCode = () => {
    let code = `# PennyLane Quantum Script Generated by QuantumLearn AI
import pennylane as qml
from pennylane import numpy as np

# Define quantum device backend
dev = qml.device("default.qubit", wires=${nQubits}, shots=${shots})

@qml.qnode(dev)
def circuit():
`;
    customOps.forEach(op => {
      if (op.gate === 'H') code += `    qml.Hadamard(wires=${op.target})\n`;
      else if (op.gate === 'X') code += `    qml.PauliX(wires=${op.target})\n`;
      else if (op.gate === 'Y') code += `    qml.PauliY(wires=${op.target})\n`;
      else if (op.gate === 'Z') code += `    qml.PauliZ(wires=${op.target})\n`;
      else if (op.gate === 'S') code += `    qml.S(wires=${op.target})\n`;
      else if (op.gate === 'T') code += `    qml.T(wires=${op.target})\n`;
      else if (['Rx', 'Ry', 'Rz'].includes(op.gate)) code += `    qml.${op.gate.toUpperCase()}(${op.angle || 1.5708}, wires=${op.target})\n`;
      else if (op.gate === 'CNOT') code += `    qml.CNOT(wires=[${op.control}, ${op.target}])\n`;
      else if (op.gate === 'SWAP') code += `    qml.SWAP(wires=[${op.control || 0}, ${op.target}])\n`;
      else if (op.gate === 'CZ') code += `    qml.CZ(wires=[${op.control || 0}, ${op.target}])\n`;
    });
    code += `    return qml.counts()\n\nresults = circuit()\nprint("PennyLane Execution Results:", results)\n`;
    return code;
  };

  const generateCirqCode = () => {
    let code = `# Cirq Python Script Generated by QuantumLearn AI
import cirq

# Define qubits
qubits = [cirq.LineQubit(i) for i in range(${nQubits})]
circuit = cirq.Circuit()

# Apply gates
`;
    customOps.forEach(op => {
      if (op.gate === 'H') code += `circuit.append(cirq.H(qubits[${op.target}]))\n`;
      else if (op.gate === 'X') code += `circuit.append(cirq.X(qubits[${op.target}]))\n`;
      else if (op.gate === 'Y') code += `circuit.append(cirq.Y(qubits[${op.target}]))\n`;
      else if (op.gate === 'Z') code += `circuit.append(cirq.Z(qubits[${op.target}]))\n`;
      else if (op.gate === 'S') code += `circuit.append(cirq.S(qubits[${op.target}]))\n`;
      else if (op.gate === 'T') code += `circuit.append(cirq.T(qubits[${op.target}]))\n`;
      else if (['Rx', 'Ry', 'Rz'].includes(op.gate)) code += `circuit.append(cirq.${op.gate.toLowerCase()}(${op.angle || 1.5708})(qubits[${op.target}]))\n`;
      else if (op.gate === 'CNOT') code += `circuit.append(cirq.CNOT(qubits[${op.control}], qubits[${op.target}]))\n`;
      else if (op.gate === 'SWAP') code += `circuit.append(cirq.SWAP(qubits[${op.control || 0}], qubits[${op.target}]))\n`;
      else if (op.gate === 'CZ') code += `circuit.append(cirq.CZ(qubits[${op.control || 0}], qubits[${op.target}]))\n`;
    });
    code += `
# Measurement
circuit.append(cirq.measure(*qubits, key='result'))

# Simulator execution
simulator = cirq.Simulator()
result = simulator.run(circuit, repetitions=${shots})
print("Cirq Execution Results:\\n", result.histogram(key='result'))
`;
    return code;
  };

  const generateQASMCode = () => {
    let qasm = `OPENQASM 2.0;\ninclude "qelib1.inc";\n\nqreg q[${nQubits}];\ncreg c[${nQubits}];\n\n`;
    customOps.forEach(op => {
      if (op.gate === 'H') qasm += `h q[${op.target}];\n`;
      else if (op.gate === 'X') qasm += `x q[${op.target}];\n`;
      else if (op.gate === 'Y') qasm += `y q[${op.target}];\n`;
      else if (op.gate === 'Z') qasm += `z q[${op.target}];\n`;
      else if (op.gate === 'S') qasm += `s q[${op.target}];\n`;
      else if (op.gate === 'T') qasm += `t q[${op.target}];\n`;
      else if (['Rx', 'Ry', 'Rz'].includes(op.gate)) qasm += `${op.gate.toLowerCase()}(${(op.angle || Math.PI / 2).toFixed(4)}) q[${op.target}];\n`;
      else if (op.gate === 'CNOT') qasm += `cx q[${op.control}], q[${op.target}];\n`;
      else if (op.gate === 'SWAP') qasm += `swap q[${op.control}], q[${op.target}];\n`;
      else if (op.gate === 'CZ') qasm += `cz q[${op.control}], q[${op.target}];\n`;
    });
    qasm += `measure q -> c;\n`;
    return qasm;
  };

  const dispatchToRealQPU = async () => {
    setJobDispatch({ status: 'submitting', jobId: '', step: 'Submitting your circuit to the configured backend…' });
    try {
      const job = await submitIbmJob({ backend: selectedDevice, shots, code: generateQiskitCode() });
      setJobDispatch({ status: String(job.status || 'queued').toLowerCase(), jobId: job.job_id, step: `Submitted your circuit to ${job.backend}. Poll this real job ID for status and results.` });
    } catch (error) {
      setJobDispatch({ status: 'error', jobId: '', step: error.message || 'IBM Quantum is not configured on the backend.' });
    }
  };

  const generatedCode = codeFramework === 'qiskit' ? generateQiskitCode() : codeFramework === 'pennylane' ? generatePennyLaneCode() : codeFramework === 'cirq' ? generateCirqCode() : generateQASMCode();
  const activeCode = editedCode ?? generatedCode;
  const selectedBackend = availableDevices.find(device => device.name === selectedDevice);
  const selectedTopology = IBM_TOPOLOGIES[selectedDevice] || {
    name: selectedDevice,
    qubits: selectedBackend?.qubits ?? '—',
    qv: 'Live IBM device',
    t1: 'View in IBM Quantum',
    err2: 'View in IBM Quantum',
    coupling: 'Live topology is managed by IBM Quantum',
  };
  const runFrameworkCode = async () => {
    if (codeFramework === 'qasm') { setCodeRun({ error: 'OpenQASM export is not executable from this editor. Select a framework.' }); return; }
    setCodeRun({ loading: true });
    try {
      const result = await executeCircuit({ framework: codeFramework, code: activeCode, shots });
      setCodeRun(result?.success === true
        ? result
        : { error: result?.error || result?.detail || 'The quantum API returned an incomplete execution result. Restart or redeploy the quantum backend.' });
    } catch (error) { setCodeRun({ error: error.message }); }
  };

  return (
    <div className="page fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">🔬 Quantum Lab & Hardware Studio</h1>
          <p className="page-subtitle">Multi-framework code generation (Qiskit, PennyLane, Cirq, QASM), hardware topologies & QPU dispatch</p>
        </div>
        {results && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="tag tag-accent" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
              ⚡ Fidelity: <strong>{results.fidelity.toFixed(1)}%</strong>
            </div>
            <div className={`tag ${noiseModel === 'ideal' ? 'tag-success' : 'tag-warning'}`} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
              {NOISE_MODELS[noiseModel].name}
            </div>
          </div>
        )}
      </div>

      {gamification?.next_mission && (
        <div className="mission-panel" style={{ marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div className="mission-kicker">🎯 Active Learning Mission</div>
            <h2 style={{ fontSize: '1rem', margin: '4px 0' }}>{gamification.next_mission.title}</h2>
            <p style={{ margin: 0 }}>{gamification.next_mission.description}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="tag tag-accent">+{gamification.next_mission.xp_reward} XP</span>
            <button className="btn btn-primary btn-sm" onClick={() => nav(gamification.next_mission.route)}>
              Open in Circuit Builder →
            </button>
          </div>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="explainer-tabs" style={{ marginBottom: 24 }}>
        {[
          { id: 'setup', label: '⚗️ Experiment Setup', icon: '' },
          { id: 'results', label: '📊 Measurements & Analytics', icon: '' },
          { id: 'state', label: '📐 State Tomography', icon: '' },
          { id: 'code', label: '💻 Multi-Framework Code Exporter', icon: '' },
          { id: 'hardware', label: '🌐 Cloud QPU & Hardware Topology', icon: '' },
          { id: 'history', label: `📁 Saved Runs (${experiments.length})`, icon: '' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`explainer-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: EXPERIMENT SETUP */}
      {activeTab === 'setup' && (
        <div className="grid grid-2" style={{ gap: 24 }}>
          {/* Left Column: Preset & Gate Controls */}
          <div className="card">
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              🎯 Preset Library (9 Algorithms)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
              {Object.keys(PRESETS).map(name => (
                <button
                  key={name}
                  className={`btn btn-sm ${preset === name ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ textAlign: 'left', padding: '8px 12px' }}
                  onClick={() => applyPreset(name)}
                >
                  {name}
                </button>
              ))}
            </div>

            {PRESETS[preset] && (
              <div style={{ padding: 12, background: 'rgba(37,99,235,0.06)', borderRadius: 8, border: '1px solid rgba(37,99,235,0.2)', marginBottom: 20, fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                💡 <strong>{preset}:</strong> {PRESETS[preset].desc}
              </div>
            )}

            <h4 style={{ marginBottom: 12, color: 'var(--accent)' }}>🛠️ Custom Circuit Builder</h4>
            <div className="form-group">
              <label className="form-label">Number of Qubits</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    className={`btn btn-sm ${nQubits === n ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => { setNQubits(n); setCustomOps([]); }}
                  >
                    {n} Qubit{n > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Add Gate Form */}
            <div style={{ padding: 16, background: 'var(--bg-glass)', borderRadius: 8, border: '1px solid var(--border-glass)', marginBottom: 16 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Add Gate Operation</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Gate Type</label>
                  <select className="form-select" value={newGate} onChange={e => setNewGate(e.target.value)}>
                    <option value="H">H (Hadamard)</option>
                    <option value="X">X (Pauli-X / NOT)</option>
                    <option value="Y">Y (Pauli-Y)</option>
                    <option value="Z">Z (Pauli-Z)</option>
                    <option value="S">S (Phase)</option>
                    <option value="T">T (pi/8)</option>
                    <option value="Rx">Rx(θ)</option>
                    <option value="Ry">Ry(θ)</option>
                    <option value="Rz">Rz(θ)</option>
                    <option value="CNOT">CNOT</option>
                    <option value="SWAP">SWAP</option>
                    <option value="CZ">CZ</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Target Qubit</label>
                  <select className="form-select" value={newTarget} onChange={e => setNewTarget(e.target.value)}>
                    {Array.from({ length: nQubits }).map((_, i) => (
                      <option key={i} value={i}>q[{i}]</option>
                    ))}
                  </select>
                </div>
                {(newGate === 'CNOT' || newGate === 'SWAP' || newGate === 'CZ') && (
                  <div>
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>Control Qubit</label>
                    <select className="form-select" value={newControl} onChange={e => setNewControl(e.target.value)}>
                      {Array.from({ length: nQubits }).map((_, i) => (
                        <option key={i} value={i}>q[{i}]</option>
                      ))}
                    </select>
                  </div>
                )}
                {['Rx', 'Ry', 'Rz'].includes(newGate) && (
                  <div>
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>Angle (rad)</label>
                    <input type="number" step="0.1" className="form-input" value={newAngle} onChange={e => setNewAngle(e.target.value)} style={{ padding: '10px' }} />
                  </div>
                )}
              </div>
              <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={addGateToCircuit}>
                + Add {newGate} Gate
              </button>
            </div>

            <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} onClick={runExperiment}>
              ▶ Execute Quantum Job
            </button>
          </div>

          {/* Right Column: Active Circuit Canvas & Noise Settings */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3>⚡ Active Circuit Sequence</h3>
              <button className="btn btn-secondary btn-sm" onClick={clearCircuit}>Clear All</button>
            </div>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'var(--bg-glass)', padding: 16, borderRadius: 8, minHeight: 140, marginBottom: 20, lineHeight: 2 }}>
              {customOps.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: 40 }}>No gates added. Select a preset or add custom gates.</div>
              ) : (
                customOps.map((op, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '4px 0' }}>
                    <span style={{ color: op.gate === 'H' ? '#38bdf8' : op.gate === 'CNOT' ? '#f43f5e' : '#a855f7' }}>
                      Step {i + 1}: {op.gate}
                      {op.control !== undefined ? ` (ctrl: q[${op.control}], tgt: q[${op.target}])` : ` (tgt: q[${op.target}])`}
                    </span>
                    <button className="btn btn-secondary btn-sm btn-icon" onClick={() => removeGate(i)}>✕</button>
                  </div>
                ))
              )}
            </div>

            <h4 style={{ marginBottom: 12, color: 'var(--accent)' }}>🧪 Noise Channel Simulator</h4>
            <div className="form-group">
              <label className="form-label">Noise Channel Model</label>
              <select className="form-select" value={noiseModel} onChange={e => setNoiseModel(e.target.value)}>
                {Object.entries(NOISE_MODELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.name}</option>
                ))}
              </select>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {NOISE_MODELS[noiseModel].desc}
              </div>
            </div>

            {noiseModel !== 'ideal' && (
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Error Rate Probability (p):</span>
                  <strong>{(noiseProb * 100).toFixed(1)}%</strong>
                </label>
                <input
                  type="range" min="0.01" max="0.20" step="0.01"
                  value={noiseProb} onChange={e => setNoiseProb(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            )}

            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Shots Execution Budget</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[100, 1000, 10000, 50000].map(s => (
                  <button
                    key={s}
                    className={`btn btn-sm ${shots === s ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShots(s)}
                  >
                    {s.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MEASUREMENTS & ANALYTICS */}
      {activeTab === 'results' && results && (
        <div className="grid grid-2" style={{ gap: 24 }}>
          {/* Main Shots Histogram */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3>📊 Measurement Histogram ({results.shots.toLocaleString()} Shots)</h3>
              <span className="tag tag-accent">Fidelity: {results.fidelity.toFixed(1)}%</span>
            </div>

            {Object.entries(results.counts1).sort((a, b) => b[1] - a[1]).map(([state, count]) => {
              const pct = Math.round((count / results.shots) * 100);
              return (
                <div key={state} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontFamily: 'var(--font-mono)', fontSize: '0.92rem' }}>
                    <span>|{state}⟩</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{pct}% ({count} counts)</span>
                  </div>
                  <div className="progress-bar" style={{ height: 16, background: 'rgba(0,0,0,0.06)' }}>
                    <div
                      className="progress-fill"
                      style={{
                        width: `${pct}%`,
                        background: 'linear-gradient(90deg, #7c4dff, #3b82f6)',
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Shot Convergence Benchmark (10x shots) */}
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>🔄 High-Shot Convergence ({(results.shots * 10).toLocaleString()} Shots)</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Demonstrates Law of Large Numbers sampling error reduction ~ 1/√N.
            </p>

            {Object.entries(results.counts2).sort((a, b) => b[1] - a[1]).map(([state, count]) => {
              const pct10 = Math.round((count / (results.shots * 10)) * 100);
              return (
                <div key={state} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontFamily: 'var(--font-mono)', fontSize: '0.92rem' }}>
                    <span>|{state}⟩</span>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>{pct10}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: 16, background: 'rgba(0,0,0,0.06)' }}>
                    <div
                      className="progress-fill success"
                      style={{ width: `${pct10}%`, transition: 'width 0.4s ease' }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Save Experiment */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-glass)' }}>
              <h4 style={{ marginBottom: 8, fontSize: '0.9rem' }}>💾 Save Run to History</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="Experiment name (e.g. Bell Noise Test)..."
                  value={expName}
                  onChange={e => setExpName(e.target.value)}
                />
                <button className="btn btn-primary" onClick={saveExp} disabled={!expName.trim()}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STATE TOMOGRAPHY */}
      {activeTab === 'state' && results && (
        <div className="grid grid-2" style={{ gap: 24 }}>
          {/* State Vector Amplitudes Table */}
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>📐 StateVector |ψ⟩ Dirac Amplitudes</h3>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', background: 'var(--bg-glass)', padding: 16, borderRadius: 8, marginBottom: 20 }}>
              |ψ⟩ = {results.state.map((a, i) => {
                const mag = Math.sqrt(a.r * a.r + a.i * a.i);
                if (mag < 0.001) return null;
                const ket = i.toString(2).padStart(results.nQubits, '0');
                const phase = Math.atan2(a.i, a.r) * (180 / Math.PI);
                return `${mag.toFixed(3)} e^(${phase.toFixed(0)}°) |${ket}⟩`;
              }).filter(Boolean).join(' + ')}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', textAlign: 'left' }}>
                  <th style={{ padding: 8 }}>Basis State</th>
                  <th style={{ padding: 8 }}>Re(c)</th>
                  <th style={{ padding: 8 }}>Im(c)</th>
                  <th style={{ padding: 8 }}>Prob |c|²</th>
                  <th style={{ padding: 8 }}>Phase</th>
                </tr>
              </thead>
              <tbody>
                {results.state.map((a, i) => {
                  const prob = (a.r * a.r + a.i * a.i) * 100;
                  const phase = Math.atan2(a.i, a.r) * (180 / Math.PI);
                  const ket = i.toString(2).padStart(results.nQubits, '0');
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: 8, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>|{ket}⟩</td>
                      <td style={{ padding: 8, fontFamily: 'var(--font-mono)' }}>{a.r.toFixed(4)}</td>
                      <td style={{ padding: 8, fontFamily: 'var(--font-mono)' }}>{a.i.toFixed(4)}</td>
                      <td style={{ padding: 8, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{prob.toFixed(1)}%</td>
                      <td style={{ padding: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{phase.toFixed(1)}°</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bloch Sphere Coordinates for Qubit 0 */}
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>🌐 Reduced Density Matrix & Bloch Coordinates</h3>
            <div style={{ textAlign: 'center', padding: 24, background: 'var(--bg-glass)', borderRadius: 12, border: '1px solid var(--border-glass)', marginBottom: 20 }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔮</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent)', marginBottom: 8 }}>
                Bloch Vector: ({results.bloch.x.toFixed(3)}, {results.bloch.y.toFixed(3)}, {results.bloch.z.toFixed(3)})
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Single-qubit state projection for q[0] on 3D Hilbert Sphere
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center' }}>
              <div style={{ padding: 12, background: 'rgba(37,99,235,0.06)', borderRadius: 8 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>X (Superposition)</div>
                <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{results.bloch.x.toFixed(3)}</div>
              </div>
              <div style={{ padding: 12, background: 'rgba(124,77,255,0.06)', borderRadius: 8 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Y (Phase)</div>
                <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{results.bloch.y.toFixed(3)}</div>
              </div>
              <div style={{ padding: 12, background: 'rgba(16,185,129,0.06)', borderRadius: 8 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Z (Population)</div>
                <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{results.bloch.z.toFixed(3)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MULTI-FRAMEWORK CODE EXPORTER */}
      {activeTab === 'code' && (
        <div>
          {/* Framework Selector Tabs */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {[
              { id: 'qiskit', label: '🐍 Qiskit 1.x (IBM)', color: '#38bdf8' },
              { id: 'pennylane', label: '🫐 PennyLane (Xanadu)', color: '#a855f7' },
              { id: 'cirq', label: '⚡ Cirq (Google)', color: '#f59e0b' },
              { id: 'qasm', label: '📄 OpenQASM 2.0', color: '#10b981' },
            ].map(fw => (
              <button
                key={fw.id}
                className={`btn btn-sm ${codeFramework === fw.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setCodeFramework(fw.id); setEditedCode(null); setCodeRun(null); }}
              >
                {fw.label}
              </button>
            ))}
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>
                {codeFramework === 'qiskit' && '🐍 Qiskit 1.x Python Script'}
                {codeFramework === 'pennylane' && '🫐 PennyLane Python Script'}
                {codeFramework === 'cirq' && '⚡ Cirq Python Script'}
                {codeFramework === 'qasm' && '📄 OpenQASM 2.0 Specification Code'}
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {codeFramework !== 'qasm' && <button className="btn btn-primary btn-sm" onClick={runFrameworkCode}>▶ Run</button>}
                <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(activeCode)}>📋 Copy Code</button>
              </div>
            </div>

            <Editor height="430px" language={codeFramework === 'qasm' ? 'plaintext' : 'python'} theme="vs-dark" value={activeCode} onChange={(value) => setEditedCode(value || '')} options={{ minimap: { enabled: true }, lineNumbers: 'on', fontSize: 13, automaticLayout: true }} />
            {codeRun && <pre style={{ marginTop: 16, background: '#0f172a', color: codeRun.error ? '#f87171' : '#e2e8f0', padding: 14, borderRadius: 8, overflowX: 'auto' }}>{codeRun.loading ? 'Running…' : codeRun.error || JSON.stringify({ measurements: codeRun.measurements, probabilities: codeRun.probabilities, execution_time: codeRun.execution_time }, null, 2)}</pre>}
          </div>
        </div>
      )}

      {/* TAB 5: IBM HARDWARE TOPOLOGY & CLOUD QPU DISPATCH */}
      {activeTab === 'hardware' && (
        <div className="grid grid-2" style={{ gap: 24 }}>
          {/* Left Column: Device Topology */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3>🌐 Quantum Hardware Topology</h3>
              <select className="form-select" value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)} style={{ width: 220 }}>
                {(availableDevices.length ? availableDevices.map(device => [device.name, { name: `${device.name} (${device.qubits} qubits)` }]) : Object.entries(IBM_TOPOLOGIES)).map(([k, v]) => (
                  <option key={k} value={k}>{v.name}</option>
                ))}
              </select>
            </div>

            {selectedTopology && (
              <div>
                <div className="grid grid-2" style={{ gap: 12, marginBottom: 20 }}>
                  <div style={{ padding: 12, background: 'var(--bg-glass)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Physical Qubits</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent)' }}>{selectedTopology.qubits}</div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-glass)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Quantum Volume</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>{selectedTopology.qv}</div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-glass)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Avg T1 Relaxation</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b' }}>{selectedTopology.t1}</div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-glass)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CNOT Gate Error</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ef4444' }}>{selectedTopology.err2}</div>
                  </div>
                </div>

                <div style={{ padding: 20, background: '#0f172a', borderRadius: 10, color: 'white', textAlign: 'center' }}>
                  <h5 style={{ marginBottom: 6, color: '#38bdf8' }}>Coupling Graph Map</h5>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 16 }}>
                    {selectedTopology.coupling}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {[0, 1, 2, 3, 4, 5].map(q => (
                      <div key={q} style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #7c4dff, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '0.78rem', border: '2px solid rgba(255,255,255,0.3)' }}>
                        Q{q}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Cloud QPU Dispatch Studio */}
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>🚀 Cloud Hardware Dispatch Studio</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              IBM credentials are configured securely in the backend environment. Never paste an IBM API key into the browser.
            </p>

            <div className={`tag ${hardwareStatus.configured ? 'tag-success' : 'tag-warning'}`} style={{ marginBottom: 12 }}>
              {hardwareStatus.loading ? 'Checking IBM backend…' : hardwareStatus.configured ? 'IBM backend configured' : hardwareStatus.error || 'IBM backend is not configured. Add IBM_QUANTUM_API_KEY and IBM_QUANTUM_INSTANCE in Render.'}
            </div>

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: 8 }}
              onClick={dispatchToRealQPU}
              disabled={hardwareStatus.loading || !hardwareStatus.configured}
            >
              📡 Submit Job to Physical QPU
            </button>

            {jobDispatch && (
              <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-glass)', borderRadius: 8, border: '1px solid var(--accent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>ID: {jobDispatch.jobId}</span>
                  <span className={`tag ${jobDispatch.status === 'completed' ? 'tag-success' : 'tag-warning'}`}>
                    {jobDispatch.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--accent-light)', marginBottom: 8 }}>
                  {jobDispatch.step}
                </div>
                {jobDispatch.status !== 'completed' && (
                  <div className="progress-bar" style={{ height: 6 }}>
                    <div className="progress-fill" style={{ width: '60%', animation: 'pulse 1.5s infinite' }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: EXPERIMENT HISTORY & COMPARISON */}
      {activeTab === 'history' && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>📁 Saved Experiments ({experiments.length})</h3>
          {experiments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No saved experiments yet. Run an experiment and click "Save Run to History".
            </div>
          ) : (
            <div className="grid grid-3" style={{ gap: 16 }}>
              {experiments.map(exp => (
                <div key={exp.id} style={{ padding: 16, background: 'var(--bg-glass)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: '1rem' }}>{exp.name}</strong>
                    <button className="btn btn-secondary btn-sm btn-icon" onClick={() => deleteExp(exp.id)}>✕</button>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                    {exp.preset} · {exp.shots} shots
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700, marginBottom: 8 }}>
                    Fidelity: {exp.fidelity ? exp.fidelity.toFixed(1) : 100}%
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Saved: {new Date(exp.date).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {copiedToast && (
        <div className="tag tag-success" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, padding: '12px 20px', borderRadius: 8, boxShadow: 'var(--shadow-lg)' }}>
          ✅ Code Copied to Clipboard!
        </div>
      )}

      {expSaveToast && (
        <div className="tag tag-success" style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 1000, padding: '12px 20px', borderRadius: 8, boxShadow: 'var(--shadow-lg)' }}>
          💾 Experiment Saved to History!
        </div>
      )}

      <AITutor />
    </div>
  );
}

export default function QuantumLab() {
  return (
    <ErrorBoundary>
      <QuantumLabInner />
    </ErrorBoundary>
  );
}
