import { advance, Simulation, START_WIDTH, type RunConfig, type RunResult, type StepEvent } from '../core';
import { FixedStepDriver } from '../input/fixed-step';
import { attachInput } from '../input/input';
import { Sfx } from './audio';
import { Renderer } from './renderer';
import { getTheme, VOYAGE, type ThemeId } from './themes';

export type GameHandle = {
  pause(): void;
  resume(): void;
  destroy(): void;
};

/** Événement de partie pour le shell (mesure first_placement, annonces). Aucune règle à recopier. */
export type GameEvent =
  | { type: 'placement'; tick: number; floor: number; perfect: boolean; perfectStreak: number }
  | { type: 'miss'; tick: number; floor: number };

export type MountOptions = {
  canvas: HTMLCanvasElement;
  config: RunConfig;
  onEnd(result: RunResult): void;
  /** Proposition additive (revue C0, B1) : appelé à chaque pose et au raté, pendant la boucle. */
  onEvent?(event: GameEvent): void;
  /** Proposition additive : son autorisé (défaut true). Le contexte audio n'est créé qu'au premier geste. */
  sound?: boolean;
  /** Proposition additive : force reduced-motion ; défaut = préférence système. */
  reducedMotion?: boolean;
};

/**
 * Options internes (F3), non exportées par `src/game/index.ts` : utilisées par la démo et
 * les tests. L'option publique `appearance` sera ajoutée en F4 après accord avec Alexis.
 */
export type InternalMountOptions = MountOptions & {
  theme?: ThemeId;
  /** Variante « la tour voyage » (avis FLK V2) : les univers se succèdent avec la hauteur. */
  voyage?: boolean;
};

/** Délai entre le raté et onEnd, pour voir le bloc tomber (ms de rendu, gelé en pause). */
export const END_DELAY_MS = 650;

/** Vue d'inspection pour les tests de navigateur ; ne fait pas partie de l'API publique. */
export interface GameInspector {
  readonly sim: Simulation;
  readonly renderer: Renderer;
  readonly sfx: Sfx;
  readonly frames: number;
  readonly pause: 'none' | 'shell' | 'hidden';
  readonly destroyed: boolean;
  readonly endReported: boolean;
}

