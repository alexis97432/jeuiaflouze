/**
 * Aléa non déterministe réservé au shell (seed de partie, identifiants éphémères).
 * La mécanique de jeu n'utilise jamais ces fonctions : elle dérive tout de la seed.
 */

export type RandomSource = (out: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer>;

const defaultSource: RandomSource = (out) => {
  globalThis.crypto.getRandomValues(out);
  return out;
};

/** Seed uint32 dans 1..4294967295 (0 interdit par xorshift32). */
export function randomSeed(source: RandomSource = defaultSource): number {
  const buf = new Uint32Array(1);
  for (let i = 0; i < 8; i++) {
    const v = source(buf)[0] ?? 0;
    if (v !== 0) return v;
  }
  return 1;
}

/** Identifiant opaque de 16 caractères hexadécimaux, sans donnée personnelle. */
export function randomId(source: RandomSource = defaultSource): string {
  const buf = source(new Uint32Array(2));
  return Array.from(buf, (n) => n.toString(16).padStart(8, '0')).join('');
}
