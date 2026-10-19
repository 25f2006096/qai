import test from 'node:test';
import assert from 'node:assert/strict';
import { levelForXp, missionLabel } from './gamification.js';

test('levelForXp uses deterministic inclusive thresholds', () => {
  assert.deepEqual(levelForXp(0), {
    number: 1,
    name: 'Quantum Novice',
    threshold: 0,
    nextThreshold: 100,
    progressPercent: 0,
  });
  assert.equal(levelForXp(100).number, 2);
  assert.equal(levelForXp(500).name, 'Circuit Builder');
  assert.equal(levelForXp(1400).progressPercent, 100);
});

test('levelForXp clamps invalid and over-threshold values safely', () => {
  assert.equal(levelForXp(-30).number, 1);
  assert.equal(levelForXp('not-a-number').progressPercent, 0);
  assert.equal(levelForXp(5000).number, 6);
  assert.equal(levelForXp(5000).progressPercent, 100);
});

test('missionLabel never exposes a raw unknown status', () => {
  assert.equal(missionLabel('available'), 'Available');
  assert.equal(missionLabel('completed'), 'Completed');
  assert.equal(missionLabel('unexpected'), 'Available');
});