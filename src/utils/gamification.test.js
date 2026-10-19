import test from 'node:test';
import assert from 'node:assert/strict';
import { getLevelFromXP, getProgressToNextLevel } from './gamification.js';

test('level progress resets cleanly at an exact level boundary', () => {
  assert.equal(getLevelFromXP(100), 2);
  assert.deepEqual(getProgressToNextLevel(100), { current: 0, total: 300, percentage: 0 });
});

test('level progress is measured within the current level band', () => {
  assert.deepEqual(getProgressToNextLevel(250), { current: 150, total: 300, percentage: 50 });
});
