import assert from 'node:assert/strict';
import test from 'node:test';
import { getSkillTree } from './skillTree.js';

test('skill tree locks dependent skills until their prerequisite has evidence', () => {
  const tree = getSkillTree({ mathematics: 30, qubits: 0 });
  assert.equal(tree.find(node => node.id === 'qubits').state, 'locked');
  assert.equal(tree.find(node => node.id === 'mathematics').state, 'available');
});

test('skill tree maps nodes to actual curriculum modules', () => {
  const tree = getSkillTree({ mathematics: 80 }, { completedModules: [1] });
  const mathematics = tree.find(node => node.id === 'mathematics');
  assert.equal(mathematics.state, 'mastered');
  assert.deepEqual(mathematics.modules.map(module => module.id), [1]);
  assert.equal(mathematics.completedEvidence, 1);
});
