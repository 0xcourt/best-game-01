// A small seeded random number generator (splitmix32): the same seed gives the
// same city, the same passengers and the same traffic, which is what makes the
// screenshot scenes repeatable frame for frame.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x9e3779b9) | 0;
    let t = Math.imul(a ^ (a >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

/** Pick one of `items` with the seeded generator. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

/** A number in [min, max) from the seeded generator. */
export function range(random, min, max) {
  return min + random() * (max - min);
}
