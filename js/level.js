const WALL_INSET_FRAC = 0.015;
const TRAY_GRADE = 0.09;

const scaleSegment = (segment, w, h) => [
  segment.x1 * w,
  segment.y1 * h,
  segment.x2 * w,
  segment.y2 * h,
];

function mirrorSegment([x1, y1, x2, y2], w, h) {
  return [w - x1, h - y1, w - x2, h - y2];
}

function addConfiguredSegments(target, specs, w, h) {
  for (const spec of specs || []) {
    const segment = scaleSegment(spec, w, h);
    target.push(segment);
    if (spec.mirror) target.push(mirrorSegment(segment, w, h));
  }
}

function normalizeDynamic(spec, w, h, m) {
  return {
    ...spec,
    x: spec.x * w,
    y: spec.y * h,
    r: spec.r === undefined ? undefined : spec.r * m,
    half: spec.half === undefined ? undefined : spec.half * m,
  };
}

export function buildLevel(w, h, scene, rng) {
  const m = Math.min(w, h);
  const particleRadius = Math.max(4, m * 0.014);
  const random = rng || Math.random;
  const rand = (a, b) => a + random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const segmentsRaw = [];
  const layout = scene?.layout || { mode: 'procedural' };

  const spoutLen = rand(0.035, 0.05) * h;
  const dripHalfW = Math.max(3 * particleRadius, rand(0.026, 0.034) * m);
  const catchHalfW = Math.max(2.4 * particleRadius, dripHalfW * 1.8);
  const highOnLeft = layout.highOnLeft ?? (random() < 0.5);
  const sliver = rand(0.2, 0.6) * particleRadius;
  const xDrip = highOnLeft ? w - dripHalfW - sliver : dripHalfW + sliver;
  const xCatch = w - xDrip;
  const yHigh = rand(0.06, 0.09) * h;
  const grade = Math.min(TRAY_GRADE, 0.09 * h / w);
  const trayAt = x => yHigh + (highOnLeft ? x : w - x) * grade;
  const gaps = [
    { x: xDrip, halfW: dripHalfW },
    { x: xCatch, halfW: catchHalfW },
  ].sort((a, b) => a.x - b.x);

  const topSegments = [];
  const edges = [0, ...gaps.flatMap(gap => [gap.x - gap.halfW, gap.x + gap.halfW]), w];
  for (let i = 0; i < edges.length; i += 2) {
    const x1 = edges[i];
    const x2 = edges[i + 1];
    if (x2 - x1 >= 3 * particleRadius) topSegments.push([x1, trayAt(x1), x2, trayAt(x2)]);
  }
  for (const x of [xCatch - catchHalfW, xCatch + catchHalfW]) {
    if (x > 0 && x < w) topSegments.push([x, trayAt(x), x, trayAt(x) - spoutLen]);
  }
  segmentsRaw.push(...topSegments, ...topSegments.map(segment => mirrorSegment(segment, w, h)));

  let wheels = [];
  let seesaws = [];
  let gates = [];

  if (layout.mode === 'fixed') {
    addConfiguredSegments(segmentsRaw, layout.ramps, w, h);
    wheels = (layout.wheels || []).map(spec => normalizeDynamic(spec, w, h, m));
    seesaws = (layout.seesaws || []).map(spec => normalizeDynamic(spec, w, h, m));
    gates = (layout.gates || []).map(spec => normalizeDynamic(spec, w, h, m));
  } else {
    const yTop = 0.2 * h;
    const yBottom = 0.48 * h;

    // --- zigzag staircase (階段) under the drip column, mirrored below ---
    // the signature piece of the real toy: short, nearly level steps offset
    // alternately, so falling beads land on a step, creep to its lip and drip
    // to the next one — pacing emerges from step tilt and surface friction
    const stairSegments = [];
    {
      const nSteps = randInt(4, 7);
      const stepLen = rand(0.10, 0.16) * w;
      const dropY = (yBottom - yTop) / nSteps; // vertical gap between steps
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
        stairSegments.push([xBack, y - stepTilt, xLip, y]);
        // next step: reversed, its lip roughly half a step back past this
        // one, so the drop from this lip lands on the next tread — slightly
        // asymmetric so the staircase marches diagonally across the vessel
        // like the real toy's, instead of hugging one wall
        dir = -dir;
        const toCenter = (w / 2 - xLip) * dir > 0;
        xLip = xLip + dir * stepLen * (toCenter ? rand(0.6, 0.75) : rand(0.35, 0.5));
      }
    }
    segmentsRaw.push(...stairSegments, ...stairSegments.map(segment => mirrorSegment(segment, w, h)));

    // --- a ramp or two (段差) elsewhere in the mid band, mirrored below ---
    const rampSegments = [];
    const count = randInt(0, 1); // ×2 by mirroring — the stairs are the star
    for (let i = 0; i < count; i++) {
      const y = yTop + rand(0.2, 0.8) * (yBottom - yTop);
      const length = rand(0.2, 0.34) * w;
      const x1 = rand(0.06, 0.94 - length / w) * w;
      const tilt = rand(0.04, 0.08) * h * (i % 2 ? -1 : 1);
      const segment = [x1, y - tilt / 2, x1 + length, y + tilt / 2];
      // don't cut through the staircase column
      const nearStairs = stairSegments.some(([sx1, , sx2]) =>
        Math.min(x1, x1 + length) < Math.max(sx1, sx2) + 0.05 * w &&
        Math.max(x1, x1 + length) > Math.min(sx1, sx2) - 0.05 * w);
      if (!nearStairs) rampSegments.push(segment);
    }
    segmentsRaw.push(...rampSegments, ...rampSegments.map(segment => mirrorSegment(segment, w, h)));

    const segments = segmentsRaw.map(segment => makeSeg(...segment));
    const placed = [];
    const clear = (x, y, radius) => {
      const pad = radius + 3.5 * particleRadius;
      if (x < pad || x > w - pad || y < 0.16 * h + pad || y > 0.84 * h - pad) return false;
      if (placed.some(item => Math.hypot(item.x - x, item.y - y) < item.radius + pad)) return false;
      return segments.every(segment => segmentDistance(segment, x, y) > pad);
    };
    const place = (radius, xHint) => {
      for (let attempt = 0; attempt < 80; attempt++) {
        const x = xHint !== undefined && attempt < 30
          ? xHint + rand(-0.08, 0.08) * w
          : rand(0.12, 0.88) * w;
        const y = rand(0.2, 0.8) * h;
        if (clear(x, y, radius)) {
          placed.push({ x, y, radius });
          return { x, y };
        }
      }
      return null;
    };

    for (let i = 0; i < randInt(1, 2); i++) {
      const radius = rand(0.07, 0.11) * m;
      const point = place(radius * 1.15, i === 0 ? gaps[0].x : undefined);
      if (point) wheels.push({ id: `random-wheel-${i}`, x: point.x, y: point.y, r: radius });
    }
    for (let i = 0; i < randInt(1, 2); i++) {
      const half = rand(0.1, 0.15) * m;
      const point = place(half, i === 0 ? gaps[1].x : undefined);
      if (point) seesaws.push({ id: `random-seesaw-${i}`, x: point.x, y: point.y, half });
    }
  }

  const spawnX = highOnLeft
    ? [xCatch + catchHalfW + 3 * particleRadius, 0.95 * w]
    : [0.05 * w, xCatch - catchHalfW - 3 * particleRadius];

  return {
    segments: segmentsRaw.map(segment => makeSeg(...segment)),
    wheels,
    seesaws,
    gates,
    spawnX,
    inset: m * WALL_INSET_FRAC,
    seed: scene?.seed,
  };
}

function segmentDistance(segment, x, y) {
  let t = ((x - segment.x1) * segment.dx + (y - segment.y1) * segment.dy) / (segment.len * segment.len);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (segment.x1 + segment.dx * t), y - (segment.y1 + segment.dy * t));
}

export function makeSeg(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return { x1, y1, x2, y2, dx, dy, len, nx: -dy / len, ny: dx / len };
}
