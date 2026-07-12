// Device orientation -> gravity vector. Handles the iOS 13+ permission gate,
// screen rotation compensation, and a desktop fallback (flip button / double-tap
// rotates gravity 180° with a short animation).

const G = 900; // px/s^2

export class OrientationInput {
  constructor() {
    this.gx = 0;
    this.gy = G;
    this.hasSensor = false;
    this.flipOffset = 0;       // extra rotation from manual flips (radians)
    this.flipTarget = 0;
    this._raw = null;
  }

  // Call from a user gesture (start button tap).
  async enable() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') return false;
      } catch {
        return false;
      }
    }
    window.addEventListener('deviceorientation', (e) => {
      if (e.beta === null || e.gamma === null) return;
      this.hasSensor = true;
      this._raw = { beta: e.beta, gamma: e.gamma };
    });
    return true;
  }

  flip() {
    this.flipTarget += Math.PI;
  }

  // dt-aware update; returns gravity vector {x, y} in screen coordinates.
  update(dt) {
    // animate manual flip smoothly (~0.5s)
    const diff = this.flipTarget - this.flipOffset;
    if (Math.abs(diff) > 1e-4) {
      this.flipOffset += diff * Math.min(1, dt * 7);
    } else {
      this.flipOffset = this.flipTarget;
    }

    let gx = 0, gy = G;
    if (this.hasSensor && this._raw) {
      const b = (this._raw.beta * Math.PI) / 180;
      const c = (this._raw.gamma * Math.PI) / 180;
      // gravity direction in device coords (portrait reference)
      gx = Math.sin(c) * Math.cos(b) * G;
      gy = Math.sin(b) * G;
      // compensate current screen rotation
      const angle = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * Math.PI / 180;
      const ca = Math.cos(-angle), sa = Math.sin(-angle);
      const rx = gx * ca - gy * sa;
      const ry = gx * sa + gy * ca;
      gx = rx; gy = ry;
      // keep magnitude sensible (near-flat device -> weak gravity is fine/pretty)
      const m = Math.hypot(gx, gy);
      if (m > G) { gx = (gx / m) * G; gy = (gy / m) * G; }
    }

    // apply manual flip rotation
    const co = Math.cos(this.flipOffset), so = Math.sin(this.flipOffset);
    this.gx = gx * co - gy * so;
    this.gy = gx * so + gy * co;
    return { x: this.gx, y: this.gy };
  }
}
