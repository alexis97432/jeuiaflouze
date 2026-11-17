// @vitest-environment jsdom
/**
 * F7 (V3) : montage des règles v2 — points/hauteur, jauge et bonus, attente de reprise,
 * continueRun/declineContinue, compte à rebours, pause/visibilité, anciens défis v1.
 * Même banc que mount.dom.test.ts (faux Canvas 2D, horloge et RAF manuels).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COUNTDOWN_TICKS, SimulationV2, verifyRunResult, type RunResultV2 } from '../../src/game/core';
import { END_DELAY_MS, mountGame, type GameEvent, type GameHandle, type MountOptions } from '../../src/game';
import type { RunResult } from '../../src/game/render/mount';
import { createGame } from '../../src/game/render/mount';
import { play, shrinkThenMiss, type Kind } from './bot-v2';

const SEED = 3;

/**
 * Partie de référence calculée hors DOM : 10 poses (bonus Ralenti), un raté, reprise,
 * 2 poses, raté final. `first` = entrées jusqu'au premier raté inclus ; `after` = suite.
 */
function reference(withContinue: boolean) {
  const sim = new SimulationV2({ seed: SEED, rulesVersion: 2 });
  for (const k of Array<Kind>(10).fill('placed')) play(sim, k);
  shrinkThenMiss(sim);
  const first = [...sim.inputTicks];
  if (withContinue) {
    sim.continueRun();
    play(sim, 'perfect');
    play(sim, 'placed');
    shrinkThenMiss(sim);
  } else {
    sim.finish();
  }
  const result = sim.result()!;
  return { first, after: result.inputTicks.slice(first.length), result };
}

const TICK_MS = 1000 / 120;

