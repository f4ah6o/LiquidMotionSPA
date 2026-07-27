import { Fluid } from './physics.js';
import { Renderer } from './renderer.js';
import { OrientationInput } from './orientation.js';
import { cloneScene, getScene, SCENES, sceneShareParams } from './scenes.js';
import { SIMULATION_STATES, SimulationController } from './simulation.js';

const canvas = document.getElementById('view');
const overlay = document.getElementById('startOverlay');
const startBtn = document.getElementById('startBtn');
const playBtn = document.getElementById('playBtn');
const flipBtn = document.getElementById('flipBtn');
const resetBtn = document.getElementById('resetBtn');
const sensorBtn = document.getElementById('sensorBtn');
const shareBtn = document.getElementById('shareBtn');
const exportBtn = document.getElementById('exportBtn');
const sceneSelect = document.getElementById('sceneSelect');
const speedSelect = document.getElementById('speedSelect');
const status = document.getElementById('status');
const fallback = document.getElementById('canvasFallback');

let renderer;
try {
  renderer = new Renderer(canvas);
} catch {
  fallback.hidden = false;
  overlay.hidden = true;
  throw new Error('Canvas 2D is not supported');
}

const orientation = new OrientationInput();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const savedSceneId = localStorage.getItem('liquid-motion.scene');
const params = new URLSearchParams(location.search);
const requestedScene = getScene(params.get('scene') || savedSceneId || SCENES[0].id);
let scene = cloneScene(requestedScene, params.get('seed') || requestedScene.seed);
let fluid;
let rotation = 0;
let flipAnimation = null;
let resumeAfterVisibility = false;

for (const item of SCENES) {
  const option = document.createElement('option');
  option.value = item.id;
  option.textContent = `${item.name}${item.experimental ? '（実験）' : ''}`;
  sceneSelect.append(option);
}
sceneSelect.value = scene.id;

const stateLabels = {
  [SIMULATION_STATES.READY]: '開始待ち',
  [SIMULATION_STATES.RUNNING]: '再生中',
  [SIMULATION_STATES.PAUSED]: '一時停止',
  [SIMULATION_STATES.SETTLED]: '静止',
  [SIMULATION_STATES.FLIPPING]: '反転中',
  [SIMULATION_STATES.RESETTING]: 'リセット中',
  [SIMULATION_STATES.UNSUPPORTED_INPUT]: '手動操作',
};

const controller = new SimulationController(updateUi);

function updateUi(snapshot = controller.snapshot()) {
  const resumable = [SIMULATION_STATES.PAUSED, SIMULATION_STATES.SETTLED].includes(snapshot.state);
  const busy = [SIMULATION_STATES.FLIPPING, SIMULATION_STATES.RESETTING].includes(snapshot.state);
  playBtn.textContent = resumable ? '▶ 再生' : '⏸ 一時停止';
  playBtn.setAttribute('aria-pressed', String(resumable));
  playBtn.disabled = busy;
  flipBtn.disabled = busy;
  resetBtn.disabled = busy;
  sceneSelect.disabled = busy;
  speedSelect.disabled = busy;
  sensorBtn.disabled = busy;
  speedSelect.value = String(snapshot.speed);
  sensorBtn.textContent = orientation.sensorEnabled ? '傾き ON' : '傾き OFF';
  sensorBtn.setAttribute('aria-pressed', String(orientation.sensorEnabled));
  status.textContent = `${stateLabels[snapshot.state]}・${scene.name}・${snapshot.speed}×`;
  document.body.dataset.state = snapshot.state;
}

function size() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  renderer.resize(width, height, dpr);
  if (!fluid) fluid = new Fluid(width, height, scene);
  else fluid.resize(width, height);
  window.__fluid = fluid;
  window.__liquidMotion = { fluid, controller, scene };
}
size();

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(size, 160);
});

const STEP = 1 / 120;
let last = 0;
let accumulator = 0;
let frameTotal = 0;
let frameCount = 0;
let metricsUpdatedAt = 0;

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
}

