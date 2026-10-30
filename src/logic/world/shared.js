// Small helpers and constants used by several parts of the World.

export const REPATH_EVERY = 0.4;
export const SEPARATION = 10; // px sideways offset range for ground enemies, so groups don't stack
export const HERO_GUARD_RADIUS = 130; // an idle hero engages enemies this close to where it stands
export const CATAPULT_MIN_RANGE = 50; // px: a stone can't land right next to the catapult

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
