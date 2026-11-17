import { describe, expect, it } from 'vitest';
import { buildChallengeUrl, parseChallenge } from '../../src/app/challenge-url';

const ok = (seed: number, target: number) => ({
  kind: 'challenge',
  challenge: { seed, target, rulesVersion: 1 },
});

describe('parseChallenge', () => {
  it('accepte un défi valide et ignore les paramètres étrangers', () => {
    expect(parseChallenge('?v=1&seed=42&target=7')).toEqual(ok(42, 7));
    expect(parseChallenge('?utm_source=x&target=0&seed=1&v=1')).toEqual(ok(1, 0));
    expect(parseChallenge('?v=1&seed=4294967295&target=10000')).toEqual(ok(4294967295, 10000));
  });

  it('sans paramètre de défi : aucune erreur', () => {
    expect(parseChallenge('')).toEqual({ kind: 'none' });
    expect(parseChallenge('?utm_source=x')).toEqual({ kind: 'none' });
  });

  it.each([
    ['?v=3&seed=1&target=1', 'version'],
    ['?seed=1&target=1', 'malformed'],
    ['?v=1&target=1', 'malformed'],
    ['?v=1&seed=1', 'malformed'],
    ['?v=1&v=1&seed=1&target=1', 'malformed'],
    ['?v=1&seed=1&seed=2&target=1', 'malformed'],
    ['?v=01&seed=1&target=1', 'version'],
    ['?v=1&seed=0&target=1', 'seed'],
    ['?v=1&seed=4294967296&target=1', 'seed'],
    ['?v=1&seed=99999999999&target=1', 'seed'],
    ['?v=1&seed=007&target=1', 'seed'],
    ['?v=1&seed=0x10&target=1', 'seed'],
    ['?v=1&seed=1e3&target=1', 'seed'],
    ['?v=1&seed=-5&target=1', 'seed'],
    ['?v=1&seed=+5&target=1', 'seed'],
    ['?v=1&seed=%205&target=1', 'seed'],
    ['?v=1&seed=5.0&target=1', 'seed'],
    ['?v=1&seed=&target=1', 'seed'],
    ['?v=1&seed=1&target=10001', 'target'],
    ['?v=1&seed=1&target=-1', 'target'],
    ['?v=1&seed=1&target=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E', 'target'],
  ])('refuse %s (%s)', (search, reason) => {
    expect(parseChallenge(search)).toEqual({ kind: 'invalid', reason });
  });
});

describe('buildChallengeUrl', () => {
  it('garde origine et chemin, remplace tous les paramètres et le fragment', () => {
    expect(buildChallengeUrl('https://ex.test/jeu/?v=1&seed=9&target=3&utm=a#x', 42, 12)).toBe(
      'https://ex.test/jeu/?v=1&seed=42&target=12',
    );
  });

  it('borne target au maximum accepté à la lecture', () => {
    const url = buildChallengeUrl('https://ex.test/', 5, 123456);
    expect(parseChallenge(new URL(url).search)).toEqual(ok(5, 10000));
  });

  it('aller-retour exact', () => {
    for (const [seed, score] of [[1, 0], [4294967295, 10000], [123456789, 57]] as const) {
      expect(parseChallenge(new URL(buildChallengeUrl('http://a/', seed, score)).search)).toEqual(
        ok(seed, score),
      );
    }
  });
});

describe('liens v2 (V3)', () => {
  it('accepte ?v=2 et construit un lien dans la version de la partie', () => {
    expect(parseChallenge('?v=2&seed=5&target=9')).toEqual({ kind: 'challenge', challenge: { seed: 5, target: 9, rulesVersion: 2 } });
    expect(buildChallengeUrl('https://jeu.test/', 5, 9, 2)).toBe('https://jeu.test/?v=2&seed=5&target=9');
    expect(buildChallengeUrl('https://jeu.test/', 5, 9)).toBe('https://jeu.test/?v=1&seed=5&target=9');
  });
});
