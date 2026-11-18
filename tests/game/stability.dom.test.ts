// @vitest-environment jsdom
/**
 * V7 — stabilité du rendu (crashs intermittents signalés sur téléphone).
 *
 * Le contexte factice est « strict » : comme un vrai navigateur, `arc` et `ellipse` lèvent une
 * exception pour un rayon négatif. Cause reproduite et corrigée : l'onde de célébration des
 * matières légendaires partait avec un âge négatif ; sur un bloc étroit, son rayon devenait négatif,
 * `ellipse` levait, l'exception sortait de la boucle de jeu qui ne se reprogrammait plus.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advance, SimulationV3, type StepEventV3 } from '../../src/game/core';
import { Renderer, type ViewState } from '../../src/game/render/renderer';
import { getTheme } from '../../src/game/render/themes';
import { createGame, type GameIncident } from '../../src/game/render/mount';

type Calls = { ellipse: number[][]; arc: number[][] };

/** Contexte 2D factice qui refuse les rayons négatifs, comme Chromium et WebKit. */
function strictContext(calls: Calls, opts: { failFillRect?: () => boolean } = {}): CanvasRenderingContext2D {
  const store: Record<string | symbol, unknown> = {};
  const radius = (name: string, r: number) => {
    if (r < 0) throw new DOMException(`Failed to execute '${name}': The radius provided (${r}) is negative.`, 'IndexSizeError');
  };
  return new Proxy(store, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (prop === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (prop === 'ellipse') {
        return (...a: number[]) => {
          calls.ellipse.push(a);
          radius('ellipse', a[2]!);
          radius('ellipse', a[3]!);
        };
      }
      if (prop === 'arc') {
        return (...a: number[]) => {
          calls.arc.push(a);
          radius('arc', a[2]!);
        };
      }
      if (prop === 'fillRect') {
        return () => {
          if (opts.failFillRect?.()) throw new TypeError('échec simulé du dessin principal');
        };
      }
      if (prop === 'measureText') return () => ({ width: 10 });
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

/** Partie simulée qui rétrécit la base à moins de `narrow` milli puis réussit un parfait. */
function narrowPerfect(seed: number, narrow: number): { sim: SimulationV3; events: StepEventV3[]; perfect: StepEventV3 | null } {
  const sim = new SimulationV3({ seed, rulesVersion: 3 });
  const events: StepEventV3[] = [];
  let perfect: StepEventV3 | null = null;
  for (let i = 0; i < 200_000 && sim.status !== 'ended' && !perfect; i++) {
    if (sim.status === 'fallen') {
      sim.finish();
      break;
    }
    const w = sim.base.width;
    // Position au moment de la pose : la simulation avance le bloc, puis pose.
    const next = advance(sim.moving.left, sim.direction, sim.speed, sim.base.width).left;
    const off = Math.abs(next - sim.base.left);
    // Grosses coupes successives (la base centrée ne peut perdre que l'écart maximal possible),
    // jusqu'à 6 à 14 unités ; puis un appui aligné donne le parfait.
    const maxOff = Math.max(sim.base.left, 360_000 - w - sim.base.left);
    const press = sim.status === 'running' && (w > narrow
      ? off >= Math.min(w - 14_000, maxOff * 0.9) && off < w - 6_000
      : off <= Math.min(1500, w / 3));
    const e = sim.step(press);
    if (!e) continue;
    events.push(e);
    if (e.kind === 'placed' && e.perfect && e.placed.width <= narrow) perfect = e;
  }
  return { sim, events, perfect };
}

const view = (sim: SimulationV3): ViewState => ({
  stack: sim.stack, moving: sim.moving, score: sim.score, perfectStreak: sim.perfectStreak, pause: 'none',
});

let calls: Calls;
const realGetContext = HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  calls = { ellipse: [], arc: [] };
});
afterEach(() => {
  HTMLCanvasElement.prototype.getContext = realGetContext;
  vi.restoreAllMocks();
});

describe('V7 — onde de célébration des légendaires sur un bloc étroit', () => {
  for (const skin of ['galaxie', 'cristal', 'aurore', 'abysse'] as const) {
    it(`${skin} : aucun rayon négatif, aucune couche coupée`, () => {
      let found: ReturnType<typeof narrowPerfect> | null = null;
      for (let seed = 1; seed < 60 && !found?.perfect; seed++) found = narrowPerfect(seed, 15_000);
      expect(found?.perfect, 'parfait sur une base de moins de 15 unités').toBeTruthy();
      const canvas = document.createElement('canvas');
      canvas.getContext = (() => strictContext(calls)) as never;
      const r = new Renderer(canvas, false, getTheme('cite'), skin);
      const faults: string[] = [];
      r.onFault = (layer) => faults.push(layer);
      r.resize(390, 844, 1);
      r.onEvent(found!.perfect!);
      let now = 1000;
      for (let k = 0; k < 40; k++) {
        now += 16;
        expect(() => r.draw(view(found!.sim), now)).not.toThrow();
      }
      expect(faults).toEqual([]);
      expect(calls.ellipse.every((a) => a[2]! >= 0 && a[3]! >= 0)).toBe(true);
    });
  }
});

describe('V7 — une couche décorative en échec est signalée et coupée, la partie continue', () => {
  it('la scène lève une exception : signalée une fois, coupée, la tour reste dessinée', () => {
    const canvas = document.createElement('canvas');
    canvas.getContext = (() => strictContext(calls)) as never;
    const theme = getTheme('orbital');
    const broken = { ...theme, scene: { ...theme.scene, far: () => { throw new RangeError('décor cassé'); } } };
    const r = new Renderer(canvas, false, broken, 'gomme');
    const faults: { layer: string; error: unknown }[] = [];
    r.onFault = (layer, error) => faults.push({ layer, error });
    r.resize(390, 844, 1);
    const sim = new SimulationV3({ seed: 3, rulesVersion: 3 });
    for (let i = 0; i < 30; i++) expect(() => r.draw(view(sim), 1000 + i * 16)).not.toThrow();
    expect(faults).toHaveLength(1);
    expect(faults[0]!.layer).toBe('scene-ciel');
    expect(String(faults[0]!.error)).toContain('décor cassé');
    expect(r.faults).toEqual(['scene-ciel']);
  });
});

describe('V7 — boucle de jeu protégée', () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextId: number;
  let now: number;
  const raf = window.requestAnimationFrame;
  const caf = window.cancelAnimationFrame;

  beforeEach(() => {
    frames = new Map();
    nextId = 0;
    now = 1000;
    vi.spyOn(window.performance, 'now').mockImplementation(() => now);
    window.requestAnimationFrame = (cb) => { frames.set(++nextId, cb); return nextId; };
    window.cancelAnimationFrame = (id) => { frames.delete(id); };
  });
  afterEach(() => {
    window.requestAnimationFrame = raf;
    window.cancelAnimationFrame = caf;
  });
  const step = (ms: number) => {
    now += ms;
    const pending = [...frames.values()];
    frames.clear();
    for (const cb of pending) cb(now);
  };

  it('le dessin principal lève : incident « rendu », mode secours, la simulation avance toujours', () => {
    let fail = true;
    const canvas = document.createElement('canvas');
    canvas.getContext = (() => strictContext(calls, { failFillRect: () => fail })) as never;
    document.body.append(canvas);
    const incidents: GameIncident[] = [];
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const game = createGame({
      canvas, config: { seed: 4, rulesVersion: 3 }, onEnd: () => {}, sound: false,
      onIncident: (i) => incidents.push(i),
    });
    const tick0 = game.inspect().sim.tick;
    for (let k = 0; k < 30; k++) step(16);
    fail = false;
    for (let k = 0; k < 10; k++) step(16);
    expect(game.inspect().sim.tick).toBeGreaterThan(tick0 + 30);
    expect(frames.size).toBe(1); // la boucle se reprogramme toujours
    expect(incidents.map((i) => `${i.kind}:${i.layer}`)).toContain('rendu:image');
    expect(game.inspect().renderer.safeMode).toBe(true);
    expect(errors).toHaveBeenCalled(); // jamais avalée en silence
    game.destroy();
    canvas.remove();
  });

  it('un blocage de plus de 1,5 s, onglet visible, est signalé avec sa durée', () => {
    const canvas = document.createElement('canvas');
    canvas.getContext = (() => strictContext(calls)) as never;
    document.body.append(canvas);
    const incidents: GameIncident[] = [];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const game = createGame({ canvas, config: { seed: 4, rulesVersion: 3 }, onEnd: () => {}, sound: false, onIncident: (i) => incidents.push(i) });
    step(16);
    step(16);
    step(2400);
    const stall = incidents.find((i) => i.kind === 'blocage');
    expect(stall?.ms).toBe(2400);
    game.destroy();
    canvas.remove();
  });
});
