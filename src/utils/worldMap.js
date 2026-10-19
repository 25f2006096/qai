import { MODULES } from '../data/modules.js';

export const WORLD_REGIONS = [
  {
    id: 'qubit-village', name: 'Qubit Village', icon: '⚛️', range: [1, 2],
    chapter: 'The Qubit Awakens',
    description: 'Build a grounding in probability, vectors, quantum states, and measurement.',
    objective: 'Explain how a qubit differs from a classical bit and interpret a measurement.',
  },
  {
    id: 'superposition-valley', name: 'Superposition Valley', icon: '〰️', range: [3, 3],
    chapter: 'The Superposition Valley',
    description: 'Use single-qubit gates to reason about amplitudes, interference, and probabilities.',
    objective: 'Predict how a Hadamard or Pauli gate changes a single-qubit state.',
  },
  {
    id: 'gate-workshop', name: 'Quantum Gate Workshop', icon: '⚙️', range: [4, 4],
    chapter: 'The Quantum Gate Workshop',
    description: 'Move from one qubit to multi-qubit systems and controlled operations.',
    objective: 'Build and explain a Bell-state circuit using H and CNOT.',
  },
  {
    id: 'entanglement-realm', name: 'Entanglement Realm', icon: '🔗', range: [5, 6],
    chapter: 'The Entanglement Realm',
    description: 'Design circuits and interpret measurement, correlations, and quantum information.',
    objective: 'Reason about circuit structure and the evidence provided by measurements.',
  },
  {
    id: 'circuit-engineering-forge', name: 'Circuit Engineering Forge', icon: '🛠️', range: [7, 8],
    chapter: 'The Circuit Engineering Forge',
    description: 'Program, simulate, and compare circuits across the supported SDK ecosystem.',
    objective: 'Create a runnable circuit and identify an appropriate execution tool.',
  },
  {
    id: 'algorithm-citadel', name: 'Quantum Algorithm Citadel', icon: '🏛️', range: [9, 10],
    chapter: 'The Quantum Algorithm Citadel',
    description: 'Study the curriculum’s supported foundational and advanced quantum algorithms.',
    objective: 'Choose and explain an algorithm for a well-defined quantum problem.',
  },
  {
    id: 'advanced-quantum-frontier', name: 'Advanced Quantum Frontier', icon: '🚀', range: [11, 24],
    chapter: 'The Quantum Frontier',
    description: 'Explore QML, noise, error correction, hardware, cryptography, optimization, and research.',
    objective: 'Apply prior foundations to an advanced topic or research-oriented project.',
  },
];

export function getRegionModules(region) {
  return MODULES.filter(module => module.id >= region.range[0] && module.id <= region.range[1]);
}

export function getWorldMap(progress) {
  const completed = new Set(progress?.completedModules || []);
  let priorComplete = true;

  return WORLD_REGIONS.map(region => {
    const modules = getRegionModules(region);
    const completedCount = modules.filter(module => completed.has(module.id)).length;
    const isComplete = completedCount === modules.length;
    const state = isComplete ? 'complete' : priorComplete ? 'available' : 'locked';
    priorComplete = priorComplete && isComplete;

    return {
      ...region,
      modules,
      completedCount,
      totalCount: modules.length,
      progress: modules.length ? Math.round((completedCount / modules.length) * 100) : 0,
      state,
      nextModule: modules.find(module => !completed.has(module.id)) || null,
    };
  });
}
