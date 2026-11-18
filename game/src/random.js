// Small deterministic PRNG helpers. The game is playable with Math.random in spirit,
// but seeded randomness keeps the screenshot scenes and wave layouts reproducible.

export function hashString(text) {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.seed = typeof seed === 'number' ? seed >>> 0 : hashString(String(seed ?? 'neon-breaker'));
    this.next = mulberry32(this.seed);
  }

  float(min = 0, max = 1) {
    return min + (max - min) * this.next();
  }

  int(min, max) {
    if (max < min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(probability) {
    return this.next() < probability;
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
}

export function deriveSeed(seed, salt) {
  return (Math.imul((seed >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ hashString(String(salt))) >>> 0;
}
