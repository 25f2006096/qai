// ==========================================
// XP REWARD RULES
// ==========================================
export const XP_REWARDS = {
  lesson_checkpoint: 10,
  quiz_pass: 20,
  challenge_solve: 30,
  circuit_challenge: 50,
  mastery_assessment: 75,
  major_milestone: 100,
  topic_complete: 15,
  module_complete: 100,
  puzzle_solve: 25,
  lab_experiment: 20,
};

// ==========================================
// LEVEL THRESHOLDS
// Formula: level = floor(sqrt(xp / 100)) + 1
// ==========================================
export const getLevelFromXP = (xp) => {
  if (!xp || xp < 0) return 1;
  return Math.floor(Math.sqrt(xp / 100)) + 1;
};

export const getXPForLevel = (level) => {
  if (level <= 1) return 0;
  return Math.pow(level - 1, 2) * 100;
};

export const getProgressToNextLevel = (xp) => {
  const currentLevel = getLevelFromXP(xp);
  const xpForCurrentLevel = getXPForLevel(currentLevel);
  const xpForNextLevel = getXPForLevel(currentLevel + 1);
  const progress = xp - xpForCurrentLevel;
  const totalNeeded = xpForNextLevel - xpForCurrentLevel;
  return {
    current: progress,
    total: totalNeeded,
    percentage: Math.round((progress / totalNeeded) * 100),
  };
};

export const RANK_TITLES = [
  'Quantum Initiate', 'Qubit Explorer', 'Superposition Specialist',
  'Quantum Gate Engineer', 'Entanglement Researcher', 'Circuit Architect',
  'Quantum Algorithm Master', 'Quantum Pioneer',
];

export const getRankTitle = (xp) => RANK_TITLES[Math.min(getLevelFromXP(xp) - 1, RANK_TITLES.length - 1)];

// ==========================================
// MISSION HELPERS
// ==========================================
export const getMissionStatus = (module, progress) => {
  if (progress?.completedModules?.includes(module.id)) return 'completed';
  const prereqsMet = module.prereqs.every(p => progress?.completedModules?.includes(p));
  if (prereqsMet || module.prereqs.length === 0) return 'available';
  return 'locked';
};

export const getMissionXP = (module) => {
  // Base XP for completing a module
  return XP_REWARDS.module_complete;
};

export const getMissionType = (module) => {
  if (module.category === 'Foundations') return 'Learn';
  if (module.category === 'Intermediate') return 'Practice';
  if (module.category === 'Advanced') return 'Build';
  return 'Master';
};
