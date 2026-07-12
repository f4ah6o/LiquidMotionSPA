import { Fluid } from './physics.js';
import { Renderer } from './renderer.js';
import { OrientationInput } from './orientation.js';

const canvas = document.getElementById('view');
const overlay = document.getElementById('startOverlay');
const startBtn = document.getElementById('startBtn');
const flipBtn = document.getElementById('flipBtn');
const tiltInfo = document.getElementById('tiltInfo');

const renderer = new Renderer(canvas);
const orient = new OrientationInput();
let fluid = null;
let running = false;

function size() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  renderer.resize(w, h, dpr);
  if (!fluid) fluid = new Fluid(w, h);
  else fluid.resize(w, h);
  window.__fluid = fluid; // debug/testing hook
}
size();
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(size, 200);
});

// fixed-timestep physics, rAF render
const STEP = 1 / 120;
let last = 0, acc = 0;
function loop(t) {
  requestAnimationFrame(loop);
  if (!running) { last = t; return; }
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  acc += dt;
  const g = orient.update(dt);
  let n = 0;
  while (acc >= STEP && n < 8) {
    fluid.step(STEP, g);
    acc -= STEP;
    n++;
  }
  if (n === 8) acc = 0; // avoid spiral of death on slow frames
  renderer.render(fluid);
}
requestAnimationFrame(loop);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) running = false;
  else if (overlay.classList.contains('hidden')) running = true;
});

startBtn.addEventListener('click', async () => {
  const granted = await orient.enable();
  overlay.classList.add('hidden');
  running = true;
  tiltInfo.textContent = granted && 'ontouchstart' in window
    ? '端末を傾けて遊ぶ'
    : 'ダブルタップでも反転';
});

flipBtn.addEventListener('click', () => orient.flip());

// double-tap anywhere on the canvas flips the container
let lastTap = 0;
canvas.addEventListener('pointerdown', () => {
  const now = performance.now();
  if (now - lastTap < 300) orient.flip();
  lastTap = now;
});

// block iOS pinch-zoom / rubber-band inside the toy
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
