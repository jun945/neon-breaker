// Deterministic PRNG (mulberry32). Same seed => identical world, so screenshots reproduce pixel-for-pixel.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
