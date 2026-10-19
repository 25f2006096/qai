import { MODULES, SKILL_LABELS } from '../data/modules.js';

export const SKILL_PREREQUISITES = {
  mathematics: [],
  qubits: ['mathematics'],
  gates: ['qubits'],
  circuits: ['gates'],
  qiskit: ['circuits'],
  algorithms: ['circuits'],
  qml: ['algorithms'],
  noise: ['qiskit'],
  errorCorrection: ['noise'],
  hardware: ['noise'],
  research: ['algorithms'],
  cryptography: ['algorithms'],
  optimization: ['algorithms'],
  simulation: ['algorithms'],
};

export function getSkillTree(skills = {}, progress = {}) {
  const completed = new Set(progress.completedModules || []);
  return Object.keys(SKILL_LABELS).map(id => {
    const prerequisites = SKILL_PREREQUISITES[id] || [];
    const modules = MODULES.filter(module => module.skills.includes(id));
    const score = Math.max(0, Math.min(100, Number(skills[id]) || 0));
    const prerequisitesMet = prerequisites.every(prerequisite => (Number(skills[prerequisite]) || 0) >= 40);
    const completedEvidence = modules.filter(module => completed.has(module.id)).length;
    const nextModule = modules.find(module => !completed.has(module.id)) || null;
    return {
      id,
      label: SKILL_LABELS[id],
      prerequisites,
      modules,
      score,
      prerequisitesMet,
      completedEvidence,
      nextModule,
      state: score >= 70 ? 'mastered' : prerequisitesMet ? 'available' : 'locked',
    };
  });
}
