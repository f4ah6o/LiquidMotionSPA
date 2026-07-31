export const SIMULATION_STATES = Object.freeze({
  READY: 'ready',
  RUNNING: 'running',
  PAUSED: 'paused',
  SETTLED: 'settled',
  FLIPPING: 'flipping',
  RESETTING: 'resetting',
  UNSUPPORTED_INPUT: 'unsupported-input',
});

const SPEEDS = new Set([0.5, 1, 2]);

export class SimulationController {
  constructor(onChange = () => {}) {
    this.state = SIMULATION_STATES.READY;
    this.speed = 1;
    this.inputStatus = 'unknown';
    this._returnState = SIMULATION_STATES.RUNNING;
    this.onChange = onChange;
  }

  _set(state) {
    if (this.state === state) return;
    this.state = state;
    this.onChange(this.snapshot());
  }

  setInputStatus(status) {
    this.inputStatus = status;
    if (status === 'unsupported' && this.state === SIMULATION_STATES.READY) {
      this._set(SIMULATION_STATES.UNSUPPORTED_INPUT);
    } else {
      this.onChange(this.snapshot());
    }
  }

  start() {
    if ([SIMULATION_STATES.READY, SIMULATION_STATES.UNSUPPORTED_INPUT, SIMULATION_STATES.PAUSED, SIMULATION_STATES.SETTLED].includes(this.state)) {
      this._set(SIMULATION_STATES.RUNNING);
    }
  }

  pause() {
    if ([SIMULATION_STATES.RUNNING, SIMULATION_STATES.SETTLED].includes(this.state)) {
      this._set(SIMULATION_STATES.PAUSED);
    }
  }

  resume() {
    if ([SIMULATION_STATES.PAUSED, SIMULATION_STATES.SETTLED].includes(this.state)) {
      this._set(SIMULATION_STATES.RUNNING);
    }
  }

  togglePause() {
    if (this.state === SIMULATION_STATES.PAUSED) this.resume();
    else this.pause();
  }

  settle() {
    if (this.state === SIMULATION_STATES.RUNNING) this._set(SIMULATION_STATES.SETTLED);
  }

  beginFlip() {
    if (![SIMULATION_STATES.RUNNING, SIMULATION_STATES.PAUSED, SIMULATION_STATES.SETTLED].includes(this.state)) return false;
    this._returnState = this.state === SIMULATION_STATES.SETTLED ? SIMULATION_STATES.RUNNING : this.state;
    this._set(SIMULATION_STATES.FLIPPING);
    return true;
  }

  finishFlip() {
    if (this.state === SIMULATION_STATES.FLIPPING) this._set(this._returnState);
  }

  beginReset() {
    if (this.state === SIMULATION_STATES.RESETTING) return false;
    this._returnState = this.state === SIMULATION_STATES.PAUSED ? SIMULATION_STATES.PAUSED : SIMULATION_STATES.RUNNING;
    this._set(SIMULATION_STATES.RESETTING);
    return true;
  }

  finishReset() {
    if (this.state === SIMULATION_STATES.RESETTING) this._set(this._returnState);
  }

  setSpeed(speed) {
    const value = Number(speed);
    if (!SPEEDS.has(value)) throw new RangeError(`Unsupported speed: ${speed}`);
    this.speed = value;
    this.onChange(this.snapshot());
  }

  shouldStep() {
    return this.state === SIMULATION_STATES.RUNNING;
  }

  snapshot() {
    return { state: this.state, speed: this.speed, inputStatus: this.inputStatus };
  }
}
