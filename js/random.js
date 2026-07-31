export function normalizeSeed(seed) {
  const value = String(seed ?? '').trim();
  return value || 'liquid-motion';
}

function hashSeed(seed) {
  let h = 2166136261;
  const text = normalizeSeed(seed);
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed) {
  let state = hashSeed(seed) || 0x6d2b79f5;
  const next = () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  next.float = (min = 0, max = 1) => min + next() * (max - min);
  next.int = (min, max) => Math.floor(next.float(min, max + 1));
  next.pick = values => values[Math.min(values.length - 1, Math.floor(next() * values.length))];
  return next;
}