/** Contexte 2D factice : toutes les méthodes existent et ne font rien, les propriétés se stockent. */
function fakeContext(): CanvasRenderingContext2D {
  const store: Record<string | symbol, unknown> = {};
  return new Proxy(store, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (prop === 'measureText') return (t: string) => ({ width: t.length * 8 });
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
function run(ms: number, hz = 60) {
  const end = now + ms;
  while (now < end) {
    now = Math.min(end, now + 1000 / hz);
    const callbacks = [...frames.values()];
    frames.clear();
    for (const cb of callbacks) cb(now);
  }
}

function mount(extra: Partial<MountOptions> = {}) {
  const ends: RunResult[] = [];
  const events: GameEvent[] = [];
  handle = createGame({
    canvas,
    config: { seed: SEED, rulesVersion: 2 },
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

/** Appuie aux ticks donnés ; `anchor` = instant réel du tick `base` (montage ou reprise). */
function pressAt(ticks: readonly number[], anchor: number, base = 0, hz = 60) {
  for (const t of ticks) {
    run(anchor + (t - base - 0.5) * TICK_MS - now, hz);
    pointer({ at: now });
    run(TICK_MS, hz);
  }
}

const types = (events: GameEvent[]) => events.map((e) => e.type);

describe('F7 : partie v2 montée', () => {
  it('points, hauteur, jauge et bonus annoncés ; résultat v2 identique au rejeu de référence', () => {
    const ref = reference(false);
    const start = now;
    const { ends, events } = mount();
    pressAt(ref.first, start);
    run(END_DELAY_MS + 100);
    expect(ends).toHaveLength(1);
    expect(ends[0]).toEqual(ref.result);
    expect(verifyRunResult(ends[0]).ok).toBe(true);
    const placements = events.filter((e) => e.type === 'placement');
    expect(placements[0]).toMatchObject({ points: 1, score: 1, height: 1 });
    const gauges = events.filter((e): e is Extract<GameEvent, { type: 'gauge' }> => e.type === 'gauge');
    expect(gauges.slice(0, 9).map((g) => g.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(events).toContainEqual({ type: 'bonus-start', bonus: 'ralenti', floors: 5 });
    // Sans allowContinue : jamais d'offre, fin normale.
    expect(types(events)).not.toContain('continue-offer');
    expect((ends[0] as RunResultV2).continues).toBe(0);
  });

  it('même résultat à 30, 60 et 144 Hz', () => {
    const ref = reference(true);
    for (const hz of [30, 144, 60]) {
      handle?.destroy();
      const start = now;
      const { ends, events } = mount({ allowContinue: true });
      pressAt(ref.first, start, 0, hz);
      expect(types(events)).toContain('continue-offer');
      run(2000, hz); // temps de décision : sans effet sur les règles
      expect(handle!.continueRun!()).toBe(true);
      pressAt(ref.after, now, ref.first.at(-1)!, hz);
      run(END_DELAY_MS + 100, hz);
      expect(ends).toEqual([ref.result]);
    }
  });
});

describe('F7 : reprise', () => {
  it('offre → attente sans tick ni onEnd ; appuis ignorés ; continueRun une seule fois ; fin unique avec reprise', () => {
    const ref = reference(true);
    const start = now;
    const { ends, events } = mount({ allowContinue: true });
    pressAt(ref.first, start);
    const offer = events.find((e) => e.type === 'continue-offer');
    expect(offer).toEqual({ type: 'continue-offer', tick: ref.first.at(-1) });
    const game = handle as ReturnType<typeof createGame>;
    // Attente longue (vidéo) : aucun tick, aucun onEnd, les appuis sur le canvas ne posent rien.
    for (let i = 0; i < 10; i++) {
      run(1000);
      expect(pointer().defaultPrevented).toBe(false); // l'entrée est rendue au DOM (bouton de l'offre)
    }
    expect(ends).toEqual([]);
    const fallenAt = ref.first.at(-1)!;
    expect(handle!.continueRun!()).toBe(true);
    expect(handle!.continueRun!()).toBe(false); // second rappel de la régie : sans effet
    expect(handle!.declineContinue!).toBeDefined();
    handle!.declineContinue!(); // trop tard : sans effet
    expect(types(events).slice(-2)).toEqual(['continue-start', 'gauge']);
    expect(events.at(-2)).toEqual({ type: 'continue-start', countdownTicks: COUNTDOWN_TICKS });
    // Compte à rebours : appuis refusés, aucune entrée enregistrée.
    const anchor = now;
    run(1000);
    pointer();
    run(1000);
    pointer();
    expect(createGameSim(game).inputTicks.length).toBe(ref.first.length);
    pressAt(ref.after, anchor, fallenAt);
    run(END_DELAY_MS + 100);
    expect(ends).toEqual([ref.result]);
    expect((ends[0] as RunResultV2).continues).toBe(1);
    expect(verifyRunResult(ends[0]).ok).toBe(true);
    // Une seule offre par partie.
    expect(types(events).filter((t) => t === 'continue-offer')).toHaveLength(1);
    run(3000);
    expect(ends).toHaveLength(1);
  });

  it('declineContinue : fin normale unique, sans reprise ; continueRun ensuite refusé', () => {
    const ref = reference(false);
    const start = now;
    const { ends } = mount({ allowContinue: true });
    pressAt(ref.first, start);
    run(5000);
    expect(ends).toEqual([]);
    handle!.declineContinue!();
    expect(handle!.continueRun!()).toBe(false);
    run(END_DELAY_MS + 100);
    expect(ends).toEqual([ref.result]);
    handle!.declineContinue!();
    run(2000);
    expect(ends).toHaveLength(1);
  });

  it('pause du shell pendant le compte à rebours : le décompte s’arrête puis reprend sans saut', () => {
    const ref = reference(true);
    const start = now;
    mount({ allowContinue: true });
    pressAt(ref.first, start);
    handle!.continueRun!();
    const sim = createGameSim(handle as ReturnType<typeof createGame>) as SimulationV2;
    run(1000);
    const left = sim.countdownLeft;
    expect(left).toBeGreaterThan(200);
    handle!.pause();
    run(10_000);
    expect(sim.countdownLeft).toBe(left);
    handle!.resume();
    run(500);
    expect(sim.countdownLeft).toBeLessThan(left);
    expect(sim.status).toBe('countdown');
    run(3000);
    expect(sim.status).toBe('running');
  });

  it('onglet caché pendant l’offre puis visible : la reprise repart sans geste supplémentaire', () => {
    const ref = reference(true);
    const start = now;
    mount({ allowContinue: true });
    pressAt(ref.first, start);
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    run(5000);
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(handle!.continueRun!()).toBe(true);
    const sim = createGameSim(handle as ReturnType<typeof createGame>) as SimulationV2;
    run(3200);
    expect(sim.status).toBe('running');
  });

  it('pause du shell pendant l’offre, puis continueRun : la reprise attend resume()', () => {
    const ref = reference(true);
    const start = now;
    mount({ allowContinue: true });
    pressAt(ref.first, start);
    handle!.pause();
    expect(handle!.continueRun!()).toBe(true);
    const sim = createGameSim(handle as ReturnType<typeof createGame>) as SimulationV2;
    const tick = sim.tick;
    run(5000);
    expect(sim.tick).toBe(tick);
    handle!.resume();
    run(3200);
    expect(sim.status).toBe('running');
  });

  it('destroy pendant l’offre : continueRun et declineContinue sans effet, aucun onEnd', () => {
    const ref = reference(true);
    const start = now;
    const { ends } = mount({ allowContinue: true });
    pressAt(ref.first, start);
    handle!.destroy();
    expect(handle!.continueRun!()).toBe(false);
    handle!.declineContinue!();
    run(3000);
    expect(ends).toEqual([]);
  });
});

describe('F7 : anciens défis v1', () => {
  it('rulesVersion 1 : allowContinue ignoré, continueRun refusé, résultat v1 inchangé', () => {
    const start = now;
    const ends: RunResult[] = [];
    const events: GameEvent[] = [];
    handle = mountGame({
      canvas, config: { seed: 1, rulesVersion: 1 }, onEnd: (r) => ends.push(r), onEvent: (e) => events.push(e),
      sound: false, allowContinue: true,
    });
    pressAt([177, 433, 434], start);
    expect(types(events)).toEqual(['placement', 'placement', 'miss']);
    expect(events[0]).toMatchObject({ points: 1, score: 1, height: 1 });
    expect(handle.continueRun!()).toBe(false);
    run(END_DELAY_MS + 100);
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ rulesVersion: 1, score: 2 });
    expect(ends[0]).not.toHaveProperty('continues');
  });
});

function createGameSim(game: ReturnType<typeof createGame>) {
  return game.inspect().sim;
}

describe('F7 : API publique et geste qui traverse l’offre', () => {
  it('mountGame expose continueRun et declineContinue ; Espace pendant l’offre reste au DOM', () => {
    const ref = reference(true);
    const start = now;
    const ends: RunResult[] = [];
    const events: GameEvent[] = [];
    handle = mountGame({
      canvas, config: { seed: SEED, rulesVersion: 2 }, onEnd: (r) => ends.push(r), onEvent: (e) => events.push(e),
      sound: false, allowContinue: true,
    });
    expect(typeof handle.continueRun).toBe('function');
    expect(typeof handle.declineContinue).toBe('function');
    pressAt(ref.first, start);
    expect(types(events)).toContain('continue-offer');
    // Espace sur le bouton « Continuer » de l'offre : le jeu ne le capte pas (pas de preventDefault).
    const button = document.createElement('button');
    document.body.append(button);
    const down = new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true });
    button.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
    expect(handle.continueRun!()).toBe(true);
    // Le même geste (relâché après la reprise) ne pose rien : compte à rebours.
    const up = new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true, cancelable: true });
    button.dispatchEvent(up);
    run(500);
    expect(types(events).filter((t) => t === 'placement')).toHaveLength(ref.first.length - 1);
  });
});
