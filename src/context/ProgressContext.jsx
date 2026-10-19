import { createContext, useContext, useState, useEffect } from 'react';
import { storage, createDefaultProgress, createDefaultSkills } from '../utils/storage.js';
import { useAuth } from './AuthContext.jsx';
import { updateSkillsFromScore } from '../utils/adaptive.js';
import { MODULES } from '../data/modules.js';
import { getGamificationSummary } from '../services/quantumApi.js';

const ProgressContext = createContext({ progress: null, skills: null, gamification: null, gamificationLoading: false, gamificationError: '', refreshGamification: async () => null, getOverallKnowledge: () => 0 });

export function ProgressProvider({ children }) {
  const { user, refreshUser } = useAuth();
  const [progress, setProgress] = useState(null);
  const [skills, setSkills] = useState(null);
  const [gamification, setGamification] = useState(null);
  const [gamificationLoading, setGamificationLoading] = useState(false);
  const [gamificationError, setGamificationError] = useState('');

  useEffect(() => {
    let mounted = true;
    if (user) {
      setProgress(prev => prev || createDefaultProgress());
      setSkills(prev => prev || createDefaultSkills());
      Promise.all([
        storage.getProgress(user.id),
        storage.getSkills(user.id)
      ]).then(([p, s]) => {
        if (mounted) {
          setProgress(p);
          setSkills(s);
        }
      });
    } else {
      setProgress(null);
      setSkills(null);
      setGamification(null);
      setGamificationError('');
    }
    return () => { mounted = false; };
  }, [user]);

  const refreshGamification = async () => {
    if (!user) {
      setGamification(null);
      return null;
    }
    setGamificationLoading(true);
    setGamificationError('');
    try {
      const response = await getGamificationSummary();
      const summary = response?.summary || null;
      setGamification(summary);
      return summary;
    } catch (error) {
      setGamificationError(error.message || 'Unable to load your learning rewards.');
      return null;
    } finally {
      setGamificationLoading(false);
    }
  };

  useEffect(() => {
    if (user) refreshGamification();
  }, [user?.id]);

  const refreshRewardState = async () => {
    const summary = await refreshGamification();
    await refreshUser();
    return summary;
  };

  const updateProgress = (updates) => {
    if (!user || !progress) return;
    const p = { ...progress, ...updates, lastActive: new Date().toISOString() };
    storage.setProgress(user.id, p);
    setProgress(p);
  };

  const updateSkills = (updates) => {
    if (!user || !skills) return;
    const s = { ...skills, ...updates };
    storage.setSkills(user.id, s);
    setSkills(s);
  };

  const completeTopic = (moduleId, topicId) => {
    if (!user || !progress) return;
    const p = { ...progress };
    if (!p.completedTopics.includes(topicId)) {
      p.completedTopics.push(topicId);
    }
    p.lastActive = new Date().toISOString();
    
    // Update frontend state
    setProgress(p);
    
    // Update backend (fire and forget)
    storage.setProgress(user.id, p);
    storage.completeTopic(user.id, topicId, 100);
    storage.logActivity(user.id);
  };

  const completeModule = (moduleId, score) => {
    if (!user || !progress) return;
    const p = { ...progress };
    if (!p.completedModules.includes(moduleId)) {
      p.completedModules.push(moduleId);
    }
    p.moduleScores[moduleId] = score;
    p.lastActive = new Date().toISOString();
    
    setProgress(p);
    storage.setProgress(user.id, p);
    storage.completeModule(user.id, moduleId, score);
    storage.logActivity(user.id);
  };

  const recordTestScore = (moduleId, score, details) => {
    if (!user || !progress) return;
    const p = { ...progress };
    p.testHistory.push({ moduleId, score, details, date: new Date().toISOString() });
    p.moduleScores[moduleId] = Math.max(p.moduleScores[moduleId] || 0, score);
    
    setProgress(p);
    storage.setProgress(user.id, p);
    storage.recordTestScore(user.id, moduleId, score, details);
  };

  // Real-time skill update from exercise completion
  const updateSkillFromExercise = (skillNames, score) => {
    if (!user || !skills) return;
    const updated = updateSkillsFromScore(skills, skillNames, score);
    storage.setSkills(user.id, updated);
    storage.logActivity(user.id);
    setSkills(updated);
    return updated;
  };

  // Track gate usage for analytics
  const trackGateUsage = (gateName) => {
    if (!user) return;
    storage.trackGateUsage(user.id, gateName);
  };

  // Complete a circuit puzzle
  const completePuzzle = (puzzleId, relatedSkills) => {
    if (!user || !progress) return;
    storage.completePuzzle(user.id, puzzleId);
    const p = { ...progress };
    p.circuitsChallengesCompleted = (p.circuitsChallengesCompleted || 0) + 1;
    p.lastActive = new Date().toISOString();
    
    setProgress(p);
    storage.setProgress(user.id, p);
    storage.logActivity(user.id);
    // Update related skills
    if (relatedSkills && relatedSkills.length > 0) {
      updateSkillFromExercise(relatedSkills, 85);
    }
  };

  const getOverallKnowledge = () => {
    if (!skills) return 0;
    const vals = Object.values(skills);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  return (
    <ProgressContext.Provider value={{
      progress, skills, updateProgress, updateSkills,
      completeTopic, completeModule, recordTestScore, getOverallKnowledge,
      updateSkillFromExercise, trackGateUsage, completePuzzle,
      gamification, gamificationLoading, gamificationError,
      refreshGamification: refreshRewardState,
    }}>
      {children}
    </ProgressContext.Provider>
  );
}

export const useProgress = () => {
  const ctx = useContext(ProgressContext);
  if (!ctx) return { progress: null, skills: null, gamification: null, gamificationLoading: false, gamificationError: '', refreshGamification: async () => null, getOverallKnowledge: () => 0, updateProgress: () => {}, updateSkills: () => {}, completeTopic: () => {}, completeModule: () => {}, recordTestScore: () => {}, updateSkillFromExercise: () => {}, trackGateUsage: () => {}, completePuzzle: () => {} };
  return ctx;
};
