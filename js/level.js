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

  // --- top tray with exactly two nozzles (bottom tray is the point mirror):
  // an OUT nozzle draining downward and a wider IN nozzle that catches the
  // stream falling from the other tray's OUT after a flip. Placing them at
  // xIn = w - xOut makes the point-mirrored bottom OUT sit in the same
  // column as the top IN, so the hourglass loop works both ways up.
  const trayY = rand(0.08, 0.11) * h;
  const spoutLen = rand(0.035, 0.05) * h;
  const outHalfW = Math.max(4.5 * r, rand(0.045, 0.06) * m);
  const xOut = rand(0.20, 0.34) * w;
  const gaps = [
    { x: xOut, halfW: outHalfW },
    { x: w - xOut, halfW: outHalfW * 1.4 }, // IN: wider for an easy landing
  ].sort((a, b) => a.x - b.x);

  const topSegs = [];
  // tray pieces between gaps, each with a constant grade down toward its
  // nearest nozzle edge so liquid never rests anywhere on the tray
  const edges = [0, ...gaps.flatMap(g => [g.x - g.halfW, g.x + g.halfW]), w];
  for (let i = 0; i < edges.length; i += 2) {
    const x1 = edges[i], x2 = edges[i + 1];
    if (x2 - x1 < r) continue;
    const leftIsGap = i > 0, rightIsGap = i + 1 < edges.length - 1;
    if (leftIsGap && rightIsGap) {
      // piece between the two nozzles: peak in the middle, draining both ways
      const xm = (x1 + x2) / 2;
      const drop = (xm - x1) * TRAY_GRADE;
      topSegs.push([x1, trayY, xm, trayY - drop]);
      topSegs.push([xm, trayY - drop, x2, trayY]);
    } else if (rightIsGap) {
      topSegs.push([x1, trayY - (x2 - x1) * TRAY_GRADE, x2, trayY]);
    } else {
      topSegs.push([x1, trayY, x2, trayY - (x2 - x1) * TRAY_GRADE]);
    }
  }
  // spout walls: short verticals on both sides of each gap, pointing out of
  // the reservoir (pure geometry; they just shape the falling stream)
  for (const g of gaps) {
    topSegs.push([g.x - g.halfW, trayY, g.x - g.halfW, trayY + spoutLen]);
    topSegs.push([g.x + g.halfW, trayY, g.x + g.halfW, trayY + spoutLen]);
  }
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
