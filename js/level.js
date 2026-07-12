// Level geometry: static obstacle segments in normalized (0..1) coordinates.
// x is normalized by width, y by height. Scaled to pixels via build().
// Layout is point-symmetric so it works both ways up (hourglass flip).
//
// Top and bottom reservoirs: nearly horizontal trays spanning the width.
// Each tray has one DRIP nozzle (spout walls pointing out of the reservoir)
// and one CATCH opening — a plain gap at tray level. The tray itself is the
// funnel: it slopes so that liquid landing on it slides into the catch gap.
// No walls rise above the tray (in 2D any raised rim would block liquid
// arriving along the tray). Back-flow through the catch is prevented by a
// one-way valve in physics.js, not by geometry. Top drips on the left and
// catches on the right; the bottom tray is the point-symmetric mirror, so
// after a 180° flip the bottom-right nozzle drips into the top-right catch.
// Only the currently-upper reservoir drains (throttled in physics.js).

const NOZZLE_XS = [0.295, 0.705];
const NOZZLE_HALFW = 0.04;   // half width of drip nozzle gap (normalized by w)
const TRAY_Y = 0.09;         // top tray plane (bottom tray at 1 - TRAY_Y)
const SPOUT_LEN = 0.045;     // spout wall length (normalized by h)

const SLOPE = 0.012;         // near-horizontal grade toward the drip nozzle
const WALL_INSET_FRAC = 0.015; // sealed glass wall thickness (of min(w,h))
const CATCH_HALFW = NOZZLE_HALFW * 1.5; // catch gap is wider: easy landing

const DRIP_X = NOZZLE_XS[0];  // top tray drips on the left...
const CATCH_X = NOZZLE_XS[1]; // ...and catches on the right

// Top reservoir; the bottom is generated as its point mirror (x,y)→(1-x,1-y).
const TOP_SEGS = [
  // nearly flat tray, lowest at the drip gap; the catch-side edges sit at
  // TRAY_Y - SLOPE so the mirrored (receiving) tray drains into its catch
  [0.0, TRAY_Y - SLOPE, DRIP_X - NOZZLE_HALFW, TRAY_Y],
  [DRIP_X + NOZZLE_HALFW, TRAY_Y, CATCH_X - CATCH_HALFW, TRAY_Y - SLOPE],
  // stub right of the catch: slightly lower at the gap so liquid landing on
  // it slides into the catch instead of pooling in the wall corner
  [CATCH_X + CATCH_HALFW, TRAY_Y - SLOPE * 0.5, 1.0, TRAY_Y - SLOPE],
  // drip spout walls (point down, out of the reservoir)
  [DRIP_X - NOZZLE_HALFW, TRAY_Y, DRIP_X - NOZZLE_HALFW, TRAY_Y + SPOUT_LEN],
  [DRIP_X + NOZZLE_HALFW, TRAY_Y, DRIP_X + NOZZLE_HALFW, TRAY_Y + SPOUT_LEN],
];

const NSEGS = [
  ...TOP_SEGS,
  // bottom reservoir: point-symmetric mirror (drips right/up, catches left)
  ...TOP_SEGS.map(([x1, y1, x2, y2]) => [1 - x1, 1 - y1, 1 - x2, 1 - y2]),

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
    // gear wheel sits in the right drip/catch column (driven by the rising
    // stream when flipped); seesaw at its mirror point in the left column,
    // offset from the drip line so drops strike the rim (max lever arm)
    wheel: { x: (1 - DRIP_X) * w - Math.min(w, h) * 0.06, y: 0.30 * h, r: Math.min(w, h) * 0.10 },
    seesaw: { x: DRIP_X * w + Math.min(w, h) * 0.06, y: 0.70 * h, half: Math.min(w, h) * 0.13 },
    // one-way drip nozzles: dir = +1 drains downward (top reservoir),
    // dir = -1 drains upward after a flip (bottom reservoir). The catch
    // openings opposite them are pure geometry — no throttling needed.
    nozzles: [
      { x: DRIP_X * w, y: TRAY_Y * h, dir: +1 },
      { x: (1 - DRIP_X) * w, y: (1 - TRAY_Y) * h, dir: -1 },
    ],
    nozzleHalfW: NOZZLE_HALFW * w,
    nozzleLen: SPOUT_LEN * h,
    // catch openings: plain gaps at tray level, one-way in physics.js.
    // dir points INTO the reservoir cavity; the valve plane sits flush with
    // the adjacent tray edges (TRAY_Y - SLOPE); driftX slides liquid held on
    // the valve toward the drip nozzle so nothing gets stuck over the gap.
    catches: [
      { x: CATCH_X * w, y: (TRAY_Y - SLOPE) * h, dir: -1, driftX: Math.sign(DRIP_X - CATCH_X) },
      { x: (1 - CATCH_X) * w, y: (1 - TRAY_Y + SLOPE) * h, dir: +1, driftX: Math.sign(CATCH_X - DRIP_X) },
    ],
    catchHalfW: CATCH_HALFW * w,
    // sealed vessel: glass wall thickness; physics clamps particles inside
    // it and the renderer draws the frame at this width
    inset: Math.min(w, h) * WALL_INSET_FRAC,
  };
}

export function makeSeg(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return { x1, y1, x2, y2, dx, dy, len, nx: -dy / len, ny: dx / len };
}
