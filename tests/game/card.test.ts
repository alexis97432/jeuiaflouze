// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CARD_HEIGHT, CARD_WIDTH, MAX_PATTERN, MAX_TOWER, renderResultCard, summarizeRun } from '../../src/game';
import { botRun } from './bot';
import golden1 from './golden-v1.json';
import golden2 from './golden-v2.json';

const v1 = golden1.vectors.map(({ name: _n, stackFingerprint: _f, topBlock: _t, bestPerfectStreak: _b, ...r }) => ({ ...r, rulesVersion: 1 as const }));
const v2 = golden2.vectors.map(({ name: _n, stackFingerprint: _f, ...r }) => ({ ...r, rulesVersion: 2 as const, continues: r.continues as 0 | 1 }));

describe('F9 : summarizeRun (dérivé du rejeu)', () => {
  it.each(v1)('v1 seed $seed : hauteur = score, pas de points, motif exact', (r) => {
    const s = summarizeRun(r)!;
    expect(s.rulesVersion).toBe(1);
    expect(s.height).toBe(r.score);
    expect(s.points).toBeNull();
    expect(s.continued).toBe(false);
    expect(s.patternTotal).toBe(r.score);
    expect(s.pattern.filter((c) => c === 'perfect')).toHaveLength(r.perfectCount);
    expect(s.tower.length).toBe(Math.min(MAX_TOWER, r.score + 1));
  });

  it.each(v2)('v2 seed $seed : points et hauteur distincts, reprise, bonus marqués', (r) => {
    const s = summarizeRun(r)!;
    expect(s).toMatchObject({ rulesVersion: 2, height: r.height, points: r.score, continued: r.continues === 1, bonusCount: r.bonusCount });
    expect(s.points).not.toBe(s.height);
    expect(s.patternTotal).toBe(r.height);
    expect(s.pattern.filter((c) => c.endsWith('perfect'))).toHaveLength(r.perfectCount);
    // 5 poses par bonus, sauf un bonus interrompu par un raté.
    const bonusCells = s.pattern.filter((c) => c.startsWith('bonus')).length;
    expect(bonusCells).toBeGreaterThan(0);
    expect(bonusCells).toBeLessThanOrEqual(r.bonusCount * 5);
  });

  it('refuse un résultat falsifié ou malformé (aucune carte inventée)', () => {
    const r = v2[1]!;
    expect(summarizeRun({ ...r, score: r.score + 10 })).toBeNull();
    expect(summarizeRun({ ...r, continueTicks: [] })).toBeNull();
    expect(summarizeRun({ ...v1[2]!, perfectCount: 0 })).toBeNull();
    expect(summarizeRun(null)).toBeNull();
    expect(summarizeRun({ seed: 1, rulesVersion: 3, inputTicks: [1] })).toBeNull();
  });

  it('borne motif et tour pour une longue partie', () => {
    const long = botRun(7, 150, 4000);
    expect(long.score).toBeGreaterThan(MAX_PATTERN);
    const s = summarizeRun(long)!;
    expect(s.pattern).toHaveLength(MAX_PATTERN);
    expect(s.patternTotal).toBe(long.score);
    expect(s.tower).toHaveLength(MAX_TOWER);
    expect(s.towerFrom).toBe(long.score + 1 - MAX_TOWER);
  });
});

describe('F9 : renderResultCard', () => {
  const ctx = () => new Proxy({}, {
    get: (_t, p) => (p === 'createLinearGradient' ? () => ({ addColorStop() {} }) : p === 'measureText' ? () => ({ width: 10 }) : () => {}),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;

  it('dessine en 1080 × 1350 ; false sans Canvas 2D ou pour un résultat qui ne se rejoue pas', () => {
    const c = document.createElement('canvas');
    c.getContext = (() => ctx()) as unknown as typeof c.getContext;
    expect(renderResultCard(c, { result: v2[1]!, mode: 'free', appearance: { theme: 'jardin', skin: 'marbre' } })).toBe(true);
    expect([c.width, c.height]).toEqual([CARD_WIDTH, CARD_HEIGHT]);
    expect(renderResultCard(c, { result: v1[1]!, mode: 'daily', day: '2026-11-17' }, { scale: 0.5 })).toBe(true);
    expect([c.width, c.height]).toEqual([540, 675]);
    expect(renderResultCard(c, { result: { ...v2[0]!, score: 1 }, mode: 'free' })).toBe(false);
    const none = document.createElement('canvas');
    none.getContext = (() => null) as unknown as typeof none.getContext;
    expect(renderResultCard(none, { result: v2[0]!, mode: 'free' })).toBe(false);
  });
});

describe('F8b R1 (revue Codex C8) : apparence V3 par l’entrée publique de la carte', () => {
  /** Contexte qui enregistre chaque affectation et appel : deux dessins identiques ⇔ mêmes journaux. */
  const recording = () => {
    const log: string[] = [];
    const ctx = new Proxy({}, {
      get: (_t, p) => (...args: unknown[]) => {
        log.push(`${String(p)}(${args.map(String).join(',')})`);
        if (p === 'createLinearGradient') return { addColorStop: (o: number, c: string) => log.push(`stop ${o} ${c}`) };
        if (p === 'measureText') return { width: 10 };
        return undefined;
      },
      set: (_t, p, v) => { log.push(`${String(p)}=${String(v)}`); return true; },
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, log };
  };
  const draw = (skin: string) => {
    const { ctx, log } = recording();
    const c = document.createElement('canvas');
    c.getContext = (() => ctx) as unknown as typeof c.getContext;
    expect(renderResultCard(c, { result: v2[0]!, mode: 'free', appearance: { theme: 'orbital', skin: skin as never } })).toBe(true);
    return log.join('\n');
  };

  it('graphite, lave et cristal changent réellement le dessin ; un identifiant inconnu retombe sur Gomme', () => {
    const gomme = draw('gomme');
    for (const skin of ['graphite', 'lave', 'cristal']) expect(draw(skin), skin).not.toBe(gomme);
    expect(draw('inconnu')).toBe(gomme);
  });
});

