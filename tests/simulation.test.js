import test from 'node:test';
import assert from 'node:assert/strict';
import { SIMULATION_STATES, SimulationController } from '../js/simulation.js';

test('pause blocks stepping and resume restores it', () => {
  const simulation = new SimulationController();
  simulation.start();
  assert.equal(simulation.shouldStep(), true);
  simulation.pause();
  assert.equal(simulation.state, SIMULATION_STATES.PAUSED);
  assert.equal(simulation.shouldStep(), false);
  simulation.resume();
  assert.equal(simulation.shouldStep(), true);
});

test('flip returns to the previous playback state', () => {
  const simulation = new SimulationController();
  simulation.start();
  simulation.pause();
  assert.equal(simulation.beginFlip(), true);
  assert.equal(simulation.state, SIMULATION_STATES.FLIPPING);
  simulation.finishFlip();
  assert.equal(simulation.state, SIMULATION_STATES.PAUSED);
});

test('only supported speeds are accepted', () => {
  const simulation = new SimulationController();
  simulation.setSpeed(2);
  assert.equal(simulation.speed, 2);
  assert.throws(() => simulation.setSpeed(1.5), RangeError);
});
