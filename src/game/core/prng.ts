/**
 * xorshift32 (Marsaglia 2003, décalages 13/17/5), état uint32 non nul.
 * Le tirage renvoyé est l'état APRÈS l'itération.
 */
export function isValidSeed(seed: unknown): seed is number {
  return (
    typeof seed === 'number' &&
    Number.isInteger(seed) &&
    seed >= 1 &&
    seed <= 0xffffffff
  );
}

/** Une itération pure : renvoie le nouvel état (= le tirage). */
export function xorshift32(state: number): number {
  let x = state >>> 0;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

export class Xorshift32 {
  private state: number;

  constructor(seed: number) {
    if (!isValidSeed(seed)) {
      throw new RangeError(`seed invalide : ${String(seed)} (uint32 non nul attendu)`);
    }
    this.state = seed >>> 0;
  }

  /** Tirage uint32 dans [1, 2^32 - 1]. */
  next(): number {
    this.state = xorshift32(this.state);
    return this.state;
  }
}
