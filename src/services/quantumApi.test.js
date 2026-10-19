import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQiskitCircuit, normalizeExecutionResult, normalizeIbmJobSubmission } from './quantumApi.js';

test('accepts complete responses from current quantum backend', () => {
  const response = { success: true, measurements: { '00': 64 } };
  assert.equal(normalizeExecutionResult(response), response);
});

test('accepts legacy measurement responses without a success flag', () => {
  assert.deepEqual(normalizeExecutionResult({ counts: { '11': 64 } }), {
    success: true,
    measurements: { '11': 64 },
    counts: { '11': 64 },
  });
});

test('leaves an incomplete response as a failure', () => {
  const response = { detail: 'Backend unavailable' };
  assert.equal(normalizeExecutionResult(response), response);
});

test('accepts a complete IBM job response', () => {
  const response = { success: true, job_id: 'job-123', backend: 'ibm_brisbane', status: 'QUEUED' };
  assert.equal(normalizeIbmJobSubmission(response), response);
});

test('rejects an incomplete IBM job response instead of showing a fake queued job', () => {
  assert.throws(() => normalizeIbmJobSubmission({ success: true }), /incomplete IBM job response/i);
});

test('buildQiskitCircuit serializes supported challenge operations safely', () => {
  const code = buildQiskitCircuit([
    { gate: 'H', target: 0, col: 0 },
    { gate: 'CNOT', control: 0, target: 1, col: 1 },
    { gate: 'M', target: 0, col: 2 },
  ], 2);
  assert.match(code, /qc\.h\(0\)/);
  assert.match(code, /qc\.cx\(0, 1\)/);
  assert.match(code, /qc\.measure_all\(\)/);
});
