import test from 'node:test';
import assert from 'node:assert/strict';
import { Fluid } from '../js/physics.js';
import { cloneScene, getScene } from '../js/scenes.js';

test('reset restores the same seeded initial state', () => {
  const scene = cloneScene(getScene('step-drop'));
  const fluid = new Fluid(640, 960, scene);
  const before = fluid.initialSignature();
  fluid.step(1 / 120, { x: 0, y: 900 });
  const reset = fluid.reset(scene);
  assert.deepEqual(reset, before);
});

test('resize reprojects particles without respawning them', () => {
  const scene = cloneScene(getScene('gear-flow'));
  const fluid = new Fluid(400, 800, scene);
  const first = { ...fluid.p[0] };
  const count = fluid.p.length;
  fluid.resize(800, 400);
  assert.equal(fluid.p.length, count);
  assert.ok(Math.abs(fluid.p[0].x - first.x * 2) < 1e-6);
  assert.ok(Math.abs(fluid.p[0].y - first.y * 0.5) < 1e-6);
});

test('linked gears propagate angular velocity in the configured direction', () => {
  const scene = cloneScene(getScene('gear-flow'));
  const fluid = new Fluid(800, 600, scene);
  fluid.wheels[0].omega = 2;
  fluid.wheels[1].omega = 0;
  fluid.applyGearLinks();
  assert.ok(fluid.wheels[1].omega < 0);
});
