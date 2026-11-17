import { describe, expect, it } from 'vitest';
import { dailySeed, fnv1a32, isDateKey, nextDailyChange, utcDateKey } from '../../src/platform/daily';

describe('Tour du jour : seed', () => {
  // Vecteurs calculés indépendamment en Python (revue C3) : FNV-1a 32 bits sur la clé ASCII.
  it.each([
    ['2026-11-16', 630742688],
    ['2026-11-17', 647520307],
    ['2026-12-31', 1136987600],
    ['2027-01-01', 3571995252],
    ['2000-01-01', 819662459],
  ])('%s → %i', (day, seed) => {
    expect(dailySeed(day)).toBe(seed);
  });

  it('FNV-1a de référence (chaîne vide = offset)', () => {
    expect(fnv1a32('')).toBe(2166136261);
    expect(() => fnv1a32('é')).toThrow(RangeError);
  });

  it.each(['2026-02-30', '2026-13-01', '26-11-16', '2026-11-16T00', '1999-12-31', ''])('refuse %s', (d) => {
    expect(isDateKey(d)).toBe(false);
    expect(() => dailySeed(d)).toThrow(RangeError);
  });
});

describe('Tour du jour : date UTC', () => {
  it('les tests tournent hors UTC (sinon ce fichier ne prouve rien)', () => {
    expect(new Date('2026-11-16T22:30:00Z').getTimezoneOffset()).not.toBe(0);
  });

  it('utilise la date UTC, pas la date locale', () => {
    expect(utcDateKey(new Date('2026-11-16T23:59:59.999Z'))).toBe('2026-11-16');
    expect(utcDateKey(new Date('2026-11-17T00:00:00Z'))).toBe('2026-11-17');
    // 00:30 à Paris le 17 = 23:30 UTC le 16.
    expect(utcDateKey(new Date('2026-11-17T00:30:00+01:00'))).toBe('2026-11-16');
    expect(() => utcDateKey(new Date('x'))).toThrow(RangeError);
  });

  it('prochain changement = minuit UTC suivant', () => {
    expect(nextDailyChange(new Date('2026-11-16T22:30:00Z')).toISOString()).toBe('2026-11-17T00:00:00.000Z');
    expect(nextDailyChange(new Date('2026-12-31T23:59:59Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});
