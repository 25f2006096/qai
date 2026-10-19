import { MODULES } from '../data/modules.js';

export const WORLD_REGIONS = [
  { id: 'qubit-village', name: 'Qubit Village', icon: '⚛️', range: [1, 2], description: 'Build a grounding in probability, vectors, and quantum states.' },
  { id: 'superposition-valley', name: 'Superposition Valley', icon: '〰️', range: [3, 4], description: 'Use gates and discover how entanglement emerges.' },
  { id: 'gate-workshop', name: 'Quantum Gate Workshop', icon: '⚙️', range: [5, 7], description: 'Design circuits, reason about measurement, and run Qiskit programs.' },
  { id: 'algorithm-citadel', name: 'Algorithm Citadel', icon: '🏛️', range: [8, 10], description: 'Explore the SDK ecosystem and foundational quantum algorithms.' },
  { id: 'frontier-labs', name: 'Quantum Frontier Labs', icon: '🔬', range: [11, 16], description: 'Apply quantum ideas to learning, noise, hardware, and capstone work.' },
  { id: 'research-frontier', name: 'Advanced Quantum Frontier', icon: '🚀', range: [17, 24], description: 'Move into research, cryptography, optimization, networking, and simulation.' },
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
