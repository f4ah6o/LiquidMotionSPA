// Procedural level geometry, regenerated on every buildLevel() call.
// The vessel keeps its hourglass structure: a top and bottom reservoir tray,
// each pierced by plain gaps (pure geometry — no valves or throttling; flow
// through a gap emerges from gravity, particle repulsion and cohesion alone).
// Everything below the top tray — cascade ramps (段差), gear wheels (歯車)
// and seesaws (シーソー) — is randomly generated. The whole layout is
// point-symmetric ((x,y) → (w-x, h-y)) so it plays the same after a 180° flip.

const WALL_INSET_FRAC = 0.015; // sealed glass wall thickness (of min(w,h))
const TRAY_GRADE = 0.09;       // constant tray grade toward the drip nozzle

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));

export function buildLevel(w, h) {
  const m = Math.min(w, h);
  const r = Math.max(4, m * 0.014); // particle radius (matches physics.js)
  const segs = [];

  // --- top tray: ONE monotonic incline spanning the full width, with two
  // nozzle gaps cut into it (bottom tray is the point mirror). ROLES (see
  // CLAUDE.md): the CATCH nozzle sits near the HIGH end and only receives
  // the stream falling from the other tray's drip after a flip; the DRIP
  // nozzle sits near the LOW end and is the only outlet — resting liquid
  // always slides down the incline away from the catch and out the drip.
  // The point mirror inverts high/low, so the same tray works in both
  // orientations. Placing the gaps at xCatch = w - xDrip keeps the bottom
  // drip in the same column as the top catch for the hourglass loop.
  const spoutLen = rand(0.035, 0.05) * h;
  // narrow outlet: the drip rate is set by this width alone (pure geometry)
  const dripHalfW = Math.max(2.8 * r, rand(0.028, 0.036) * m);
  const catchHalfW = dripHalfW * 1.4; // wider for an easy landing
  const highOnLeft = Math.random() < 0.5;
  // the drip gap runs (almost) flush to the low wall — a ledge between the
  // gap and the wall would trap liquid, breaking the monotonic drain
  const sliver = rand(0.5, 1.5) * r;
  const xDrip = highOnLeft ? w - dripHalfW - sliver : dripHalfW + sliver;
  const xCatch = w - xDrip; // high side, flush to the opposite wall
  const yHigh = rand(0.06, 0.09) * h;
  // cap the total drop so wide (landscape) vessels keep a shallow tray
  const grade = Math.min(TRAY_GRADE, 0.09 * h / w);
  const trayAt = x => yHigh + (highOnLeft ? x : w - x) * grade;
  const gaps = [
    { x: xDrip, halfW: dripHalfW },
    { x: xCatch, halfW: catchHalfW },
  ].sort((a, b) => a.x - b.x);

  const topSegs = [];
  // collinear tray pieces along the incline, split by the two gaps
  const edges = [0, ...gaps.flatMap(g => [g.x - g.halfW, g.x + g.halfW]), w];
  for (let i = 0; i < edges.length; i += 2) {
    const x1 = edges[i], x2 = edges[i + 1];
    if (x2 - x1 < 3 * r) continue; // drop wall-side slivers: gap meets wall
    topSegs.push([x1, trayAt(x1), x2, trayAt(x2)]);
  }
  // nozzle walls: ONLY the catch gets walls — two, STANDING INTO the
  // reservoir — a raised rim that keeps reservoir liquid out of the catch.
  // The drip has no walls (the incline leads straight into the hole), so
  // the tray's underside — the receiving face once flipped — is perfectly
  // smooth and the arriving stream can never snag on its way to the catch.
  for (const x of [xCatch - catchHalfW, xCatch + catchHalfW]) {
    if (x <= 0 || x >= w) continue; // outer edge may coincide with the wall
    topSegs.push([x, trayAt(x), x, trayAt(x) - spoutLen]);
  }
  segs.push(...topSegs);
  // bottom reservoir: point-symmetric mirror
  segs.push(...topSegs.map(([x1, y1, x2, y2]) => [w - x1, h - y1, w - x2, h - y2]));

  // --- zigzag staircase (階段) under the drip column, mirrored below ---
  // the signature piece of the real toy: short, nearly level steps offset
  // alternately, so falling beads land on a step, creep to its lip and drip
  // to the next one — pacing emerges from step tilt and surface friction
  const yTop = 0.20 * h, yBot = 0.48 * h;
  const stairSegs = [];
  {
    const nSteps = randInt(4, 7);
    const stepLen = rand(0.10, 0.16) * w;
    const dropY = (yBot - yTop) / nSteps; // vertical gap between steps
    const stepTilt = rand(0.010, 0.020) * h; // gentle grade toward the lip
    // zigzag direction: first step carries the drip stream inward. The
    // drip gap is flush to the wall, so its stream falls along the wall —
    // the first step's back edge must reach the wall to catch it.
    let dir = xDrip < w / 2 ? 1 : -1;
    let xLip = xDrip + dir * stepLen * rand(0.9, 1.1);
    for (let i = 0; i < nSteps; i++) {
      const y = yTop + (i + 0.5) * dropY;
      let xBack = xLip - dir * stepLen;
      // clamp the back edge to the wall (a slightly long first tread is
      // fine); if the lip itself runs out of room, turn the zigzag around
      xBack = Math.max(0.02 * w, Math.min(0.98 * w, xBack));
      if (xLip < 0.06 * w || xLip > 0.94 * w) {
        dir = -dir;
        xLip = xBack + dir * stepLen;
      }
      stairSegs.push([xBack, y - stepTilt, xLip, y]);
      // next step: reversed, its lip roughly half a step back past this
      // one, so the drop from this lip lands on the next tread — slightly
      // asymmetric so the staircase marches diagonally across the vessel
      // like the real toy's, instead of hugging one wall
      dir = -dir;
      const toCenter = (w / 2 - xLip) * dir > 0;
      xLip = xLip + dir * stepLen * (toCenter ? rand(0.6, 0.75) : rand(0.35, 0.5));
    }
  }
  segs.push(...stairSegs);
  segs.push(...stairSegs.map(([x1, y1, x2, y2]) => [w - x1, h - y1, w - x2, h - y2]));

  // --- a ramp or two (段差) elsewhere in the mid band, mirrored below ---
  const nRamps = randInt(0, 1); // ×2 by mirroring
  const rampSegs = [];
  for (let i = 0; i < nRamps; i++) {
    const y = yTop + rand(0.2, 0.8) * (yBot - yTop);
    const len = rand(0.2, 0.34) * w;
    const x1 = rand(0.06, 0.94 - len / w) * w;
    const tilt = rand(0.04, 0.08) * h * (i % 2 ? -1 : 1);
    const seg = [x1, y - tilt / 2, x1 + len, y + tilt / 2];
    // don't cut through the staircase column
    const nearStairs = stairSegs.some(([sx1, , sx2]) =>
      Math.min(x1, x1 + len) < Math.max(sx1, sx2) + 0.05 * w &&
      Math.max(x1, x1 + len) > Math.min(sx1, sx2) - 0.05 * w);
    if (!nearStairs) rampSegs.push(seg);
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

  // where the liquid may start: the drip side of the catch rim, so nothing
  // spawns over (or behind) the catch gap
  const spawnX = highOnLeft
    ? [xCatch + catchHalfW + 3 * r, 0.95 * w]
    : [0.05 * w, xCatch - catchHalfW - 3 * r];

  return {
    segments,
    wheels,
    seesaws,
    spawnX,
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
