/**
 * Page de test navigateur : expose window.__flk pour piloter et inspecter le jeu.
 * Compte les écouteurs ajoutés/retirés sur window, document et le canvas pour
 * détecter les fuites après destroy().
 */
import { verifyRunResult, type RunResult } from '../../../src/game/core';
import { createGame } from '../../../src/game/render/mount';
import { Renderer } from '../../../src/game/render/renderer';
import { getTheme } from '../../../src/game/render/themes';

const live = new Map<string, number>();
const keyOf = (t: EventTarget, type: string) =>
  `${t === window ? 'window' : t === document ? 'document' : t instanceof HTMLCanvasElement ? 'canvas' : 'other'}:${type}`;
const add = EventTarget.prototype.addEventListener;
const remove = EventTarget.prototype.removeEventListener;
const seen = new WeakMap<object, Set<string>>();
EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, l: any, o?: any) {
  if (l) {
    const capture = typeof o === 'boolean' ? o : !!o?.capture;
    const id = `${keyOf(this, type)}:${capture}`;
    const set = seen.get(l) ?? new Set();
    if (!set.has(id)) { set.add(id); seen.set(l, set); live.set(keyOf(this, type), (live.get(keyOf(this, type)) ?? 0) + 1); }
  }
  return add.call(this, type, l, o);
};
EventTarget.prototype.removeEventListener = function (this: EventTarget, type: string, l: any, o?: any) {
  if (l) {
    const capture = typeof o === 'boolean' ? o : !!o?.capture;
    const id = `${keyOf(this, type)}:${capture}`;
    const set = seen.get(l);
    if (set?.delete(id)) live.set(keyOf(this, type), (live.get(keyOf(this, type)) ?? 1) - 1);
  }
  return remove.call(this, type, l, o);
};
let rafLive = 0;
const raf = window.requestAnimationFrame.bind(window);
const caf = window.cancelAnimationFrame.bind(window);
const pendingRaf = new Set<number>();
window.requestAnimationFrame = (cb) => {
  const id = raf((t) => { pendingRaf.delete(id); cb(t); });
  pendingRaf.add(id);
  return id;
};
window.cancelAnimationFrame = (id) => { pendingRaf.delete(id); caf(id); };
void rafLive;

type Game = ReturnType<typeof createGame>;
const canvas = document.getElementById('game') as HTMLCanvasElement;
let game: Game | null = null;
const ends: RunResult[] = [];
const gameEvents: unknown[] = [];
const drawMs: number[] = [];
let heldAudio: AudioContext | null = null;

function snapshot() {
  if (!game) return null;
  const i = game.inspect();
  return {
    tick: i.sim.tick, score: i.sim.score, status: i.sim.status, frames: i.frames, pause: i.pause,
    debris: i.renderer.debrisCount, sparks: i.renderer.sparkCount, backing: i.renderer.backingSize,
    audio: i.sfx.context?.state ?? 'none', destroyed: i.destroyed, endReported: i.endReported,
    inputTicks: [...i.sim.inputTicks], perfectCount: i.sim.perfectCount, reducedMotion: i.renderer.reducedMotion,
    moving: i.sim.moving, base: i.sim.base, speed: i.sim.speed, direction: i.sim.direction,
    decor: i.renderer.decorCount, gradients: i.renderer.gradientCacheSize, theme: i.renderer.themeName,
  };
}

