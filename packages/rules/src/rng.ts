/** Returns a float in [0, 1). */
export type Rng = (() => number) & { scripted?: number[] };

export const defaultRng: Rng = () => {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0]! / 4294967296;
  }
  return Math.random();
};

/** Deterministic PRNG (mulberry32) for tests and seeded generation. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * An rng whose dice faces are predetermined. `rollDie` consumes `scripted`
 * values first (clamped to the die size), then falls back to the seeded rng.
 */
export function scriptedRng(faces: number[], seed = 1): Rng {
  const base = seededRng(seed);
  const fn: Rng = () => base();
  fn.scripted = [...faces];
  return fn;
}
