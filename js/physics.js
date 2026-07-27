import { buildLevel } from './level.js';
import { createRng } from './random.js';
import { Gate, Seesaw, Wheel } from './rotor.js';

const PRESSURE_STIFFNESS = 2800;
const REST_DENSITY = 2;
const DEPTH_FRAC = 0.3;
const Z_JITTER = 0.08;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class Fluid {
  constructor(w, h, scene) {
    this.w = w;
    this.h = h;
    this.scene = scene;
    this.grid = new Map();
    this.reset(scene);
  }

  reset(scene = this.scene) {
    this.scene = JSON.parse(JSON.stringify(scene));
    this._build(`${this.scene.id}:${this.scene.seed}`);
    this.spawn();
    return this.initialSignature();
  }

  _build(seed) {
    this.layoutRng = createRng(`${seed}:layout`);
    this.spawnRng = createRng(`${seed}:spawn`);
    this.simRng = createRng(`${seed}:simulation`);
    this.level = buildLevel(this.w, this.h, this.scene, this.layoutRng);
    this.wheels = this.level.wheels.map(item => new Wheel(item.x, item.y, item.r, item.paddles || 8, item.id));
    this.seesaws = this.level.seesaws.map(item => new Seesaw(item.x, item.y, item.half, item.id));
    this.gates = this.level.gates.map(item => new Gate(item.x, item.y, item.half, item));
    this.r = Math.max(4, Math.min(this.w, this.h) * 0.014);
    this.depth = Math.min(this.w, this.h) * DEPTH_FRAC;
    this.inset = this.level.inset;
    this.hue = this.scene.fluid.hue;
    this.cell = this.r * 4.4;
  }

  spawn() {
    const count = this.scene.fluid.particleCount || 170;
    this.p = [];
    for (let i = 0; i < count; i++) {
      const [minX, maxX] = this.level.spawnX;
      const x = this.spawnRng.float(minX, maxX);
      const y = this.h * this.spawnRng.float(0.02, 0.055);
      const z = this.spawnRng.float(-0.45, 0.45) * this.depth;
      this.p.push({ x, y, px: x, py: y, z, pz: z });
    }
  }

  resize(w, h) {
    if (w === this.w && h === this.h) return;
    const oldW = this.w;
    const oldH = this.h;
    const oldDepth = this.depth;
    const particles = this.p;
    const wheelState = new Map(this.wheels.map(wheel => [wheel.id, { angle: wheel.angle, omega: wheel.omega }]));
    const seesawState = new Map(this.seesaws.map(seesaw => [seesaw.id, { angle: seesaw.angle, omega: seesaw.omega }]));
    const gateState = new Map(this.gates.map(gate => [gate.id, { contactCharge: gate.contactCharge, openAmount: gate.openAmount }]));

    this.w = w;
    this.h = h;
    this._build(`${this.scene.id}:${this.scene.seed}`);

    const scaleX = w / oldW;
    const scaleY = h / oldH;
    const scaleZ = this.depth / oldDepth;
    this.p = particles.map(particle => ({
      x: particle.x * scaleX,
      y: particle.y * scaleY,
      px: particle.px * scaleX,
      py: particle.py * scaleY,
      z: particle.z * scaleZ,
      pz: particle.pz * scaleZ,
    }));

    for (const wheel of this.wheels) Object.assign(wheel, wheelState.get(wheel.id) || {});
    for (const seesaw of this.seesaws) Object.assign(seesaw, seesawState.get(seesaw.id) || {});
    for (const gate of this.gates) Object.assign(gate, gateState.get(gate.id) || {});
  }

  initialSignature() {
    return this.p.slice(0, 12).map(particle => [particle.x, particle.y, particle.z].map(value => Number(value.toFixed(4))));
  }

  motionEnergy() {
    if (!this.p.length) return 0;
    let total = 0;
    for (const particle of this.p) total += Math.hypot(particle.x - particle.px, particle.y - particle.py);
    return total / this.p.length;
  }

  step(dt, gravity) {
    const particles = this.p;
    const radius = this.r;
    const fluid = this.scene.fluid;
    const buoyancy = clamp(fluid.ambientSpecificGravity / fluid.specificGravity, 0.1, 0.8);
    const dampingBase = clamp(0.56 - (fluid.viscosity - 1) * 0.18, 0.2, 0.78);
    const mutualViscosity = 1.8 * fluid.viscosity;
    const cohesionScale = fluid.cohesion;
    const damp = Math.pow(dampingBase, dt);
    const effectiveGravity = 1 - buoyancy;

    for (const particle of particles) {
      const velocityX = (particle.x - particle.px) * damp;
      const velocityY = (particle.y - particle.py) * damp;
      const velocityZ = (particle.z - particle.pz) * damp;
      particle.px = particle.x;
      particle.py = particle.y;
      particle.pz = particle.z;
      particle.x += velocityX + gravity.x * effectiveGravity * dt * dt;
      particle.y += velocityY + gravity.y * effectiveGravity * dt * dt;
      particle.z += velocityZ + this.simRng.float(-0.5, 0.5) * radius * Z_JITTER;
    }

    const cell = this.cell;
    this.grid.clear();
    for (let i = 0; i < particles.length; i++) {
      const key = ((particles[i].x / cell) | 0) * 4096 + ((particles[i].y / cell) | 0);
      const bucket = this.grid.get(key) || [];
      bucket.push(i);
      this.grid.set(key, bucket);
    }

    const repulsion = 1.9 * radius;
    const cohesion = 4.4 * radius;
    const density = new Float32Array(particles.length);
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const cellX = (particle.x / cell) | 0;
      const cellY = (particle.y / cell) | 0;
      for (let offsetX = -1; offsetX <= 1; offsetX++) for (let offsetY = -1; offsetY <= 1; offsetY++) {
        const bucket = this.grid.get((cellX + offsetX) * 4096 + (cellY + offsetY));
        if (!bucket) continue;
        for (const j of bucket) {
          if (j <= i) continue;
          const other = particles[j];
          const distance = Math.hypot(other.x - particle.x, other.y - particle.y);
          if (distance >= cohesion || distance < 1e-9) continue;
          const weight = (1 - distance / cohesion) ** 2;
          density[i] += weight;
          density[j] += weight;
        }
      }
    }

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const cellX = (particle.x / cell) | 0;
      const cellY = (particle.y / cell) | 0;
      for (let offsetX = -1; offsetX <= 1; offsetX++) for (let offsetY = -1; offsetY <= 1; offsetY++) {
        const bucket = this.grid.get((cellX + offsetX) * 4096 + (cellY + offsetY));
        if (!bucket) continue;
        for (const j of bucket) {
          if (j <= i) continue;
          const other = particles[j];
          const dx = other.x - particle.x;
          const dy = other.y - particle.y;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared >= cohesion * cohesion || distanceSquared < 1e-9) continue;
          const distance = Math.sqrt(distanceSquared);
          const unitX = dx / distance;
          const unitY = dy / distance;
          const excessDensity = Math.max(0, density[i] - REST_DENSITY) + Math.max(0, density[j] - REST_DENSITY);
          if (excessDensity) {
            const gradient = (1 - distance / cohesion) / cohesion;
            const push = excessDensity * PRESSURE_STIFFNESS * gradient * dt * dt;
            particle.x -= unitX * push * 0.5;
            particle.y -= unitY * push * 0.5;
            other.x += unitX * push * 0.5;
            other.y += unitY * push * 0.5;
          }

          let force = distance < repulsion
            ? -(repulsion - distance) * 0.62
            : (distance - repulsion) * 0.035 * cohesionScale;
          force = clamp(force, -radius * 0.55, radius * 0.14);
          particle.x += unitX * force * 0.5;
          particle.y += unitY * force * 0.5;
          other.x -= unitX * force * 0.5;
          other.y -= unitY * force * 0.5;

          const particleVelocityX = (particle.x - particle.px) / dt;
          const particleVelocityY = (particle.y - particle.py) / dt;
          const otherVelocityX = (other.x - other.px) / dt;
          const otherVelocityY = (other.y - other.py) / dt;
          const shear = mutualViscosity * (1 - distance / cohesion) ** 2 * dt * dt;
          particle.x += (otherVelocityX - particleVelocityX) * shear * 0.5;
          particle.y += (otherVelocityY - particleVelocityY) * shear * 0.5;
          other.x -= (otherVelocityX - particleVelocityX) * shear * 0.5;
          other.y -= (otherVelocityY - particleVelocityY) * shear * 0.5;
        }
      }
    }

    for (const wheel of this.wheels) wheel.step(dt);
    this.applyGearLinks();
    for (const seesaw of this.seesaws) seesaw.step(dt);
    for (const gate of this.gates) gate.step(dt);

    for (const particle of particles) {
      const lowerBound = this.inset + radius;
      particle.x = clamp(particle.x, lowerBound, this.w - lowerBound);
      particle.y = clamp(particle.y, lowerBound, this.h - lowerBound);
      const zLimit = this.depth / 2 - radius;
      if (particle.z < -zLimit || particle.z > zLimit) {
        particle.z = clamp(particle.z, -zLimit, zLimit);
        particle.pz = particle.z;
      }

      for (const segment of this.level.segments) collideSegment(particle, segment, radius, null, dt);
      for (const wheel of this.wheels) for (const segment of wheel.segments) {
        if (collideSegment(particle, segment, radius, wheel, dt)) wheel.applyWeight(particle.x, particle.y, gravity.x, gravity.y);
      }
      for (const seesaw of this.seesaws) for (const segment of seesaw.segments) {
        if (collideSegment(particle, segment, radius, seesaw, dt)) seesaw.applyWeight(particle.x, particle.y, gravity.x, gravity.y);
      }
      for (const gate of this.gates) for (const segment of gate.segments) {
        if (collideSegment(particle, segment, radius, gate, dt)) gate.applyWeight(particle.x, particle.y, gravity.x, gravity.y);
      }
    }
  }

  applyGearLinks() {
    const byId = new Map(this.wheels.map(wheel => [wheel.id, wheel]));
    for (const link of this.scene.mechanisms?.gearLinks || []) {
      const a = byId.get(link.a);
      const b = byId.get(link.b);
      if (!a || !b) continue;
      const direction = link.direction ?? -1;
      const ratio = link.ratio ?? 1;
      const coupling = link.coupling ?? 0.2;
      const targetB = a.omega * ratio * direction;
      b.omega += (targetB - b.omega) * coupling;
      const targetA = b.omega / (ratio * direction || 1);
      a.omega += (targetA - a.omega) * coupling * 0.25;
    }
  }
}