const api = {
  mount(opts: { seed?: number; sound?: boolean; reducedMotion?: boolean; theme?: string; voyage?: boolean } = {}) {
    game?.destroy();
    const options: Parameters<typeof createGame>[0] = {
      canvas, config: { seed: opts.seed ?? 1, rulesVersion: 1 }, onEnd: (r) => ends.push(r), onEvent: (e) => gameEvents.push(e),
    };
    if (opts.sound !== undefined) options.sound = opts.sound;
    if (opts.reducedMotion !== undefined) options.reducedMotion = opts.reducedMotion;
    if (opts.theme !== undefined) options.theme = opts.theme as NonNullable<typeof options.theme>;
    if (opts.voyage) options.voyage = true;
    game = createGame(options);
    const r = game.inspect().renderer;
    const draw = r.draw.bind(r);
    r.draw = (v, n) => { const t0 = performance.now(); draw(v, n); drawMs.push(performance.now() - t0); };
  },
  pause: () => game?.pause(),
  resume: () => game?.resume(),
  destroy: () => game?.destroy(),
  state: snapshot,
  events: () => gameEvents,
  /** Monte sur un canvas dont getContext renvoie null, et renvoie l'erreur levée. */
  mountWithoutContext() {
    const c = document.createElement('canvas');
    c.getContext = (() => null) as typeof c.getContext;
    document.body.append(c);
    try { createGame({ canvas: c, config: { seed: 1, rulesVersion: 1 }, onEnd: () => {} }); return null; }
    catch (e) { return String(e); } finally { c.remove(); }
  },
  ends: () => ends.map((e) => ({ ...e, verified: verifyRunResult(e).ok })),
  listeners: () => Object.fromEntries([...live].filter(([, n]) => n !== 0)),
  pendingRaf: () => pendingRaf.size,
  drawStats: () => {
    const s = [...drawMs].sort((a, b) => a - b);
    return { n: s.length, median: s[Math.floor(s.length / 2)] ?? 0, p95: s[Math.floor(s.length * 0.95)] ?? 0 };
  },
  resetDrawStats: () => { drawMs.length = 0; },
  /**
   * Dessine deux fois la même scène fixe (reduced-motion, sans bloc mobile) : avec le bloc
   * de l'étage 1, puis avec ce bloc réduit à une largeur nulle (même hauteur, même ciel, même
   * décor). Renvoie les colonnes, sur toute la hauteur du bloc, où les deux images diffèrent.
   * Toute différence hors de [90, 240[ signifie que le bloc a débordé de sa largeur logique.
   */
  reliefExtent(theme: string) {
    const render = (topWidth: number) => {
      const c = document.createElement('canvas');
      c.style.cssText = 'position:fixed;left:0;top:0;width:360px;height:640px';
      document.body.append(c);
      const r = new Renderer(c, true, getTheme(theme));
      r.resize(360, 640, 1);
      const stack = [{ left: 60_000, width: 240_000 }, { left: 90_000, width: topWidth }];
      r.draw({ stack, moving: null, score: 1, perfectStreak: 0, pause: 'none' }, 16);
      // Étage 1 : bande de y entre sol − 60 et sol − 30 (1 px = 1 unité ici).
      const groundY = Math.round(640 * 0.86);
      const data = c.getContext('2d')!.getImageData(0, groundY - 60, 360, 30).data;
      c.remove();
      return data;
    };
    const a = render(150_000);
    const b = render(0);
    const cols = new Set<number>();
    for (let i = 0; i < a.length; i += 4) {
      if (Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!) > 6) cols.add((i / 4) % 360);
    }
    const sorted = [...cols].sort((x, y) => x - y);
    return { lo: sorted[0] ?? -1, hi: sorted[sorted.length - 1] ?? -1, count: sorted.length };
  },
  /** Garde une référence au contexte audio pour vérifier sa fermeture après destroy. */
  holdAudio() { heldAudio = game?.inspect().sfx.context ?? null; return heldAudio?.state ?? 'none'; },
  heldAudioState: () => heldAudio?.state ?? 'none',
  touchAction: () => canvas.style.touchAction,
  /** Joueur automatique qui rétrécit la base au maximum puis rate dès que possible. */
  autoplayToMiss() {
    return new Promise<void>((resolve) => {
      const loop = () => {
        const i = game?.inspect();
        if (!i || i.sim.status === 'ended') return resolve();
        const s = i.sim;
        const w = s.base.width;
        const max = 360000 - w;
        let next = s.moving.left + s.direction * s.speed;
        if (next > max) next = 2 * max - next; else if (next < 0) next = -next;
        const canMiss = Math.max(s.base.left, max - s.base.left) >= w;
        const off = Math.abs(next - s.base.left);
        const nearEdge = s.direction === 1 ? next + 6 * s.speed > max : next - 6 * s.speed < 0;
        if (canMiss ? off >= w : nearEdge) {
          canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true, button: 0 }));
        }
        requestAnimationFrame(loop);
      };
      loop();
    });
  },
  /** Joueur automatique : appuie (événement pointeur synthétique) quand l'écart prévu est ≤ tol. */
  autoplay(placements: number, tol: number) {
    const target = (game!.inspect().sim.score) + placements;
    return new Promise<void>((resolve) => {
      const loop = () => {
        const i = game?.inspect();
        if (!i || i.sim.status === 'ended' || i.sim.score >= target) return resolve();
        const s = i.sim;
        const lead = s.moving.left + s.direction * s.speed * 2; // ~2 ticks d'avance
        if (Math.abs(lead - s.base.left) <= tol) {
          canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true, button: 0 }));
        }
        requestAnimationFrame(loop);
      };
      loop();
    });
  },
};
(window as unknown as { __flk: typeof api }).__flk = api;
