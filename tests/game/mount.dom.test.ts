// @vitest-environment jsdom
/**
 * Frontières DOM de F1 exécutées par `npm test`, donc par la CI d'A0 (revue Codex F1, R2).
 * jsdom n'a ni Canvas 2D, ni RAF piloté, ni ResizeObserver : on fournit un faux contexte,
 * une horloge et un RAF manuels. Les specs Playwright de tests/game/browser restent la
 * preuve en vrai navigateur ; celles-ci garantissent que la CI casse aussi sans elles.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyRunResult } from '../../src/game/core';
import { END_DELAY_MS, mountGame, type GameEvent, type GameHandle, type MountOptions } from '../../src/game';
import type { RunResult } from '../../src/game/core';
import { createGame } from '../../src/game/render/mount';
import { THEME_IDS } from '../../src/game/render/themes';
import { renderAppearancePreview, SKIN_IDS } from '../../src/game';

const TICK_MS = 1000 / 120;

/** Contexte 2D factice : toutes les méthodes existent et ne font rien, les propriétés se stockent. */
function fakeContext(): CanvasRenderingContext2D {
  const store: Record<string | symbol, unknown> = {};
  return new Proxy(store, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

let now = 0;
let frames = new Map<number, FrameRequestCallback>();
let nextId = 0;
let liveListeners = new Map<string, number>();
const originals = {
  raf: window.requestAnimationFrame,
  caf: window.cancelAnimationFrame,
  add: EventTarget.prototype.addEventListener,
  remove: EventTarget.prototype.removeEventListener,
};
let canvas: HTMLCanvasElement;
let handle: GameHandle | null = null;
let visibility: DocumentVisibilityState = 'visible';

function label(t: EventTarget, type: string) {
  return `${t === window ? 'window' : t === document ? 'document' : t instanceof HTMLCanvasElement ? 'canvas' : 'other'}:${type}`;
}

beforeEach(() => {
  now = 1000;
  frames = new Map();
  nextId = 0;
  liveListeners = new Map();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  vi.spyOn(window.performance, 'now').mockImplementation(() => now);
  window.requestAnimationFrame = (cb) => { frames.set(++nextId, cb); return nextId; };
  window.cancelAnimationFrame = (id) => { frames.delete(id); };
  const seen = new WeakMap<object, Set<string>>();
  EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, l: EventListenerOrEventListenerObject | null, o?: boolean | AddEventListenerOptions) {
    if (l) {
      const key = `${label(this, type)}:${typeof o === 'boolean' ? o : !!o?.capture}`;
      const set = seen.get(l) ?? new Set<string>();
      if (!set.has(key)) {
        set.add(key);
        seen.set(l, set);
        liveListeners.set(label(this, type), (liveListeners.get(label(this, type)) ?? 0) + 1);
      }
    }
    originals.add.call(this, type, l, o);
  };
  EventTarget.prototype.removeEventListener = function (this: EventTarget, type: string, l: EventListenerOrEventListenerObject | null, o?: boolean | EventListenerOptions) {
    if (l) {
      const key = `${label(this, type)}:${typeof o === 'boolean' ? o : !!o?.capture}`;
      if (seen.get(l)?.delete(key)) liveListeners.set(label(this, type), (liveListeners.get(label(this, type)) ?? 1) - 1);
    }
    originals.remove.call(this, type, l, o);
  };
  canvas = document.createElement('canvas');
  canvas.getContext = (() => fakeContext()) as unknown as typeof canvas.getContext;
  document.body.replaceChildren(canvas);
});

afterEach(() => {
  handle?.destroy();
  handle = null;
  EventTarget.prototype.addEventListener = originals.add;
  EventTarget.prototype.removeEventListener = originals.remove;
  window.requestAnimationFrame = originals.raf;
  window.cancelAnimationFrame = originals.caf;
  vi.restoreAllMocks();
});

/** Avance l'horloge de `ms` en images de 60 Hz, en exécutant les RAF en attente. */
function run(ms: number) {
  const end = now + ms;
  while (now < end) {
    now = Math.min(end, now + 1000 / 60);
    const callbacks = [...frames.values()];
    frames.clear();
    for (const cb of callbacks) cb(now);
  }
}

function mount(extra: Partial<MountOptions> = {}) {
  const ends: RunResult[] = [];
  const events: GameEvent[] = [];
  handle = mountGame({
    canvas,
    config: { seed: 1, rulesVersion: 1 },
    onEnd: (r) => ends.push(r),
    onEvent: (e) => events.push(e),
    sound: false,
    ...extra,
  });
  return { ends, events };
}

function pointer(opts: { pointerType?: string; button?: number; at?: number } = {}) {
  const e = new Event('pointerdown', { bubbles: true, cancelable: true });
  Object.defineProperties(e, {
    pointerType: { value: opts.pointerType ?? 'touch' },
    button: { value: opts.button ?? 0 },
    timeStamp: { value: opts.at ?? now },
  });
  canvas.dispatchEvent(e);
  return e;
}

function key(type: 'keydown' | 'keyup', target: EventTarget, init: KeyboardEventInit = {}) {
  const e = new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true, cancelable: true, ...init });
  Object.defineProperty(e, 'timeStamp', { value: now });
  target.dispatchEvent(e);
  return e;
}

