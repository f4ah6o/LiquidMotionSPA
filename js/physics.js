// Droplet fluid: Verlet particles with short-range repulsion (incompressibility)
// and same-color cohesion (surface tension). Blobs split and merge emergently.

import { buildLevel } from './level.js';
import { Wheel, Seesaw } from './rotor.js';

const HUES = [196, 330, 45]; // cyan, pink, amber droplet colors

export class Fluid {
  constructor(w, h) {
    this.resize(w, h);
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.level = buildLevel(w, h);
    this.wheel = new Wheel(this.level.wheel.x, this.level.wheel.y, this.level.wheel.r);
    this.seesaw = new Seesaw(this.level.seesaw.x, this.level.seesaw.y, this.level.seesaw.half);
    this.r = Math.max(4, Math.min(w, h) * 0.014); // particle radius
    this.spawn();
    // spatial hash
    this.cell = this.r * 3.4;
    this.grid = new Map();
  }

  spawn() {
    const n = 210;
    this.p = [];
    for (let i = 0; i < n; i++) {
      // start pooled near the top, grouped by color into three puddles
      const hue = HUES[i % HUES.length];
      const gx = (HUES.indexOf(hue) + 0.5) / HUES.length;
      const x = this.w * (gx + (Math.random() - 0.5) * 0.22);
      const y = this.h * (0.03 + Math.random() * 0.09);
      this.p.push({ x, y, px: x, py: y, hue });
    }
  }

  step(dt, g) {
    const p = this.p, r = this.r;
    const damp = Math.pow(0.6, dt); // viscous oil feel

    // integrate (Verlet)
    for (const a of p) {
      const vx = (a.x - a.px) * damp;
      const vy = (a.y - a.py) * damp;
      a.px = a.x; a.py = a.y;
      a.x += vx + g.x * dt * dt;
      a.y += vy + g.y * dt * dt;
    }

    // spatial hash
    const cell = this.cell, grid = this.grid;
    grid.clear();
    for (let i = 0; i < p.length; i++) {
      const k = ((p[i].x / cell) | 0) * 4096 + ((p[i].y / cell) | 0);
      let b = grid.get(k);
      if (!b) grid.set(k, b = []);
      b.push(i);
    }

    // pairwise: repulsion + cohesion
    const rep = 2.0 * r, coh = 3.2 * r;
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const cx = (a.x / cell) | 0, cy = (a.y / cell) | 0;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const b = grid.get((cx + ox) * 4096 + (cy + oy));
        if (!b) continue;
        for (const j of b) {
          if (j <= i) continue;
          const q = p[j];
          const dx = q.x - a.x, dy = q.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= coh * coh || d2 < 1e-9) continue;
          const d = Math.sqrt(d2);
          let f = 0;
          if (d < rep) {
            f = -(rep - d) * 0.5; // push apart, strong
          } else if (a.hue === q.hue) {
            f = (d - rep) * 0.08; // pull together, gentle (surface tension)
          }
          if (f) {
            const ux = dx / d, uy = dy / d;
            a.x += ux * f * 0.5; a.y += uy * f * 0.5;
            q.x -= ux * f * 0.5; q.y -= uy * f * 0.5;
          }
        }
      }
    }

    // collisions: walls, static segments, rotors
    this.wheel.step(dt);
    this.seesaw.step(dt);
    const statics = this.level.segments;
    for (const a of p) {
      // container walls
      if (a.x < r) a.x = r;
      if (a.x > this.w - r) a.x = this.w - r;
      if (a.y < r) a.y = r;
      if (a.y > this.h - r) a.y = this.h - r;

      for (const s of statics) collideSeg(a, s, r, null, dt);
      for (const s of this.wheel.segments) collideSeg(a, s, r, this.wheel, dt);
      for (const s of this.seesaw.segments) {
        if (collideSeg(a, s, r, this.seesaw, dt)) {
          this.seesaw.applyWeight(a.x, a.y, g.x, g.y);
        }
      }
    }
  }
}

// Push particle out of a capsule around segment s; returns true on contact.
// If rotor is given, transfer impulse to it and drag particle with its surface.
function collideSeg(a, s, r, rotor, dt) {
  const pad = r + 3;
  // closest point on segment
  let t = ((a.x - s.x1) * s.dx + (a.y - s.y1) * s.dy) / (s.len * s.len);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = s.x1 + s.dx * t, qy = s.y1 + s.dy * t;
  let dx = a.x - qx, dy = a.y - qy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= pad * pad) return false;
  const d = Math.sqrt(d2) || 1e-6;
  const push = pad - d;
  const ux = dx / d, uy = dy / d;
  a.x += ux * push;
  a.y += uy * push;
  // remove inward normal velocity (keep tangential -> slides along surface)
  const vx = a.x - a.px, vy = a.y - a.py;
  const vn = vx * ux + vy * uy;
  if (vn < 0) {
    a.px = a.x - (vx - vn * ux) * 0.96; // slight tangential friction
    a.py = a.y - (vy - vn * uy) * 0.96;
    if (rotor) rotor.applyImpulse(a.x, a.y, -vn * ux, -vn * uy);
  }
  if (rotor) {
    // drag particle with the moving surface a little
    const sv = rotor.surfaceVel(a.x, a.y);
    a.px -= sv.x * dt * 0.5;
    a.py -= sv.y * dt * 0.5;
  }
  return true;
}