function collideSegment(particle, segment, radius, rotor, dt) {
  const padding = radius + 3;
  let t = ((particle.x - segment.x1) * segment.dx + (particle.y - segment.y1) * segment.dy) / (segment.len * segment.len);
  t = clamp(t, 0, 1);
  const closestX = segment.x1 + segment.dx * t;
  const closestY = segment.y1 + segment.dy * t;
  const dx = particle.x - closestX;
  const dy = particle.y - closestY;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared >= padding * padding) return false;
  const distance = Math.sqrt(distanceSquared) || 1e-6;
  const push = padding - distance;
  const unitX = dx / distance;
  const unitY = dy / distance;
  particle.x += unitX * push;
  particle.y += unitY * push;
  const velocityX = particle.x - particle.px;
  const velocityY = particle.y - particle.py;
  const normalVelocity = velocityX * unitX + velocityY * unitY;
  if (normalVelocity < 0) {
    particle.px = particle.x - (velocityX - normalVelocity * unitX) * 0.95 + normalVelocity * unitX * 0.25;
    particle.py = particle.y - (velocityY - normalVelocity * unitY) * 0.95 + normalVelocity * unitY * 0.25;
    if (rotor) rotor.applyImpulse(particle.x, particle.y, -normalVelocity * unitX, -normalVelocity * unitY);
  }
  if (rotor) {
    const surface = rotor.surfaceVel(particle.x, particle.y);
    particle.px -= surface.x * dt * 0.5;
    particle.py -= surface.y * dt * 0.5;
  }
  return true;
}
