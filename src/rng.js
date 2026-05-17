// Mulberry32: tiny seeded PRNG. Deterministic given a 32-bit seed.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convert a 32-bit seed into the four-letter folio seed shown in the cartouche.
// Example: 0xCAFEBABE -> "CAFE·BABE"
export function seedToFolio(seed) {
  const hex = (seed >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `${hex.slice(0, 4)}·${hex.slice(4)}`;
}

export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