function completeFlip() {
  if (!flipAnimation) return;
  rotation = ((flipAnimation.to % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  renderer.setRotation(rotation);
  orientation.commitFlip();
  flipAnimation = null;
  controller.finishFlip();
}

function updateFlip(now) {
  if (!flipAnimation) return;
  const progress = flipAnimation.duration === 0 ? 1 : Math.min(1, (now - flipAnimation.startedAt) / flipAnimation.duration);
  rotation = flipAnimation.from + (flipAnimation.to - flipAnimation.from) * easeInOutCubic(progress);
  renderer.setRotation(rotation);
  if (progress >= 1) completeFlip();
}

function loop(now) {
  requestAnimationFrame(loop);
  if (!last) last = now;
  const frameSeconds = Math.min(0.05, (now - last) / 1000);
  last = now;
  updateFlip(now);

  if (controller.shouldStep()) {
    accumulator += frameSeconds * controller.speed;
    const gravity = orientation.update();
    let steps = 0;
    while (accumulator >= STEP && steps < 8) {
      fluid.step(STEP, gravity);
      accumulator -= STEP;
      steps++;
    }
    if (steps === 8) accumulator = 0;
  } else {
    accumulator = 0;
  }

  renderer.render(fluid);
  frameTotal += frameSeconds * 1000;
  frameCount++;
  if (now - metricsUpdatedAt > 2000) {
    window.__liquidMotionMetrics = {
      averageFrameMs: frameCount ? frameTotal / frameCount : 0,
      particleCount: fluid.p.length,
      state: controller.state,
      scene: scene.id,
    };
    frameTotal = 0;
    frameCount = 0;
    metricsUpdatedAt = now;
  }
}
requestAnimationFrame(loop);

async function start() {
  let inputStatus = 'manual';
  if (orientation.sensorEnabled) {
    const result = await orientation.enable();
    inputStatus = result.granted ? 'sensor' : result.supported ? 'denied' : 'unsupported';
  }
  controller.setInputStatus(inputStatus);
  overlay.classList.add('hidden');
  controller.start();
  updateUi();
}

function commandFlip() {
  if (!controller.beginFlip()) return;
  const duration = reducedMotion ? 0 : 600;
  flipAnimation = {
    from: rotation,
    to: rotation + Math.PI,
    startedAt: performance.now(),
    duration,
  };
  if (duration === 0) completeFlip();
}

function resetCurrentScene() {
  if (!controller.beginReset()) return;
  flipAnimation = null;
  fluid.reset(scene);
  rotation = 0;
  renderer.setRotation(0);
  orientation.reset();
  controller.finishReset();
}

function loadScene(nextScene) {
  if ([SIMULATION_STATES.FLIPPING, SIMULATION_STATES.RESETTING].includes(controller.state)) return;
  flipAnimation = null;
  scene = cloneScene(nextScene, nextScene.seed);
  localStorage.setItem('liquid-motion.scene', scene.id);
  fluid.reset(scene);
  rotation = 0;
  renderer.setRotation(0);
  orientation.reset();
  controller.start();
  window.__fluid = fluid;
  window.__liquidMotion = { fluid, controller, scene };
  updateShareUrl();
  updateUi();
}

function updateShareUrl() {
  const url = new URL(location.href);
  const share = sceneShareParams(scene);
  url.searchParams.set('scene', share.scene);
  url.searchParams.set('seed', share.seed);
  history.replaceState(null, '', url);
  return url;
}

async function shareScene() {
  const url = updateShareUrl();
  const data = { title: `Liquid Motion: ${scene.name}`, text: scene.description, url: url.href };
  try {
    if (navigator.share) await navigator.share(data);
    else await navigator.clipboard.writeText(url.href);
    status.textContent = navigator.share ? '共有しました' : '共有URLをコピーしました';
  } catch (error) {
    if (error?.name !== 'AbortError') status.textContent = '共有できませんでした';
  }
}

function exportScene() {
  const payload = {
    exportedAt: new Date().toISOString(),
    scene,
    state: controller.snapshot(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${scene.id}-${scene.seed}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

startBtn.addEventListener('click', start);
playBtn.addEventListener('click', () => controller.togglePause());
flipBtn.addEventListener('click', commandFlip);
resetBtn.addEventListener('click', resetCurrentScene);
sensorBtn.addEventListener('click', async () => {
  orientation.setSensorEnabled(!orientation.sensorEnabled);
  if (orientation.sensorEnabled) {
    const result = await orientation.enable();
    controller.setInputStatus(result.granted ? 'sensor' : result.supported ? 'denied' : 'unsupported');
  } else {
    controller.setInputStatus('manual');
  }
  updateUi();
});
shareBtn.addEventListener('click', shareScene);
exportBtn.addEventListener('click', exportScene);
sceneSelect.addEventListener('change', () => loadScene(getScene(sceneSelect.value)));
speedSelect.addEventListener('change', () => controller.setSpeed(Number(speedSelect.value)));

let lastTap = 0;
canvas.addEventListener('pointerdown', () => {
  const now = performance.now();
  if (now - lastTap < 300) commandFlip();
  lastTap = now;
});
canvas.addEventListener('touchmove', event => event.preventDefault(), { passive: false });
canvas.addEventListener('gesturestart', event => event.preventDefault());

document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement) return;
  const key = event.key.toLowerCase();
  if (key === ' ' || key === 'p') {
    event.preventDefault();
    controller.togglePause();
  } else if (key === 'f') commandFlip();
  else if (key === 'r') resetCurrentScene();
  else if (key === '1') controller.setSpeed(0.5);
  else if (key === '2') controller.setSpeed(1);
  else if (key === '3') controller.setSpeed(2);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resumeAfterVisibility = controller.state === SIMULATION_STATES.RUNNING;
    controller.pause();
  } else if (resumeAfterVisibility) {
    controller.resume();
    resumeAfterVisibility = false;
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

updateShareUrl();
updateUi();
