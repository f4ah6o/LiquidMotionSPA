// Droplet fluid: Verlet particles with short-range repulsion (incompressibility)
// and same-color cohesion (surface tension). Blobs split and merge emergently.

import { buildLevel } from './level.js';
import { Wheel, Seesaw } from './rotor.js';

const HUES = [196, 330, 45]; // cyan, pink, amber droplet colors
const DRIP_INTERVAL = 0.18;  // seconds between released drops per nozzle

// The sealed vessel is completely filled: everything around the colored
// droplets is an immiscible ambient fluid of lower specific gravity (the
// "clear oil" of a real liquid motion timer). It isn't simulated as
// particles — it acts on the droplets as buoyancy (reduced effective
// gravity) and viscous drag toward a terminal velocity.
const BUOYANCY = 0.35;       // rho_medium / rho_droplet
const DAMP_BASE = 0.45;      // velocity kept per second (drag in the medium)

// Shallow depth axis: particles get a z coordinate confined to the vessel
// thickness. Gravity has no z component (device tilt is x/y), so a tiny
// jitter keeps the liquid spread through the depth.
const DEPTH_FRAC = 0.3;      // vessel thickness as a fraction of min(w,h)
const Z_JITTER = 0.08;       // per-step z jitter as a fraction of r

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
    this.depth = Math.min(w, h) * DEPTH_FRAC;     // vessel thickness (z axis)
    this.inset = this.level.inset;                // sealed glass wall thickness
    // one-way drip nozzles with per-nozzle release timers
    this.nozzles = this.level.nozzles.map(n => ({
      ...n,
      halfW: this.level.nozzleHalfW,
      throatLen: this.level.nozzleLen,
      timer: Math.random() * DRIP_INTERVAL, // desync the drips
      pass: null,
    }));
    this.catches = this.level.catches.map(n => ({
      ...n,
      halfW: this.level.catchHalfW,
    }));
    this.spawn();
    // spatial hash
    this.cell = this.r * 3.4;
    this.grid = new Map();
  }

  spawn() {
    const n = 170;
    this.p = [];
    for (let i = 0; i < n; i++) {
      // start pooled inside the top reservoir, grouped by color into three puddles
      const hue = HUES[i % HUES.length];
      const gx = (HUES.indexOf(hue) + 0.5) / HUES.length;
      const x = this.w * Math.min(0.96, Math.max(0.04, gx + (Math.random() - 0.5) * 0.24));
      const y = this.h * (0.02 + Math.random() * 0.035); // above the tray funnel
      const z = (Math.random() - 0.5) * this.depth * 0.9;
      this.p.push({ x, y, px: x, py: y, z, pz: z, hue });
    }
  }

  step(dt, g) {
    const p = this.p, r = this.r;
    const damp = Math.pow(DAMP_BASE, dt); // drag in the ambient medium
    const geff = 1 - BUOYANCY;            // buoyancy of the ambient medium

    // integrate (Verlet)
    for (const a of p) {
      const vx = (a.x - a.px) * damp;
      const vy = (a.y - a.py) * damp;
      const vz = (a.z - a.pz) * damp;
      a.px = a.x; a.py = a.y; a.pz = a.z;
      a.x += vx + g.x * geff * dt * dt;
      a.y += vy + g.y * geff * dt * dt;
      a.z += vz + (Math.random() - 0.5) * r * Z_JITTER;
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
    const rep = 2.0 * r, coh = 3.0 * r;
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const cx = (a.x / cell) | 0, cy = (a.y / cell) | 0;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const b = grid.get((cx + ox) * 4096 + (cy + oy));
        if (!b) continue;
        for (const j of b) {
          if (j <= i) continue;
          const q = p[j];
          const dx = q.x - a.x, dy = q.y - a.y, dz = q.z - a.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= coh * coh || d2 < 1e-9) continue;
          const d = Math.sqrt(d2);
          let f = 0;
          if (d < rep) {
            f = -(rep - d) * 0.5; // push apart, strong
          } else if (a.hue === q.hue) {
            f = (d - rep) * 0.16; // pull together (high surface tension -> round beads)
          }
          if (f) {
            f = Math.max(-r * 0.5, Math.min(r * 0.25, f));
            const ux = dx / d, uy = dy / d, uz = dz / d;
            a.x += ux * f * 0.5; a.y += uy * f * 0.5; a.z += uz * f * 0.5;
            q.x -= ux * f * 0.5; q.y -= uy * f * 0.5; q.z -= uz * f * 0.5;
          }
        }
      }
    }

    // collisions: walls, static segments, rotors
    this.wheel.step(dt);
    this.seesaw.step(dt);
    const statics = this.level.segments;
    for (const a of p) {
      // sealed container walls (inset by the glass thickness) + depth clamp
      const lo = this.inset + r;
      if (a.x < lo) a.x = lo;
      if (a.x > this.w - lo) a.x = this.w - lo;
      if (a.y < lo) a.y = lo;
      if (a.y > this.h - lo) a.y = this.h - lo;
      const zLim = this.depth / 2 - r;
      if (a.z < -zLim) { a.z = -zLim; a.pz = a.z; }
      if (a.z > zLim) { a.z = zLim; a.pz = a.z; }

      for (const s of statics) collideSeg(a, s, r, null, dt);
      for (const s of this.wheel.segments) {
        if (collideSeg(a, s, r, this.wheel, dt)) {
          this.wheel.applyWeight(a.x, a.y, g.x, g.y);
        }
      }
      for (const s of this.seesaw.segments) {
        if (collideSeg(a, s, r, this.seesaw, dt)) {
          this.seesaw.applyWeight(a.x, a.y, g.x, g.y);
        }
      }
    }

    this.throttleNozzles(dt, g);
    this.catchValves(dt, g);
  }

  // Catch openings are plain gaps in the tray; this makes them one-way.
  // Particles crossing the gap plane inward (filling) pass freely; particles
  // pushing outward from inside the reservoir are snapped back to the plane.
  // Because there is no depth axis in 2D, liquid resting on a closed valve
  // would sit over the gap forever, so while the valve is holding (this
  // reservoir is the upper one) it also drifts that liquid sideways toward
  // the drip nozzle, letting it rejoin the draining flow.
  catchValves(dt, g) {
    const gm = Math.hypot(g.x, g.y) || 1;
    const band = this.r * 2;
    for (const c of this.catches) {
      // holding = gravity pulls this reservoir's liquid out through the gap
      const holding = -c.dir * g.y > 0.3 * gm;
      for (const a of this.p) {
        if (Math.abs(a.x - c.x) > c.halfW) continue;
        const out = (a.y - c.y) * -c.dir; // >0 once past the plane, outward
        if (out < -band || out > band) continue;
        if (out > 0) {
          // snap back just inside the reservoir
          a.y = c.y + c.dir * 0.5;
          a.py = a.y;
        }
        // liquid resting on the closed valve drifts toward the drip nozzle
        if (holding) a.x += c.driftX * this.r * 0.4 * dt * 60;
      }
    }
  }

  // Constant-rate drip: the currently-upper reservoir's nozzles hold liquid
  // at the tray plane and release one particle per DRIP_INTERVAL. Nozzles of
  // the lower reservoir pass liquid freely (filling direction).
  throttleNozzles(dt, g) {
    const gm = Math.hypot(g.x, g.y) || 1;
    for (const nz of this.nozzles) {
      nz.timer = Math.max(-0.01, nz.timer - dt);
      // draining only when gravity points out of this nozzle's reservoir
      if (nz.dir * g.y < 0.3 * gm) { nz.pass = null; continue; }

      // released drop stays owned until it clears the throat; pull it through
      // so surface tension can't suck it back into the reservoir blob
      if (nz.pass) {
        const d = (nz.pass.y - nz.y) * nz.dir;
        if (d > nz.throatLen || d < -this.r || Math.abs(nz.pass.x - nz.x) > nz.halfW) {
          nz.pass = null;
        } else {
          nz.pass.py = nz.pass.y - nz.dir * 2.5; // ~300 px/s through the spout
        }
      }

      let candidate = null;
      for (const a of this.p) {
        if (a === nz.pass) continue;
        if (Math.abs(a.x - nz.x) > nz.halfW) continue;
        const depth = (a.y - nz.y) * nz.dir;
        if (depth > nz.throatLen) continue;
        if (depth <= 0) {
          // suction: draw reservoir liquid over the gap into the throat,
          // overpowering the blob's cohesion (meniscus forming a drop)
          if (depth > -4 * this.r) a.y += nz.dir * this.r * 0.12;
          continue;
        }
        // hold at the tray plane (valve closed between drips)
        a.y = nz.y - nz.dir * 0.5;
        a.py = a.y;
        if (!candidate) candidate = a;
      }
      if (candidate && !nz.pass && nz.timer <= 0) {
        nz.pass = candidate;
        nz.timer = DRIP_INTERVAL;
        // nudge the drop through the plane so it starts falling
        candidate.y = nz.y + nz.dir * 1.5;
        candidate.py = candidate.y;
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
    // tangential friction + slight normal restitution: beads sit on surfaces
    // instead of wetting/smearing along them (large contact angle)
    a.px = a.x - (vx - vn * ux) * 0.90 + vn * ux * 0.25;
    a.py = a.y - (vy - vn * uy) * 0.90 + vn * uy * 0.25;
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