/**
 * Joue la séquence calculée à la main de la seed 1 (poses aux ticks 177 et 433, raté au 434).
 * `start` = instant du montage, qui ancre le tick 0.
 */
function playSeed1ToMiss(events: GameEvent[], start: number) {
  for (const t of [177, 433, 434]) {
    run(start + (t - 0.5) * TICK_MS - now);
    pointer({ at: now });
    run(TICK_MS);
  }
  expect(events.map((e) => e.tick)).toEqual([177, 433, 434]);
}

describe('F1 en DOM (exécuté par npm test)', () => {
  it('un toucher = une pose, preventDefault posé ; clic droit ignoré', () => {
    const { events } = mount();
    run(100);
    const right = pointer({ pointerType: 'mouse', button: 2 });
    run(50);
    expect(events).toEqual([]);
    expect(right.defaultPrevented).toBe(false);
    const tap = pointer();
    expect(tap.defaultPrevented).toBe(true); // supprime aussi les événements souris émulés
    run(50);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'placement', floor: 1 });
    expect(canvas.style.touchAction).toBe('none');
  });

  it('espace : pose une fois, keydown et keyup bloqués pour le bouton focalisé, répétition ignorée', () => {
    const { events } = mount();
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    run(100);
    const down = key('keydown', button);
    const repeat = key('keydown', button, { repeat: true });
    const up = key('keyup', button);
    run(50);
    expect(down.defaultPrevented && repeat.defaultPrevented && up.defaultPrevented).toBe(true);
    expect(events).toHaveLength(1);
    // Champ éditable : l'espace reste au DOM.
    const input = document.createElement('input');
    document.body.append(input);
    expect(key('keydown', input).defaultPrevented).toBe(false);
  });

  it('partie complète : onEvent dans l’ordre, onEnd une fois après END_DELAY_MS, rejeu valide, espace rendu au DOM', () => {
    const start = now;
    const { ends, events } = mount();
    playSeed1ToMiss(events, start);
    expect(events.at(-1)).toEqual({ type: 'miss', tick: 434, floor: 3 });
    run(END_DELAY_MS - 100);
    expect(ends).toHaveLength(0);
    run(200);
    expect(ends).toEqual([{ seed: 1, rulesVersion: 1, score: 2, perfectCount: 0, durationTicks: 434, inputTicks: [177, 433, 434] }]);
    expect(verifyRunResult(ends[0]).ok).toBe(true);
    run(5000);
    expect(ends).toHaveLength(1);
    expect(frames.size).toBe(0); // boucle arrêtée une fois les effets finis
    expect(key('keydown', document.body).defaultPrevented).toBe(false);
  });

  it('pause() : aucun tick, appuis ignorés, RAF arrêté ; resume() sans rattrapage', () => {
    const { events } = mount();
    run(500);
    handle!.pause();
    expect(frames.size).toBe(0);
    pointer();
    run(2000);
    expect(events).toEqual([]);
    handle!.resume();
    run(100);
    pointer();
    run(20);
    // Sans rattrapage, l'appui tombe ~60 + 12 ticks après le départ, pas ~300.
    expect(events).toHaveLength(1);
    expect(events[0]!.tick).toBeLessThan(100);
  });

  it('onglet caché : pause automatique ; au retour, le premier toucher reprend sans poser', () => {
    const { events } = mount();
    run(200);
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(0);
    handle!.resume(); // refusé tant que l'onglet est caché
    expect(frames.size).toBe(0);
    run(3000);
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    pointer();
    run(50);
    expect(events).toEqual([]);
    pointer();
    run(20);
    expect(events).toHaveLength(1);
    expect(events[0]!.tick).toBeLessThan(40);
  });

  it('destroy : aucun écouteur ni RAF restant, touch-action restauré, idempotent ; onEnd non appelé', () => {
    const { ends, events } = mount();
    run(100);
    handle!.destroy();
    handle!.destroy();
    expect([...liveListeners.values()].every((n) => n === 0)).toBe(true);
    expect(frames.size).toBe(0);
    expect(canvas.style.touchAction).toBe('');
    pointer();
    run(1000);
    expect(events).toEqual([]);
    expect(ends).toEqual([]);
  });

  it('onEnd peut appeler destroy sans erreur ni second appel', () => {
    const events: GameEvent[] = [];
    let calls = 0;
    const start = now;
    handle = mountGame({
      canvas, config: { seed: 1, rulesVersion: 1 }, sound: false,
      onEvent: (e) => events.push(e),
      onEnd: () => { calls++; handle!.destroy(); },
    });
    playSeed1ToMiss(events, start);
    run(2000);
    expect(calls).toBe(1);
    expect(frames.size).toBe(0);
  });

  it('une exception dans onEvent ne casse pas la boucle', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ends: RunResult[] = [];
    const start = now;
    handle = mountGame({
      canvas, config: { seed: 1, rulesVersion: 1 }, sound: false,
      onEvent: () => { throw new Error('shell'); },
      onEnd: (r) => ends.push(r),
    });
    for (const t of [177, 433, 434]) { run(start + (t - 0.5) * TICK_MS - now); pointer({ at: now }); run(TICK_MS); }
    run(1000);
    expect(ends.map((r) => r.inputTicks)).toEqual([[177, 433, 434]]);
    expect(error).toHaveBeenCalled();
  });

  it('échecs de montage synchrones sans effet de bord', () => {
    const plain = document.createElement('canvas');
    plain.getContext = (() => null) as typeof plain.getContext;
    expect(() => mountGame({ canvas: plain, config: { seed: 1, rulesVersion: 1 }, onEnd() {} })).toThrow('Canvas 2D indisponible');
    expect(() => mountGame({ canvas, config: { seed: 0, rulesVersion: 1 }, onEnd() {} })).toThrow(RangeError);
    expect([...liveListeners.values()].every((n) => n === 0)).toBe(true);
    expect(frames.size).toBe(0);
    expect(plain.style.touchAction).toBe('');
  });
});

