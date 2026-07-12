// Level geometry: static obstacle segments in normalized (0..1) coordinates.
// x is normalized by width, y by height. Scaled to pixels via build().
// Layout is roughly point-symmetric so it works both ways up (hourglass flip).

const NSEGS = [
  // --- upper steps (staggered ledges, slight tilt so drops eventually spill) ---
  [0.02, 0.16, 0.34, 0.19],
  [0.66, 0.19, 0.98, 0.16],
  [0.14, 0.28, 0.48, 0.31],
  [0.52, 0.31, 0.86, 0.28],

  // --- zigzag channel (left side) ---
  [0.02, 0.40, 0.30, 0.46],
  [0.42, 0.52, 0.10, 0.58],

  // --- Y splitter wedge (center) ---
  [0.55, 0.40, 0.67, 0.47],
  [0.79, 0.40, 0.67, 0.47],

  // --- ramps feeding the wheel ---
  [0.98, 0.44, 0.76, 0.52],

  // --- lower zigzag (mirror of upper one) ---
  [0.58, 0.66, 0.90, 0.60],
  [0.98, 0.72, 0.70, 0.78],

  // --- lower steps (mirror of upper steps) ---
  [0.02, 0.84, 0.30, 0.81],
  [0.34, 0.81, 0.48, 0.84],
  [0.52, 0.72, 0.34, 0.69],
  [0.02, 0.66, 0.24, 0.60],

  // --- bottom-right ledge pair ---
  [0.66, 0.88, 0.98, 0.84],
];

export function buildLevel(w, h) {
  const segs = NSEGS.map(([x1, y1, x2, y2]) => makeSeg(x1 * w, y1 * h, x2 * w, y2 * h));
  return {
    segments: segs,
    // rotor placements (normalized centers)
    wheel: { x: 0.50 * w, y: 0.55 * h, r: Math.min(w, h) * 0.11 },
    seesaw: { x: 0.30 * w, y: 0.92 * h, half: Math.min(w, h) * 0.13 },
  };
}

export function makeSeg(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return { x1, y1, x2, y2, dx, dy, len, nx: -dy / len, ny: dx / len };
}
