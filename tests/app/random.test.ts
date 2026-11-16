import { describe, expect, it } from 'vitest';
import { randomId, randomSeed, type RandomSource } from '../../src/platform/random';

const sequence = (...values: number[]): RandomSource => {
  let i = 0;
  return (out) => {
    for (let j = 0; j < out.length; j++) out[j] = values[i++ % values.length] ?? 0;
    return out;
  };
};

describe('randomSeed', () => {
  it('ne renvoie jamais 0 (interdit par xorshift32)', () => {
    expect(randomSeed(sequence(0, 0, 42))).toBe(42);
    expect(randomSeed(sequence(0))).toBe(1);
  });

  it('reste dans 1..4294967295 avec la vraie source', () => {
    for (let i = 0; i < 1000; i++) {
      const seed = randomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(1);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('randomId', () => {
  it('produit 16 caractères hexadécimaux', () => {
    expect(randomId(sequence(0xabc, 0xffffffff))).toBe('00000abcffffffff');
    expect(randomId()).toMatch(/^[0-9a-f]{16}$/);
  });
});
