import { supabase } from '../lib/supabaseClient.js';

// Production uses the same FastAPI origin that serves the React bundle. During
// Vite development, /api is forwarded to the local FastAPI server by vite.config.js.
const runtimeConfig = globalThis.__QUANTUMLEARN_CONFIG__ || {};

const API_URL = (
  ((import.meta.env || {}).VITE_QUANTUM_API_URL || '') ||
  runtimeConfig.VITE_QUANTUM_API_URL ||
  ''
).replace(/\/$/, '');

async function request(path, options = {}) {
  const { data: { session } = {} } = supabase ? await supabase.auth.getSession() : { data: {} };
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || body.error || `Quantum API request failed (${response.status}).`);
  return body;
}

export function buildQiskitCircuit(ops, qubits) {
  const lines = ['from qiskit import QuantumCircuit', '', `qc = QuantumCircuit(${qubits})`];
  [...ops].filter(op => op.gate !== 'M').sort((a, b) => a.col - b.col).forEach((op) => {
    const gate = op.gate.toLowerCase();
    if (['rx', 'ry', 'rz'].includes(gate)) lines.push(`qc.${gate}(${Number(op.angle || Math.PI / 2)}, ${op.target})`);
    else if (op.gate === 'CNOT') lines.push(`qc.cx(${op.control}, ${op.target})`);
    else if (['CZ', 'SWAP'].includes(op.gate)) lines.push(`qc.${gate}(${op.control}, ${op.target})`);
    else if (['H', 'X', 'Y', 'Z', 'S', 'T'].includes(op.gate)) lines.push(`qc.${gate}(${op.target})`);
  });
  lines.push('qc.measure_all()');
  return lines.join('\n');
}

// Some earlier deployments returned measurements/counts without a `success`
// flag. Treat those as a completed execution instead of showing a false error.
export function normalizeExecutionResult(result) {
  if (!result || typeof result !== 'object' || result.success === true) return result;
  const measurements = result.measurements || result.counts;
  if (!measurements && !result.probabilities) return result;
  return {
    ...result,
    success: true,
    measurements: result.measurements || result.counts || {},
    counts: result.counts || result.measurements || {},
  };
}

export async function executeCircuit({ framework = 'qiskit', code, shots = 1024 }) {
  const result = await request('/api/quantum/execute', { method: 'POST', body: JSON.stringify({ framework, code, shots }) });
  return normalizeExecutionResult(result);
}

export async function getCapabilities() { return request('/api/capabilities'); }

export async function getIbmBackends() { return request('/api/ibm/backends'); }

export function normalizeIbmJobSubmission(result) {
  if (result?.success === true && typeof result.job_id === 'string' && result.job_id && typeof result.backend === 'string' && result.backend) {
    return result;
  }
  throw new Error(result?.detail || result?.error || 'The quantum backend returned an incomplete IBM job response. Deploy the FastAPI backend and configure IBM_QUANTUM_API_KEY and IBM_QUANTUM_INSTANCE in Render.');
}

export async function submitIbmJob({ backend, shots, code }) {
  const result = await request('/api/ibm/run', { method: 'POST', body: JSON.stringify({ backend, shots, code }) });
  return normalizeIbmJobSubmission(result);
}

export async function getIbmJob(jobId) { return request(`/api/jobs/ibm/${encodeURIComponent(jobId)}`); }

export const getContests = () => request('/api/contests');
export const getContest = (contestId) => request(`/api/contests/${encodeURIComponent(contestId)}`);
export const getContestProblem = (contestId, problemId) => request(`/api/contests/${encodeURIComponent(contestId)}/problems/${encodeURIComponent(problemId)}`);
export const submitContestProblem = (contestId, problemId, submission) => request(`/api/contests/${encodeURIComponent(contestId)}/problems/${encodeURIComponent(problemId)}/submit`, { method: 'POST', body: JSON.stringify(submission) });
export const getContestLeaderboard = (contestId) => request(`/api/contests/${encodeURIComponent(contestId)}/leaderboard`);
export const getMyContestRating = () => request('/api/contests/me/rating');

export const getGamificationSummary = () => request('/api/gamification/summary');
export const getWeeklyLeaderboard = () => request('/api/gamification/leaderboard/weekly');
export const submitCircuitMission = (missionId, payload) => request(
  `/api/gamification/circuit-missions/${encodeURIComponent(missionId)}/submit`,
  { method: 'POST', body: JSON.stringify(payload) },
);

export const getNotifications = () => request('/api/notifications');
export const markNotificationRead = (notificationId = null, all = false) => request('/api/notifications/read', {
  method: 'POST',
  body: JSON.stringify({ notification_id: notificationId, all }),
});
export const getChallengeProgress = (challengeId) => request(`/api/challenges/${encodeURIComponent(challengeId)}`);
export const saveChallengeProgress = (challengeId, payload) => request(`/api/challenges/${encodeURIComponent(challengeId)}`, {
  method: 'PUT',
  body: JSON.stringify({ challenge_id: challengeId, ...payload }),
});

export const adminApi = {
  dashboard: () => request('/api/admin/dashboard'),
  settings: () => request('/api/admin/settings'),
  updateSettings: (values) => request('/api/admin/settings', { method: 'PUT', body: JSON.stringify(values) }),
  contests: () => request('/api/admin/contests'),
  createContest: (values) => request('/api/admin/contests', { method: 'POST', body: JSON.stringify(values) }),
  updateContest: (contestId, values) => request(`/api/admin/contests/${encodeURIComponent(contestId)}`, { method: 'PATCH', body: JSON.stringify(values) }),
  users: (search = '') => request(`/api/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  updateUserRole: (userId, role) => request(`/api/admin/users/${encodeURIComponent(userId)}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  auditLogs: () => request('/api/admin/audit-logs'),
  content: (entity, search = '') => request(`/api/admin/content/${encodeURIComponent(entity)}${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createContent: (entity, values) => request(`/api/admin/content/${encodeURIComponent(entity)}`, { method: 'POST', body: JSON.stringify(values) }),
  updateContent: (entity, id, values) => request(`/api/admin/content/${encodeURIComponent(entity)}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(values) }),
  archiveContent: (entity, id) => request(`/api/admin/content/${encodeURIComponent(entity)}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