describe('V2 (F3) : l\'univers ne change jamais la partie', () => {
  it('même séquence d\'appuis → même RunResult dans les trois univers et en variante voyage', () => {
    const variants: { theme?: (typeof THEME_IDS)[number]; voyage?: boolean }[] = [
      ...THEME_IDS.map((theme) => ({ theme })),
      { voyage: true },
    ];
    const results: RunResult[] = [];
    for (const variant of variants) {
      const ends: RunResult[] = [];
      const start = now;
      const game = createGame({
        canvas, config: { seed: 1, rulesVersion: 1 }, sound: false, onEnd: (r) => ends.push(r), ...variant,
      });
      handle = game;
      for (const t of [177, 433, 434]) { run(start + (t - 0.5) * TICK_MS - now); pointer({ at: now }); run(TICK_MS); }
      run(1500);
      expect(ends).toHaveLength(1);
      results.push(ends[0]!);
      game.destroy();
      handle = null;
    }
    for (const r of results) {
      expect(r).toEqual({ seed: 1, rulesVersion: 1, score: 2, perfectCount: 0, durationTicks: 434, inputTicks: [177, 433, 434] });
    }
  });
});

describe('V2 (F4) : apparences et aperçu', () => {
  it('option publique appearance : même RunResult pour chaque apparence (et identifiants inconnus tolérés)', () => {
    const appearances = [
      ...SKIN_IDS.map((skin) => ({ theme: 'orbital' as const, skin })),
      { theme: 'inconnu', skin: 'or' } as unknown as { theme: 'jardin'; skin: 'gomme' },
    ];
    for (const appearance of appearances) {
      const ends: RunResult[] = [];
      const start = now;
      handle = mountGame({ canvas, config: { seed: 1, rulesVersion: 1 }, sound: false, onEnd: (r) => ends.push(r), appearance });
      for (const t of [177, 433, 434]) { run(start + (t - 0.5) * TICK_MS - now); pointer({ at: now }); run(TICK_MS); }
      run(1500);
      expect(ends).toEqual([{ seed: 1, rulesVersion: 1, score: 2, perfectCount: 0, durationTicks: 434, inputTicks: [177, 433, 434] }]);
      handle.destroy();
      handle = null;
    }
  });

  it('aperçu : dessin pur, aucun écouteur ni RAF ; false sans Canvas 2D', () => {
    const before = [...liveListeners.values()].reduce((a, b) => a + b, 0);
    expect(renderAppearancePreview(canvas, { theme: 'jardin', skin: 'marbre' }, { width: 120, height: 84, dpr: 2 })).toBe(true);
    expect(canvas.width).toBe(240);
    expect(canvas.height).toBe(168);
    expect([...liveListeners.values()].reduce((a, b) => a + b, 0)).toBe(before);
    expect(frames.size).toBe(0);
    const plain = document.createElement('canvas');
    plain.getContext = (() => null) as typeof plain.getContext;
    expect(renderAppearancePreview(plain, { theme: 'orbital', skin: 'verre' })).toBe(false);
  });
});
