// Procedural level geometry, regenerated on every buildLevel() call.
// The vessel keeps its hourglass structure: a top and bottom reservoir tray,
// each pierced by plain gaps (pure geometry — no valves or throttling; flow
// through a gap emerges from gravity, particle repulsion and cohesion alone).
// Everything below the top tray — cascade ramps (段差), gear wheels (歯車)
// and seesaws (シーソー) — is randomly generated. The whole layout is
// point-symmetric ((x,y) → (w-x, h-y)) so it plays the same after a 180° flip.

const WALL_INSET_FRAC = 0.015; // sealed glass wall thickness (of min(w,h))
const TRAY_GRADE = 0.05;       // constant tray grade toward the nozzles

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));

export function buildLevel(w, h) {
  const m = Math.min(w, h);
  const r = Math.max(4, m * 0.014); // particle radius (matches physics.js)
  const segs = [];

  // --- top tray with exactly two nozzles (bottom tray is the point mirror).
  // ROLES (see CLAUDE.md): the DRIP nozzle drains the reservoir; the CATCH
  // nozzle only receives the stream falling from the other tray's drip
  // nozzle after a flip. Both are pure geometry — the roles come from the
  // tray heights alone: the drip gap is the lowest point of the tray and
  // the catch gap sits at the highest point, so resting liquid always
  // slides away from the catch and out through the drip. Placing them at
  // xCatch = w - xDrip makes the point-mirrored bottom drip sit in the
  // same column as the top catch, so the hourglass loop works both ways up.
  const trayY = rand(0.08, 0.11) * h;
  const spoutLen = rand(0.035, 0.05) * h;
  const dripHalfW = Math.max(4.5 * r, rand(0.045, 0.06) * m);
  const catchHalfW = dripHalfW * 1.4; // wider for an easy landing
  const xDrip = rand(0.20, 0.34) * w;
  const xCatch = w - xDrip;
  const gaps = [
    { x: xDrip, halfW: dripHalfW },
    { x: xCatch, halfW: catchHalfW },
  ];

  // tray heights: lowest (trayY) at the drip gap, rising at a constant
  // grade toward the catch gap, which is the peak of the whole tray
  const eDripL = xDrip - dripHalfW, eDripR = xDrip + dripHalfW;
  const eCatchL = xCatch - catchHalfW, eCatchR = xCatch + catchHalfW;
  const yCatch = trayY - (eCatchL - eDripR) * TRAY_GRADE;
  const topSegs = [
    // wall → drip gap (down toward the drip)
    [0, trayY - eDripL * TRAY_GRADE, eDripL, trayY],
    // drip gap → catch gap (monotonic rise; drains back to the drip)
    [eDripR, trayY, eCatchL, yCatch],
    // stub beyond the catch: only stray splash lands here; it tilts gently
    // into the catch gap so nothing pools in the wall corner
    [eCatchR, yCatch, w, yCatch - (w - eCatchR) * TRAY_GRADE * 0.5],
    // spout walls: short verticals on both sides of each gap, pointing out
    // of the reservoir. On the drip they shape the falling stream; on the
    // catch (once flipped underneath) they act as a funnel for the stream.
    [eDripL, trayY, eDripL, trayY + spoutLen],
    [eDripR, trayY, eDripR, trayY + spoutLen],
    [eCatchL, yCatch, eCatchL, yCatch + spoutLen],
    [eCatchR, yCatch, eCatchR, yCatch + spoutLen],
  ];
  segs.push(...topSegs);
  // bottom reservoir: point-symmetric mirror
  segs.push(...topSegs.map(([x1, y1, x2, y2]) => [w - x1, h - y1, w - x2, h - y2]));

  // --- cascade ramps (段差) in the upper mid band, mirrored below ---
  const nRamps = randInt(2, 3); // ×2 by mirroring → 4..6 total
  const yTop = 0.20 * h, yBot = 0.48 * h;
  const rampSegs = [];
  for (let i = 0; i < nRamps; i++) {
    const y = yTop + ((i + rand(0.2, 0.8)) / nRamps) * (yBot - yTop);
    const len = rand(0.2, 0.34) * w;
    const x1 = rand(0.06, 0.94 - len / w) * w;
    const tilt = rand(0.04, 0.08) * h * (i % 2 ? -1 : 1);
    rampSegs.push([x1, y - tilt / 2, x1 + len, y + tilt / 2]);
  }
  segs.push(...rampSegs);
  segs.push(...rampSegs.map(([x1, y1, x2, y2]) => [w - x1, h - y1, w - x2, h - y2]));

  const segments = segs.map(([x1, y1, x2, y2]) => makeSeg(x1, y1, x2, y2));

  // --- rotors: 1..2 gear wheels, 1..2 seesaws, placed without overlaps ---
  const wheels = [], seesaws = [];
  const placed = []; // {x, y, rad} keep-out circles
  const clear = (x, y, rad) => {
    const pad = rad + 3.5 * r;
    if (x < pad || x > w - pad || y < 0.16 * h + pad || y > 0.84 * h - pad) return false;
    if (placed.some(o => Math.hypot(o.x - x, o.y - y) < o.rad + pad)) return false;
    return segments.every(s => segDist(s, x, y) > pad);
  };
  const place = (rad, xHint) => {
    for (let t = 0; t < 80; t++) {
      const x = xHint !== undefined && t < 30
        ? xHint + rand(-0.08, 0.08) * w
        : rand(0.12, 0.88) * w;
      const y = rand(0.2, 0.8) * h;
      if (clear(x, y, rad)) {
        placed.push({ x, y, rad });
        return { x, y };
      }
    }
    return null;
  };

  // first wheel aims for the fall path under a top gap
  const nWheels = randInt(1, 2), nSeesaws = randInt(1, 2);
  for (let i = 0; i < nWheels; i++) {
    const rad = rand(0.07, 0.11) * m;
    const at = place(rad * 1.15, i === 0 ? gaps[0].x : undefined);
    if (at) wheels.push({ x: at.x, y: at.y, r: rad });
  }
  for (let i = 0; i < nSeesaws; i++) {
    const half = rand(0.10, 0.15) * m;
    const at = place(half, i === 0 && gaps.length > 1 ? gaps[1].x : undefined);
    if (at) seesaws.push({ x: at.x, y: at.y, half });
  }

  return {
    segments,
    wheels,
    seesaws,
    // sealed vessel: glass wall thickness; physics clamps particles inside
    // it and the renderer draws the frame at this width
    inset: m * WALL_INSET_FRAC,
  };
}

// distance from point to segment
function segDist(s, x, y) {
  let t = ((x - s.x1) * s.dx + (y - s.y1) * s.dy) / (s.len * s.len);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (s.x1 + s.dx * t), y - (s.y1 + s.dy * t));
}

export function makeSeg(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return { x1, y1, x2, y2, dx, dy, len, nx: -dy / len, ny: dx / len };
}
