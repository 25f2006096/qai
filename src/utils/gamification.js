export const LEVELS = [
  { number: 1, name: 'Quantum Novice', threshold: 0 },
  { number: 2, name: 'Qubit Explorer', threshold: 100 },
  { number: 3, name: 'Gate Navigator', threshold: 250 },
  { number: 4, name: 'Circuit Builder', threshold: 500 },
  { number: 5, name: 'Entanglement Engineer', threshold: 900 },
  { number: 6, name: 'Quantum Architect', threshold: 1400 },
];

export function levelForXp(value = 0) {
  const totalXp = Math.max(0, Number(value) || 0);
  const currentIndex = LEVELS.reduce((best, level, index) => totalXp >= level.threshold ? index : best, 0);
  const current = LEVELS[currentIndex];
  const next = LEVELS[currentIndex + 1] || null;
  const progressPercent = next
    ? Math.max(0, Math.min(100, Math.floor(((totalXp - current.threshold) / (next.threshold - current.threshold)) * 100)))
    : 100;

  return {
    ...current,
    nextThreshold: next?.threshold ?? null,
    progressPercent,
  };
}

export function missionLabel(status) {
  return ({ completed: 'Completed', mastered: 'Mastered', in_progress: 'In progress', available: 'Available' })[status] || 'Available';
}
