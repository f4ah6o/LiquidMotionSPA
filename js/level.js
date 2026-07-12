// Level geometry: static obstacle segments in normalized (0..1) coordinates.
// x is normalized by width, y by height. Scaled to pixels via build().
// Layout is point-symmetric so it works both ways up (hourglass flip).
//
// Top and bottom reservoirs: flat trays spanning the width with two nozzle
// gaps each (at x=0.295 and x=0.705). Short spout walls guide the drip into
// a column. Geometry is one-way per orientation: only the currently-upper
// reservoir drains, and the drip rate is throttled in physics.js.

const NOZZLE_XS = [0.295, 0.705];
const NOZZLE_HALFW = 0.04;   // half width of nozzle gap (normalized by w)
const TRAY_Y = 0.09;         // top tray plane (bottom tray at 1 - TRAY_Y)
const SPOUT_LEN = 0.045;     // spout wall length (normalized by h)

const TRAY_HI = TRAY_Y - 0.035; // raised tray ends/center: funnel toward the gaps

const NSEGS = [
  // --- top reservoir tray (V-funnel, gaps at nozzle positions) ---
  [0.0, TRAY_HI, NOZZLE_XS[0] - NOZZLE_HALFW, TRAY_Y],
  [NOZZLE_XS[0] + NOZZLE_HALFW, TRAY_Y, 0.5, TRAY_HI + 0.015],
  [0.5, TRAY_HI + 0.015, NOZZLE_XS[1] - NOZZLE_HALFW, TRAY_Y],
  [NOZZLE_XS[1] + NOZZLE_HALFW, TRAY_Y, 1.0, TRAY_HI],
  // spout walls (point down)
  [NOZZLE_XS[0] - NOZZLE_HALFW, TRAY_Y, NOZZLE_XS[0] - NOZZLE_HALFW, TRAY_Y + SPOUT_LEN],
  [NOZZLE_XS[0] + NOZZLE_HALFW, TRAY_Y, NOZZLE_XS[0] + NOZZLE_HALFW, TRAY_Y + SPOUT_LEN],
  [NOZZLE_XS[1] - NOZZLE_HALFW, TRAY_Y, NOZZLE_XS[1] - NOZZLE_HALFW, TRAY_Y + SPOUT_LEN],
  [NOZZLE_XS[1] + NOZZLE_HALFW, TRAY_Y, NOZZLE_XS[1] + NOZZLE_HALFW, TRAY_Y + SPOUT_LEN],

  // --- bottom reservoir tray (point-symmetric mirror, spouts point up) ---
  [1.0, 1 - TRAY_HI, NOZZLE_XS[1] + NOZZLE_HALFW, 1 - TRAY_Y],
  [NOZZLE_XS[1] - NOZZLE_HALFW, 1 - TRAY_Y, 0.5, 1 - TRAY_HI - 0.015],
  [0.5, 1 - TRAY_HI - 0.015, NOZZLE_XS[0] + NOZZLE_HALFW, 1 - TRAY_Y],
  [NOZZLE_XS[0] - NOZZLE_HALFW, 1 - TRAY_Y, 0.0, 1 - TRAY_HI],
  [NOZZLE_XS[0] - NOZZLE_HALFW, 1 - TRAY_Y, NOZZLE_XS[0] - NOZZLE_HALFW, 1 - TRAY_Y - SPOUT_LEN],
  [NOZZLE_XS[0] + NOZZLE_HALFW, 1 - TRAY_Y, NOZZLE_XS[0] + NOZZLE_HALFW, 1 - TRAY_Y - SPOUT_LEN],
  [NOZZLE_XS[1] - NOZZLE_HALFW, 1 - TRAY_Y, NOZZLE_XS[1] - NOZZLE_HALFW, 1 - TRAY_Y - SPOUT_LEN],
  [NOZZLE_XS[1] + NOZZLE_HALFW, 1 - TRAY_Y, NOZZLE_XS[1] + NOZZLE_HALFW, 1 - TRAY_Y - SPOUT_LEN],

  // --- cascade under the left nozzle (drips zigzag down to the seesaw) ---
  [0.36, 0.20, 0.14, 0.26],
  [0.10, 0.34, 0.34, 0.40],
  [0.30, 0.48, 0.06, 0.54],
  // point-symmetric mirrors on the right (feed the bottom-right tray)
  [0.64, 0.80, 0.86, 0.74],
  [0.90, 0.66, 0.66, 0.60],
  [0.70, 0.52, 0.94, 0.46],
];

export function buildLevel(w, h) {
  const segs = NSEGS.map(([x1, y1, x2, y2]) => makeSeg(x1 * w, y1 * h, x2 * w, y2 * h));
  return {
    segments: segs,
    // gear wheel sits under the top-right nozzle; seesaw at its mirror point
    // offset from the drip line so drops strike the rim (max lever arm)
    wheel: { x: NOZZLE_XS[1] * w - Math.min(w, h) * 0.06, y: 0.30 * h, r: Math.min(w, h) * 0.10 },
    seesaw: { x: NOZZLE_XS[0] * w + Math.min(w, h) * 0.06, y: 0.70 * h, half: Math.min(w, h) * 0.13 },
    // one-way drip nozzles: dir = +1 drains downward (top reservoir),
    // dir = -1 drains upward after a flip (bottom reservoir)
    nozzles: [
      { x: NOZZLE_XS[0] * w, y: TRAY_Y * h, dir: +1 },
      { x: NOZZLE_XS[1] * w, y: TRAY_Y * h, dir: +1 },
      { x: NOZZLE_XS[0] * w, y: (1 - TRAY_Y) * h, dir: -1 },
      { x: NOZZLE_XS[1] * w, y: (1 - TRAY_Y) * h, dir: -1 },
    ],
    nozzleHalfW: NOZZLE_HALFW * w,
    nozzleLen: SPOUT_LEN * h,
  };
}

export function makeSeg(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return { x1, y1, x2, y2, dx, dy, len, nx: -dy / len, ny: dx / len };
}
