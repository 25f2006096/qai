import assert from 'node:assert/strict';
import test from 'node:test';
import { getWorldMap } from './worldMap.js';

test('world map unlocks the next region only after the previous region is complete', () => {
  const initial = getWorldMap({ completedModules: [] });
  assert.equal(initial[0].state, 'available');
  assert.equal(initial[1].state, 'locked');

  const afterFirstRegion = getWorldMap({ completedModules: [1, 2] });
  assert.equal(afterFirstRegion[0].state, 'complete');
  assert.equal(afterFirstRegion[1].state, 'available');
});

test('world map reports genuine completion counts from stored module progress', () => {
  const map = getWorldMap({ completedModules: [1, 2, 3] });
  assert.equal(map[0].progress, 100);
  assert.equal(map[1].completedCount, 1);
  assert.equal(map[1].totalCount, 1);
  assert.equal(map[1].progress, 100);
  assert.equal(map[2].state, 'available');
});

test('world map defines all seven curriculum chapters without duplicate modules', () => {
  const map = getWorldMap({ completedModules: [] });
  const mappedIds = map.flatMap(region => region.modules.map(module => module.id));
  assert.equal(map.length, 7);
  assert.deepEqual(mappedIds, Array.from({ length: 24 }, (_, index) => index + 1));
});
