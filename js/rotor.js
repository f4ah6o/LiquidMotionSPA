// Dynamic obstacles: paddle wheel (spun by droplet impacts) and seesaw
// (tips over when enough liquid pools on one side).

import { makeSeg } from './level.js';

export class Wheel {
  constructor(cx, cy, r, paddles = 6) {
    this.cx = cx; this.cy = cy; this.r = r;
    this.paddles = paddles;
    this.angle = 0;
    this.omega = 0;      // rad/s
    this.torque = 0;     // accumulated from particle impacts
    this.segments = [];
    this.rebuild();
  }

  rebuild() {
    this.segments.length = 0;
    for (let i = 0; i < this.paddles; i++) {
      const a = this.angle + (i * Math.PI * 2) / this.paddles;
      this.segments.push(makeSeg(
        this.cx + Math.cos(a) * this.r * 0.18,
        this.cy + Math.sin(a) * this.r * 0.18,
        this.cx + Math.cos(a) * this.r,
        this.cy + Math.sin(a) * this.r,
      ));
    }
  }

  step(dt) {
    this.omega += (this.torque / (this.r * this.r * 40)) * dt;
    this.omega *= Math.pow(0.35, dt); // fluid drag
    this.omega = Math.max(-6, Math.min(6, this.omega));
    this.angle += this.omega * dt;
    this.torque = 0;
    this.rebuild();
  }

  // called by physics when a particle is pushed out at (px,py) with impulse (ix,iy)
  applyImpulse(px, py, ix, iy) {
    const rx = px - this.cx, ry = py - this.cy;
    this.torque += (rx * iy - ry * ix) * 60;
  }

  // velocity of the paddle surface at a point (for dragging particles along)
  surfaceVel(px, py) {
    const rx = px - this.cx, ry = py - this.cy;
    return { x: -ry * this.omega, y: rx * this.omega };
  }
}

export class Seesaw {
  constructor(cx, cy, half) {
    this.cx = cx; this.cy = cy; this.half = half;
    this.angle = 0.12;
    this.omega = 0;
    this.torque = 0;
    this.maxAngle = 0.45;
    this.segments = [];
    this.rebuild();
  }

  rebuild() {
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    this.segments.length = 0;
    this.segments.push(makeSeg(
      this.cx - c * this.half, this.cy - s * this.half,
      this.cx + c * this.half, this.cy + s * this.half,
    ));
  }

  step(dt) {
    this.omega += (this.torque / (this.half * this.half * 60)) * dt;
    this.omega *= Math.pow(0.25, dt);
    this.angle += this.omega * dt;
    if (this.angle > this.maxAngle) { this.angle = this.maxAngle; this.omega = 0; }
    if (this.angle < -this.maxAngle) { this.angle = -this.maxAngle; this.omega = 0; }
    this.torque = 0;
    this.rebuild();
  }

  applyImpulse(px, py, ix, iy) {
    const rx = px - this.cx, ry = py - this.cy;
    this.torque += (rx * iy - ry * ix) * 60;
  }

  // weight of resting particles tilts the plank
  applyWeight(px, py, gx, gy) {
    const rx = px - this.cx, ry = py - this.cy;
    this.torque += (rx * gy - ry * gx) * 0.02;
  }

  surfaceVel(px, py) {
    const rx = px - this.cx, ry = py - this.cy;
    return { x: -ry * this.omega, y: rx * this.omega };
  }
}
