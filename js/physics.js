// Droplet fluid: Verlet particles with short-range repulsion (incompressibility)
// and cohesion (surface tension). Blobs split and merge emergently, and flow
// through tray gaps is driven by gravity and inter-particle forces alone —
// there are no valves, throttles or scripted velocities anywhere.

import { buildLevel } from './level.js';
import { Wheel, Seesaw } from './rotor.js';

// The sealed vessel is completely filled: everything around the colored
// droplets is an immiscible ambient fluid of lower specific gravity (the
// "clear oil" of a real liquid motion timer). It isn't simulated as
// particles — it acts on the droplets as buoyancy (reduced effective
// gravity) and viscous drag toward a terminal velocity.
const BUOYANCY = 0.35;       // rho_medium / rho_droplet
const DAMP_BASE = 0.45;      // velocity kept per second (drag in the medium)
const PRESSURE_STIFFNESS = 2800; // soft incompressibility in px/s²
const REST_DENSITY = 2.0;        // normalized 2-D neighbor density
const MUTUAL_VISCOSITY = 1.8;    // pairwise liquid shear damping

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
    this.wheels = this.level.wheels.map(o => new Wheel(o.x, o.y, o.r));
    this.seesaws = this.level.seesaws.map(o => new Seesaw(o.x, o.y, o.half));
    this.r = Math.max(4, Math.min(w, h) * 0.014); // particle radius
    this.depth = Math.min(w, h) * DEPTH_FRAC;     // vessel thickness (z axis)
    this.inset = this.level.inset;                // sealed glass wall thickness
    this.hue = Math.floor(Math.random() * 360);   // single droplet color
    this.spawn();
    // spatial hash
    this.cell = this.r * 4.4;
    this.grid = new Map();
  }

  spawn() {
    const n = 170;
    this.p = [];
    for (let i = 0; i < n; i++) {
      // start pooled inside the top reservoir, on the drip-nozzle side —
      // never over the catch gap, which only receives liquid from below
      const [sx0, sx1] = this.level.spawnX;
      const x = sx0 + Math.random() * (sx1 - sx0);
      const y = this.h * (0.02 + Math.random() * 0.035); // above the tray
      const z = (Math.random() - 0.5) * this.depth * 0.9;
      this.p.push({ x, y, px: x, py: y, z, pz: z });
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

    // spatial hash. The cell is as wide as the cohesion kernel so a narrow
    // nozzle still sees every particle that can contribute to a neck.
    const cell = this.cell, grid = this.grid;
    grid.clear();
    for (let i = 0; i < p.length; i++) {
      const k = ((p[i].x / cell) | 0) * 4096 + ((p[i].y / cell) | 0);
      let b = grid.get(k);
      if (!b) grid.set(k, b = []);
      b.push(i);
    }

    // Estimate local density before applying pressure. This is a deliberately
    // small, normalized SPH-style pass: it keeps a blob nearly incompressible
    // while allowing a thin neck to stretch and pinch off at the drip edge.
    const rep = 1.9 * r, coh = 4.4 * r;
    const density = new Float32Array(p.length);
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
          const d = Math.hypot(dx, dy);
          if (d >= coh || d < 1e-9) continue;
          const w = 1 - d / coh;
          const weight = w * w;
          density[i] += weight;
          density[j] += weight;
        }
      }
    }

    // Pairwise pressure, cohesion, and viscous shear. Every term is a
    // symmetric force between particles; there is no nozzle-specific motion
    // or release timer here, so drops detach only when gravity wins naturally.
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
          const ux = dx / d, uy = dy / d;

          // Pressure only acts where local density exceeds the resting liquid
          // density. It is soft enough to keep the liquid deformable.
          const over = Math.max(0, density[i] - REST_DENSITY)
            + Math.max(0, density[j] - REST_DENSITY);
          if (over) {
            const grad = (1 - d / coh) / coh;
            const push = over * PRESSURE_STIFFNESS * grad * dt * dt;
            a.x -= ux * push * 0.5; a.y -= uy * push * 0.5;
            q.x += ux * push * 0.5; q.y += uy * push * 0.5;
          }

          // Short-range contact plus longer-range surface tension. The
          // attraction reaches across a few particles, which lets a drop
          // keep a rounded meniscus while its neck becomes one particle wide.
          let f = 0;
          if (d < rep) {
            f = -(rep - d) * 0.62;
          } else {
            f = (d - rep) * 0.035;
          }
          if (f) {
            f = Math.max(-r * 0.55, Math.min(r * 0.14, f));
            a.x += ux * f * 0.5; a.y += uy * f * 0.5;
            q.x -= ux * f * 0.5; q.y -= uy * f * 0.5;
          }

          // Mutual viscous drag is applied as a force, not by assigning a
          // target velocity. It damps ripples inside a blob but preserves the
          // tangential motion needed to slide along the tray.
          const avx = (a.x - a.px) / dt, avy = (a.y - a.py) / dt;
          const qvx = (q.x - q.px) / dt, qvy = (q.y - q.py) / dt;
          const shear = MUTUAL_VISCOSITY * Math.pow(1 - d / coh, 2) * dt * dt;
          a.x += (qvx - avx) * shear * 0.5;
          a.y += (qvy - avy) * shear * 0.5;
          q.x -= (qvx - avx) * shear * 0.5;
          q.y -= (qvy - avy) * shear * 0.5;
        }
      }
    }

    // collisions: walls, static segments, rotors
    for (const wl of this.wheels) wl.step(dt);
    for (const ss of this.seesaws) ss.step(dt);
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
      for (const wl of this.wheels) {
        for (const s of wl.segments) {
          if (collideSeg(a, s, r, wl, dt)) {
            wl.applyWeight(a.x, a.y, g.x, g.y);
          }
        }
      }
      for (const ss of this.seesaws) {
        for (const s of ss.segments) {
          if (collideSeg(a, s, r, ss, dt)) {
            ss.applyWeight(a.x, a.y, g.x, g.y);
          }
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
    // tangential friction + slight normal restitution: beads sit on surfaces
    // instead of wetting/smearing along them (large contact angle)
    a.px = a.x - (vx - vn * ux) * 0.95 + vn * ux * 0.25;
    a.py = a.y - (vy - vn * uy) * 0.95 + vn * uy * 0.25;
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