export function createGame(options: InternalMountOptions): GameHandle & { inspect(): GameInspector } {
  const { canvas, config, onEnd } = options;
  // Échecs de montage, synchrones et sans effet de bord (rien n'est encore attaché) :
  // RangeError si seed ou rulesVersion invalide, Error si le contexte Canvas 2D est indisponible.
  const sim = new Simulation(config);
  const doc = canvas.ownerDocument;
  const win = doc.defaultView ?? window;
  const media = typeof win.matchMedia === 'function' ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const theme = options.voyage ? VOYAGE : getTheme(options.theme);
  const renderer = new Renderer(canvas, options.reducedMotion ?? media?.matches ?? false, theme);
  const sfx = new Sfx(options.sound ?? true, theme.audio);

  let destroyed = false;
  let pauseReason: 'none' | 'shell' | 'hidden' = 'none';
  let raf: number | null = null;
  let frames = 0;
  let endElapsed = 0;
  let endReported = false;
  let lastFrame: number | null = null;

  const notify = (event: GameEvent) => {
    if (!options.onEvent) return;
    try {
      options.onEvent(event);
    } catch (error) {
      // Une erreur du shell ne doit pas casser la boucle de jeu ; elle reste visible.
      console.error('[game] onEvent a levé une erreur', error);
    }
  };
  const onEvent = (e: StepEvent) => {
    if (renderer.onEvent(e)) sfx.milestone();
    notify(e.kind === 'placed'
      ? { type: 'placement', tick: e.tick, floor: e.floor, perfect: e.perfect, perfectStreak: e.perfectStreak }
      : { type: 'miss', tick: e.tick, floor: e.floor });
    if (e.kind === 'placed') {
      if (e.perfect) sfx.perfect(e.perfectStreak);
      else sfx.place(e.placed.width / START_WIDTH);
    } else {
      sfx.miss();
      input.setEnabled(false); // rend l'espace au DOM pour l'écran de résultat
    }
  };
  const driver = new FixedStepDriver(sim, onEvent);

  const input = attachInput(canvas, (timeStamp) => {
    sfx.unlock(); // geste utilisateur : seul endroit où l'audio démarre
    if (pauseReason === 'hidden') {
      // Toucher après retour d'onglet = reprise, jamais une pose.
      resumeInternal();
      return;
    }
    if (pauseReason !== 'none') return;
    driver.press(timeStamp);
  });

  const measure = () => {
    const rect = canvas.getBoundingClientRect();
    renderer.resize(rect.width, rect.height, win.devicePixelRatio);
  };

  const view = () => {
    let moving = null;
    if (sim.status === 'running') {
      // Interpolation d'affichage uniquement : la règle reste celle du tick.
      const a = driver.alpha(win.performance.now());
      const p = advance(sim.moving.left, sim.direction, Math.round(sim.speed * a), sim.moving.width);
      moving = { left: p.left, width: sim.moving.width };
    }
    return { stack: sim.stack, moving, score: sim.score, perfectStreak: sim.perfectStreak, pause: pauseReason };
  };

  const frame = (now: number) => {
    raf = null;
    if (destroyed) return;
    frames++;
    driver.advance(now);
    renderer.draw(view(), now);
    const dt = lastFrame === null ? 0 : Math.min(now - lastFrame, 100);
    lastFrame = now;
    if (sim.status === 'ended' && !endReported) {
      endElapsed += dt;
      if (endElapsed >= END_DELAY_MS) {
        endReported = true;
        const result = sim.result();
        if (result) onEnd(result);
        if (destroyed) return; // onEnd peut détruire le jeu
      }
    }
    // Après la fin, on s'arrête quand les effets sont terminés : pas de RAF inutile.
    if (pauseReason === 'none' && (sim.status === 'running' || !endReported || renderer.animating)) schedule();
  };

  const schedule = () => {
    if (raf === null && !destroyed) raf = win.requestAnimationFrame(frame);
  };
  const stopLoop = () => {
    if (raf !== null) win.cancelAnimationFrame(raf);
    raf = null;
  };

  const pauseInternal = (reason: 'shell' | 'hidden') => {
    if (destroyed) return;
    if (pauseReason === 'shell' && reason === 'hidden') return; // déjà en pause explicite
    pauseReason = reason;
    driver.pause();
    stopLoop();
    lastFrame = null;
    renderer.draw(view(), win.performance.now());
  };
  const resumeInternal = () => {
    if (destroyed || pauseReason === 'none') return;
    if (doc.visibilityState === 'hidden') return; // reprise sûre : jamais onglet caché
    pauseReason = 'none';
    lastFrame = null;
    driver.resume(win.performance.now());
    schedule();
  };

  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') pauseInternal('hidden');
    else if (pauseReason === 'hidden') {
      // Partie déjà finie : rien à protéger, on reprend l'animation de fin pour que onEnd arrive.
      if (sim.status === 'ended') resumeInternal();
      else renderer.draw(view(), win.performance.now());
    }
  };
  const onResize = () => {
    measure();
    if (raf === null && !destroyed) renderer.draw(view(), win.performance.now());
  };
  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('resize', onResize);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null;
  observer?.observe(canvas);
  const onMotion = (e: MediaQueryListEvent) => {
    if (options.reducedMotion === undefined) renderer.reducedMotion = e.matches;
  };
  media?.addEventListener('change', onMotion);

  measure();
  if (doc.visibilityState === 'hidden') {
    pauseReason = 'hidden';
    renderer.draw(view(), win.performance.now());
  } else {
    driver.resume(win.performance.now());
    schedule();
  }

  return {
    pause: () => pauseInternal('shell'),
    resume: () => resumeInternal(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      driver.pause();
      input.detach();
      doc.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('resize', onResize);
      observer?.disconnect();
      media?.removeEventListener('change', onMotion);
      sfx.close();
    },
    inspect: () => ({
      sim, renderer, sfx, frames, pause: pauseReason, destroyed, endReported,
    }),
  };
}

/**
 * Monte le jeu sur un canvas. Ne touche ni stockage, ni réseau, ni menus.
 * Lève une erreur synchrone si la config est invalide ou si Canvas 2D est indisponible.
 * onEnd est appelé une seule fois, END_DELAY_MS de jeu visible après le raté ;
 * il ne l'est pas si destroy() survient avant.
 */
export function mountGame(options: MountOptions): GameHandle {
  const game = createGame(options);
  return { pause: game.pause, resume: game.resume, destroy: game.destroy };
}
