const fluid = (hue, overrides = {}) => ({
  id: 'primary',
  label: '主液体',
  hue,
  specificGravity: 1.25,
  ambientSpecificGravity: 0.44,
  viscosity: 1,
  cohesion: 1,
  particleCount: 170,
  rendering: 'metaball',
  ...overrides,
});

export const SCENES = [
  {
    schemaVersion: 1,
    id: 'step-drop',
    name: 'Step Drop',
    description: '段差を伝って液滴がゆっくり落ちる基本シーン。',
    seed: 'step-drop-v1',
    experimental: false,
    fluid: fluid(194, { viscosity: 1.15, cohesion: 1.08 }),
    layout: {
      mode: 'fixed',
      highOnLeft: true,
      ramps: [
        { x1: 0.12, y1: 0.24, x2: 0.44, y2: 0.29, mirror: true },
        { x1: 0.52, y1: 0.34, x2: 0.84, y2: 0.30, mirror: true },
        { x1: 0.18, y1: 0.42, x2: 0.48, y2: 0.47, mirror: true },
      ],
      wheels: [{ id: 'step-wheel', x: 0.68, y: 0.46, r: 0.075 }],
      seesaws: [{ id: 'step-seesaw', x: 0.34, y: 0.58, half: 0.12 }],
      gates: [],
    },
    mechanisms: { gearLinks: [] },
  },
  {
    schemaVersion: 1,
    id: 'gear-flow',
    name: 'Gear Flow',
    description: '2つの歯車が逆方向に連動し、流れを受け渡すシーン。',
    seed: 'gear-flow-v1',
    experimental: false,
    fluid: fluid(43, { viscosity: 0.92, cohesion: 0.96 }),
    layout: {
      mode: 'fixed',
      highOnLeft: false,
      ramps: [
        { x1: 0.08, y1: 0.25, x2: 0.34, y2: 0.32, mirror: true },
        { x1: 0.65, y1: 0.28, x2: 0.91, y2: 0.22, mirror: true },
      ],
      wheels: [
        { id: 'gear-a', x: 0.42, y: 0.42, r: 0.085, paddles: 10 },
        { id: 'gear-b', x: 0.59, y: 0.49, r: 0.07, paddles: 8 },
      ],
      seesaws: [],
      gates: [],
    },
    mechanisms: {
      gearLinks: [{ a: 'gear-a', b: 'gear-b', ratio: 1.2, direction: -1, coupling: 0.22 }],
    },
  },
  {
    schemaVersion: 1,
    id: 'branch-merge',
    name: 'Branch and Merge',
    description: '流れを左右に分け、接触量で開く弁を通して再合流させるシーン。',
    seed: 'branch-merge-v1',
    experimental: false,
    fluid: fluid(318, { viscosity: 1.25, cohesion: 1.12, particleCount: 180 }),
    layout: {
      mode: 'fixed',
      highOnLeft: true,
      ramps: [
        { x1: 0.48, y1: 0.22, x2: 0.25, y2: 0.34, mirror: true },
        { x1: 0.52, y1: 0.22, x2: 0.75, y2: 0.34, mirror: true },
        { x1: 0.18, y1: 0.45, x2: 0.43, y2: 0.53, mirror: true },
        { x1: 0.82, y1: 0.45, x2: 0.57, y2: 0.53, mirror: true },
      ],
      wheels: [],
      seesaws: [{ id: 'merge-seesaw', x: 0.5, y: 0.64, half: 0.14 }],
      gates: [
        { id: 'left-gate', x: 0.33, y: 0.41, half: 0.055, closedAngle: 0.18, openAngle: 1.25, threshold: 8 },
        { id: 'right-gate', x: 0.67, y: 0.41, half: 0.055, closedAngle: -0.18, openAngle: -1.25, threshold: 8 },
      ],
    },
    mechanisms: { gearLinks: [] },
  },
  {
    schemaVersion: 1,
    id: 'random-lab',
    name: 'Random Lab',
    description: 'seed付き手続き生成を試す実験シーン。',
    seed: 'random-lab-v1',
    experimental: true,
    fluid: fluid(204),
    layout: { mode: 'procedural' },
    mechanisms: { gearLinks: [] },
  },
];

export function getScene(id) {
  return SCENES.find(scene => scene.id === id) || SCENES[0];
}

export function cloneScene(scene, seed = scene.seed) {
  const copy = JSON.parse(JSON.stringify(scene));
  copy.seed = String(seed || scene.seed);
  return copy;
}

export function sceneShareParams(scene) {
  return { scene: scene.id, seed: scene.seed };
}
