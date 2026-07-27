import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng, normalizeSeed } from '../js/random.js';

test('same seed yields the same sequence', () => {
  const a = createRng('scene-1');
  const b = createRng('scene-1');
  assert.deepEqual(Array.from({ length: 20 }, () => a()), Array.from({ length: 20 }, () => b()));
});

test('different seeds diverge', () => {
  const a = createRng('scene-a');
  const b = createRng('scene-b');
  assert.notDeepEqual(Array.from({ length: 8 }, () => a()), Array.from({ length: 8 }, () => b()));
});

test('empty seed is normalized', () => {
  assert.equal(normalizeSeed('  '), 'liquid-motion');
});
