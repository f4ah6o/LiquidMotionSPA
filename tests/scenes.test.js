import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLevel } from '../js/level.js';
import { createRng } from '../js/random.js';
import { cloneScene, getScene, SCENES } from '../js/scenes.js';

function signature(level) {
  return {
    segments: level.segments.map(segment => [segment.x1, segment.y1, segment.x2, segment.y2].map(value => Number(value.toFixed(3)))),
    wheels: level.wheels,
    seesaws: level.seesaws,
    gates: level.gates,
    spawnX: level.spawnX.map(value => Number(value.toFixed(3))),
  };
}

test('all fixed scenes have stable JSON-compatible definitions', () => {
  for (const scene of SCENES) {
    assert.equal(scene.schemaVersion, 1);
    assert.ok(scene.id);
    assert.ok(scene.seed);
    assert.doesNotThrow(() => JSON.stringify(scene));
  }
});

test('same scene and seed produce the same geometry', () => {
  const scene = cloneScene(getScene('gear-flow'));
  const a = buildLevel(800, 600, scene, createRng(`${scene.id}:${scene.seed}:layout`));
  const b = buildLevel(800, 600, scene, createRng(`${scene.id}:${scene.seed}:layout`));
  assert.deepEqual(signature(a), signature(b));
});

test('mirrored configured ramps preserve point symmetry', () => {
  const scene = cloneScene(getScene('step-drop'));
  const level = buildLevel(800, 600, scene, createRng(`${scene.id}:${scene.seed}:layout`));
  const expected = scene.layout.ramps.length * 2;
  const configured = level.segments.slice(-expected);
  for (let i = 0; i < configured.length; i += 2) {
    const a = configured[i];
    const b = configured[i + 1];
    assert.ok(Math.abs((a.x1 + b.x1) - 800) < 1e-6);
    assert.ok(Math.abs((a.y1 + b.y1) - 600) < 1e-6);
    assert.ok(Math.abs((a.x2 + b.x2) - 800) < 1e-6);
    assert.ok(Math.abs((a.y2 + b.y2) - 600) < 1e-6);
  }
});
