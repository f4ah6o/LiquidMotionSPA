const G = 900;

export class OrientationInput {
  constructor() {
    this.gx = 0;
    this.gy = G;
    this.hasSensor = false;
    this.sensorEnabled = true;
    this.flipOffset = 0;
    this._raw = null;
    this._listening = false;
  }

  isSupported() {
    return typeof window !== 'undefined' && typeof window.DeviceOrientationEvent !== 'undefined';
  }

  async enable() {
    if (!this.isSupported()) return { supported: false, granted: false };

    const orientationEvent = window.DeviceOrientationEvent;
    if (typeof orientationEvent.requestPermission === 'function') {
      try {
        const result = await orientationEvent.requestPermission();
        if (result !== 'granted') return { supported: true, granted: false };
      } catch {
        return { supported: true, granted: false };
      }
    }

    if (!this._listening) {
      window.addEventListener('deviceorientation', event => {
        if (event.beta === null || event.gamma === null) return;
        this.hasSensor = true;
        this._raw = { beta: event.beta, gamma: event.gamma };
      });
      this._listening = true;
    }
    return { supported: true, granted: true };
  }

  setSensorEnabled(enabled) {
    this.sensorEnabled = Boolean(enabled);
  }

  commitFlip() {
    this.flipOffset = (this.flipOffset + Math.PI) % (Math.PI * 2);
  }

  reset() {
    this.flipOffset = 0;
    this.gx = 0;
    this.gy = G;
  }

  update() {
    let gx = 0;
    let gy = G;
    if (this.sensorEnabled && this.hasSensor && this._raw) {
      const beta = (this._raw.beta * Math.PI) / 180;
      const gamma = (this._raw.gamma * Math.PI) / 180;
      gx = Math.sin(gamma) * Math.cos(beta) * G;
      gy = Math.sin(beta) * G;

      const screenAngle = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * Math.PI / 180;
      const cos = Math.cos(-screenAngle);
      const sin = Math.sin(-screenAngle);
      const rotatedX = gx * cos - gy * sin;
      const rotatedY = gx * sin + gy * cos;
      gx = rotatedX;
      gy = rotatedY;

      const magnitude = Math.hypot(gx, gy);
      if (magnitude > G) {
        gx = (gx / magnitude) * G;
        gy = (gy / magnitude) * G;
      }
    }

    const cos = Math.cos(this.flipOffset);
    const sin = Math.sin(this.flipOffset);
    this.gx = gx * cos - gy * sin;
    this.gy = gx * sin + gy * cos;
    return { x: this.gx, y: this.gy };
  }
}
