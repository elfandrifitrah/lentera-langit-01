// Shared world constants and a seeded random source.
export const WORLD = {
  size: 6400,
  waterLevel: 0,
  runway: { x: 650, z: 950, heading: 0.5, length: 520, width: 46, height: 7 },
  volcano: { x: -1250, z: -850, height: 430, radius: 780 },
  village: { x: -350, z: 1250 },
  boat: { x: 1500, z: -350 },
};

export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
