import { describe, expect, it } from 'vitest';
import type { StepEvent } from '../../src/game/core';
import { BLOCK_HEIGHT, MAX_DECOR, MAX_SPARKS, Renderer, reliefParts, type ViewState } from '../../src/game/render/renderer';
import { edgeColors, isSkinId, SKIN_IDS } from '../../src/game/render/blocks';
import { resolveAppearance } from '../../src/game/render/mount';
import {
  contrast,
  getTheme,
  haloFor,
  hex,
  isThemeId,
  mix,
  outlineFor,
  skyAt,
  THEME_IDS,
  tierIndex,
  TIER_FLOORS,
  VOYAGE,
  type Theme,
} from '../../src/game/render/themes';

const ALL: Theme[] = [...THEME_IDS.map(getTheme), VOYAGE];
const HEIGHTS = Array.from({ length: 241 }, (_, i) => i * 0.25); // 0..60 étages

describe('paliers et ciel', () => {
  it('seuils 10 / 25 / 50 étages', () => {
    expect(TIER_FLOORS).toEqual([0, 10, 25, 50]);
    expect([0, 9, 9.99, 10, 24, 25, 49, 50, 999].map(tierIndex)).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it.each(ALL)('$name : ciel continu, égal aux couleurs du palier à chaque seuil, constant au-delà de 50', (theme) => {
    for (const [i, floor] of TIER_FLOORS.entries()) {
      expect(skyAt(theme, floor).top).toEqual(theme.tiers[i]!.skyTop);
      expect(skyAt(theme, floor).bottom).toEqual(theme.tiers[i]!.skyBottom);
    }
    expect(skyAt(theme, 500)).toEqual(skyAt(theme, 50));
    expect(skyAt(theme, -3)).toEqual(skyAt(theme, 0));
    // Continuité : jamais de saut de plus de 8 niveaux par canal sur un quart d'étage.
    for (let i = 1; i < HEIGHTS.length; i++) {
      const a = skyAt(theme, HEIGHTS[i - 1]!).top;
      const b = skyAt(theme, HEIGHTS[i]!).top;
      expect(Math.max(...a.map((v, k) => Math.abs(v - b[k]!)))).toBeLessThanOrEqual(8);
    }
  });

  it('une partie courte voit déjà le ciel bouger (6 étages ≠ 0 étage)', () => {
    for (const theme of ALL) expect(skyAt(theme, 6).top).not.toEqual(skyAt(theme, 0).top);
  });
});

describe('lisibilité (contraste WCAG 2.x mesuré)', () => {
  it('référence : noir sur blanc = 21, #777 sur blanc ≈ 4,48', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrast(hex('#777777'), [255, 255, 255])).toBeCloseTo(4.48, 2);
  });

  it.each(ALL)('$name : score lisible à toute hauteur (≥ 3 sur le ciel, ≥ 4,5 contre son liseré)', (theme) => {
    for (const h of HEIGHTS) {
      const sky = skyAt(theme, h);
      expect(contrast(sky.ink, haloFor(sky.ink))).toBeGreaterThanOrEqual(4.5);
      for (const y of [0.05, 0.12, 0.2]) {
        expect(contrast(sky.ink, mix(sky.top, sky.bottom, y)), `hauteur ${h}, y ${y}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it.each(ALL)('$name : bord de chaque bloc ≥ 3 sur le ciel derrière lui, à toute hauteur', (theme) => {
    for (const h of HEIGHTS) {
      const sky = skyAt(theme, h);
      for (let y = 0.25; y <= 0.951; y += 0.05) {
        const behind = mix(sky.top, sky.bottom, y);
        for (const b of theme.blocks) {
          const edge = Math.max(contrast(b, behind), contrast(outlineFor(b, behind), behind));
          expect(edge, `hauteur ${h}, y ${y.toFixed(2)}, bloc ${b.join(',')}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});

describe('univers', () => {
  it('trois univers distincts, quatre paliers nommés chacun, au moins six couleurs de blocs', () => {
    expect(THEME_IDS).toEqual(['confiserie', 'orbital', 'jardin']);
    const names = new Set<string>();
    for (const id of THEME_IDS) {
      const t = getTheme(id);
      expect(t.id).toBe(id);
      expect(t.tiers).toHaveLength(4);
      t.tiers.forEach((tier) => names.add(tier.name));
      expect(t.blocks.length).toBeGreaterThanOrEqual(6);
    }
    expect(names.size).toBe(12);
  });

  it('les ciels de départ sont nettement différents deux à deux', () => {
    const tops = THEME_IDS.map((id) => getTheme(id).tiers[0].skyTop);
    for (let i = 0; i < tops.length; i++) {
      for (let j = i + 1; j < tops.length; j++) {
        const d = Math.hypot(...tops[i]!.map((v, k) => v - tops[j]![k]!));
        expect(d).toBeGreaterThan(60);
      }
    }
  });

  it('identifiant inconnu → Confiserie ; validation stricte', () => {
    expect(getTheme('inconnu').id).toBe('confiserie');
    expect(getTheme(undefined).id).toBe('confiserie');
    expect(isThemeId('orbital')).toBe(true);
    expect(isThemeId('Orbital')).toBe(false);
    expect(isThemeId(1)).toBe(false);
  });

  it('variante voyage : Confiserie, puis Jardin au palier 2, puis Orbital au palier 3', () => {
    expect(VOYAGE.tiers[0]).toBe(getTheme('confiserie').tiers[0]);
    expect(VOYAGE.tiers[2]).toBe(getTheme('jardin').tiers[2]);
    expect(VOYAGE.tiers[3]).toBe(getTheme('orbital').tiers[3]);
  });
});

describe('relief : jamais plus large que le bloc', () => {
  it('toutes les parties restent dans [0, w], pour toute largeur', () => {
    for (const w of [0.001, 0.5, 1, 2, 4, 7, 12, 30, 61.325, 120, 180.675, 240]) {
      const p = reliefParts(w);
      for (const part of [p.face, p.top, p.lip, p.gloss]) {
        expect(part.x).toBeGreaterThanOrEqual(0);
        expect(part.w).toBeGreaterThanOrEqual(0);
        expect(part.x + part.w).toBeLessThanOrEqual(w + 1e-9);
      }
      expect(p.face).toEqual({ x: 0, w });
    }
  });
});

/** Contexte 2D factice qui enregistre les appels utiles, pour piloter le renderer sans navigateur. */
function fakeCanvas() {
  const calls: string[] = [];
  const store: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(store, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      return (..._args: unknown[]) => { calls.push(String(prop)); };
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
  return { canvas, calls };
}

const placed = (floor: number, perfect: boolean, streak = 0): StepEvent => ({
  kind: 'placed', tick: floor * 100, floor, placed: { left: 60_000, width: 200_000 },
  cut: perfect ? null : { left: 260_000, width: 40_000 }, perfect, perfectStreak: streak,
});

function viewFor(floors: number): ViewState {
  const stack = Array.from({ length: floors + 1 }, () => ({ left: 60_000, width: 200_000 }));
  return { stack, moving: { left: 0, width: 200_000 }, score: floors, perfectStreak: 0, pause: 'none' };
}

describe('renderer (contexte factice)', () => {
  it('annonce un palier à 10, 25 et 50 étages seulement, avec le nom de l\'univers', () => {
    const { canvas } = fakeCanvas();
    const r = new Renderer(canvas, false, getTheme('jardin'));
    const hits: [number, string][] = [];
    for (let f = 1; f <= 60; f++) {
      const name = r.onEvent(placed(f, false));
      if (name) hits.push([f, name]);
    }
    expect(hits).toEqual([[10, 'Floraison'], [25, 'Envol'], [50, 'Soleil couchant']]);
  });

  it('reduced-motion : aucun étincelle ni onde sur des parfaits, effets terminés vite', () => {
    const { canvas } = fakeCanvas();
    const r = new Renderer(canvas, true, getTheme('confiserie'));
    r.resize(390, 844, 2);
    for (let f = 1; f <= 5; f++) r.onEvent(placed(f, true, f));
    expect(r.sparkCount).toBe(0);
    let now = 0;
    for (let i = 0; i < 300 && r.animating; i++) r.draw(viewFor(5), (now += 16));
    expect(r.animating).toBe(false);
    expect(now).toBeLessThan(3000);
  });

  it('effets, décor et caches bornés sur une très longue montée (300 étages, série de parfaits)', () => {
    const { canvas } = fakeCanvas();
    const r = new Renderer(canvas, false, getTheme('orbital'));
    r.resize(390, 844, 3);
    let now = 0;
    let maxDecor = 0;
    let maxMemory = 0;
    for (let f = 1; f <= 300; f++) {
      r.onEvent(placed(f, true, f));
      for (let k = 0; k < 4; k++) {
        r.draw(viewFor(f), (now += 16));
        maxDecor = Math.max(maxDecor, r.decorCount);
        maxMemory = Math.max(maxMemory, r.decorMemorySize);
      }
      expect(r.sparkCount).toBeLessThanOrEqual(MAX_SPARKS);
    }
    expect(maxDecor).toBeGreaterThan(0);
    expect(maxDecor).toBeLessThanOrEqual(MAX_DECOR);
    expect(maxMemory).toBeLessThanOrEqual(80);
    expect(r.gradientCacheSize).toBeLessThanOrEqual(64);
  });

  it('les blocs visibles sont dessinés en nombre borné, pas toute la pile', () => {
    const { canvas, calls } = fakeCanvas();
    const r = new Renderer(canvas, true, getTheme('confiserie'));
    r.resize(390, 844, 2);
    r.draw(viewFor(400), 16);
    calls.length = 0;
    r.draw(viewFor(400), 32);
    // Chaque bloc fait un seul `stroke` de contour : on en compte bien moins que 400.
    const strokes = calls.filter((c) => c === 'stroke').length;
    expect(strokes).toBeGreaterThan(5);
    expect(strokes).toBeLessThan(60);
    expect(BLOCK_HEIGHT).toBe(30);
  });
});

describe('V2 (F4) : apparences', () => {
  it('six apparences, identifiants stables convenus avec A3', () => {
    expect(SKIN_IDS).toEqual(['gomme', 'marbre', 'bonbon', 'verre', 'strie', 'ceramique']);
    expect(isSkinId('verre')).toBe(true);
    expect(isSkinId('Verre')).toBe(false);
    expect(isSkinId(undefined)).toBe(false);
  });

  it('resolveAppearance : sauvegarde obsolète ou abîmée → Confiserie / Gomme, sans erreur', () => {
    expect(resolveAppearance({ theme: 'orbital', skin: 'verre' })).toEqual({ theme: 'orbital', skin: 'verre' });
    expect(resolveAppearance({ theme: 'lune', skin: 'or' })).toEqual({ theme: 'confiserie', skin: 'gomme' });
    expect(resolveAppearance({ theme: 'jardin' })).toEqual({ theme: 'jardin', skin: 'gomme' });
    for (const raw of [null, undefined, 42, 'orbital', [], { theme: 1 }]) {
      expect(resolveAppearance(raw)).toEqual({ theme: 'confiserie', skin: 'gomme' });
    }
  });

  it.each(SKIN_IDS)('%s : bord de chaque bloc ≥ 3 sur le ciel derrière lui, dans chaque univers et à toute hauteur', (skin) => {
    for (const theme of ALL) {
      for (const h of HEIGHTS) {
        const sky = skyAt(theme, h);
        for (let y = 0.25; y <= 0.951; y += 0.05) {
          const behind = mix(sky.top, sky.bottom, y);
          for (const b of theme.blocks) {
            const { face, outline } = edgeColors(b, skin, behind);
            const edge = Math.max(contrast(face, behind), contrast(outline, behind));
            expect(edge, `${theme.name}, ${skin}, hauteur ${h}, y ${y.toFixed(2)}, bloc ${b.join(',')}`).toBeGreaterThanOrEqual(3);
          }
        }
      }
    }
  });

  it('le renderer garde son apparence et la change en vidant le cache de dégradés', () => {
    const { canvas } = fakeCanvas();
    const r = new Renderer(canvas, true, getTheme('jardin'), 'ceramique');
    expect(r.skinId).toBe('ceramique');
    r.resize(390, 844, 2);
    r.draw(viewFor(10), 16);
    expect(r.gradientCacheSize).toBeGreaterThan(0);
    r.setSkin('verre');
    expect(r.skinId).toBe('verre');
    expect(r.gradientCacheSize).toBe(0);
  });
});
