import { makeSeg } from './level.js';

export class Wheel {
  constructor(cx, cy, r, paddles = 8, id = '') {
    this.id = id;
    this.cx = cx;
    this.cy = cy;
    this.r = r;
    this.paddles = paddles;
    this.angle = 0;
    this.omega = 0;
    this.torque = 0;
    this.segments = [];
    this.rebuild();
  }

  rebuild() {
    this.segments.length = 0;
    const step = (Math.PI * 2) / this.paddles;
    for (let i = 0; i < this.paddles; i++) {
      const angle = this.angle + i * step;
      const tipX = this.cx + Math.cos(angle) * this.r;
      const tipY = this.cy + Math.sin(angle) * this.r;
      this.segments.push(makeSeg(
        this.cx + Math.cos(angle) * this.r * 0.18,
        this.cy + Math.sin(angle) * this.r * 0.18,
        tipX,
        tipY,
      ));
      const lipAngle = angle + step * 0.45;
      this.segments.push(makeSeg(
        tipX,
        tipY,
        this.cx + Math.cos(lipAngle) * this.r * 0.88,
        this.cy + Math.sin(lipAngle) * this.r * 0.88,
      ));
    }
  }

  step(dt) {
    this.omega += (this.torque / (this.r * this.r * 4)) * dt;
    this.omega *= Math.pow(0.6, dt);
    this.omega = Math.max(-8, Math.min(8, this.omega));
    this.angle += this.omega * dt;
    this.torque = 0;
    this.rebuild();
  }

  applyImpulse(px, py, ix, iy) {
    const rx = px - this.cx;
    const ry = py - this.cy;
    this.torque += (rx * iy - ry * ix) * 600;
  }

  applyWeight(px, py, gx, gy) {
    const rx = px - this.cx;
    const ry = py - this.cy;
    this.torque += (rx * gy - ry * gx) * 0.1;
  }

  surfaceVel(px, py) {
    const rx = px - this.cx;
    const ry = py - this.cy;
    return { x: -ry * this.omega, y: rx * this.omega };
  }
}

export class Seesaw {
  constructor(cx, cy, half, id = '') {
    this.id = id;
    this.cx = cx;
    this.cy = cy;
    this.half = half;
    this.angle = 0.12;
    this.omega = 0;
    this.torque = 0;
    this.maxAngle = 0.45;
    this.segments = [];
    this.rebuild();
  }

  rebuild() {
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    this.segments = [makeSeg(
      this.cx - cos * this.half,
      this.cy - sin * this.half,
      this.cx + cos * this.half,
      this.cy + sin * this.half,
    )];
  }

  step(dt) {
    this.omega += (this.torque / (this.half * this.half * 60)) * dt;
    this.omega *= Math.pow(0.25, dt);
    this.angle += this.omega * dt;
    if (this.angle > this.maxAngle) {
      this.angle = this.maxAngle;
      this.omega = 0;
    }
    if (this.angle < -this.maxAngle) {
      this.angle = -this.maxAngle;
      this.omega = 0;
    }
    this.torque = 0;
    this.rebuild();
  }

  applyImpulse(px, py, ix, iy) {
    const rx = px - this.cx;
    const ry = py - this.cy;
    this.torque += (rx * iy - ry * ix) * 60;
  }

  applyWeight(px, py, gx, gy) {
    const rx = px - this.cx;
    const ry = py - this.cy;
    this.torque += (rx * gy - ry * gx) * 0.02;
  }

  surfaceVel(px, py) {
    const rx = px - this.cx;
    const ry = py - this.cy;
    return { x: -ry * this.omega, y: rx * this.omega };
  }
}

export class Gate {
  constructor(cx, cy, half, options = {}) {
    this.id = options.id || '';
    this.cx = cx;
    this.cy = cy;
    this.half = half;
    this.closedAngle = options.closedAngle ?? 0;
    this.openAngle = options.openAngle ?? Math.PI / 2;
    this.threshold = options.threshold ?? 10;
    this.angle = this.closedAngle;
    this.contactCharge = 0;
    this.openAmount = 0;
    this.segments = [];
    this.rebuild();
  }

  step(dt) {
    this.contactCharge = Math.max(0, this.contactCharge - dt * 2.5);
    const target = this.contactCharge >= this.threshold ? 1 : 0;
    this.openAmount += (target - this.openAmount) * Math.min(1, dt * 4.5);
    this.angle = this.closedAngle + (this.openAngle - this.closedAngle) * this.openAmount;
    this.rebuild();
  }

  noteContact(amount = 0.18) {
    this.contactCharge = Math.min(this.threshold * 1.6, this.contactCharge + amount);
  }

  applyImpulse() {
    this.noteContact(0.4);
  }

  applyWeight() {
    this.noteContact(0.24);
  }

  surfaceVel() {
    return { x: 0, y: 0 };
  }

  rebuild() {
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    this.segments = [makeSeg(
      this.cx - cos * this.half,
      this.cy - sin * this.half,
      this.cx + cos * this.half,
      this.cy + sin * this.half,
    )];
  }
}
