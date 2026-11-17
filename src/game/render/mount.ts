import {
  advance,
  BONUS_FLOORS,
  COUNTDOWN_TICKS,
  GAUGE_MAX,
  Simulation,
  SimulationV2,
  START_WIDTH,
  TICK_RATE,
  type BonusId,
  type RunConfig as RunConfigV1,
  type RunConfigV2,
  type RunResult as RunResultV1,
  type RunResultV2,
  type StepEvent,
  type StepEventV2,
} from '../core';
import { FixedStepDriver } from '../input/fixed-step';
import { attachInput } from '../input/input';
import { Sfx } from './audio';
import { Renderer } from './renderer';
import { DEFAULT_SKIN, isDrawSkinId, isSkinId, type DrawSkinId, type SkinId } from './blocks';
import { DEFAULT_THEME, getTheme, isThemeId, VOYAGE, type ThemeId } from './themes';

/** Univers et apparence de blocs choisis par le shell (V2). Purement visuels. */
export type Appearance = { theme: ThemeId; skin: SkinId };
/**
 * V3 (F8b) : apparence avec n'importe quelle matière dessinable (V2 + V3). Accepté en entrée
 * par `mountGame` et `renderAppearancePreview` ; `Appearance` (V2) en reste un sous-type.
 */
export type AnyAppearance = { theme: ThemeId; skin: DrawSkinId };

/**
 * Apparence valide à partir d'une valeur quelconque (sauvegarde obsolète, URL…) :
 * identifiant inconnu → valeur par défaut (Confiserie, Gomme), sans erreur.
 */
export function resolveAppearance(raw: unknown): Appearance {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    theme: isThemeId(r.theme) ? r.theme : DEFAULT_THEME,
    skin: isSkinId(r.skin) ? r.skin : DEFAULT_SKIN,
  };
}

/** Comme `resolveAppearance`, en acceptant aussi les huit matières V3. */
export function resolveAnyAppearance(raw: unknown): AnyAppearance {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return { theme: resolveAppearance(r).theme, skin: isDrawSkinId(r.skin) ? r.skin : DEFAULT_SKIN };
}

/** Configuration de partie : rulesVersion 1 (anciens défis) ou 2 (V3 : bonus, points, reprise). */
export type RunConfig = RunConfigV1 | RunConfigV2;
/** Résultat final, union discriminée par `rulesVersion`. En v2, `score` = points, `height` = étages. */
export type RunResult = RunResultV1 | RunResultV2;

export type GameHandle = {
  pause(): void;
  resume(): void;
  destroy(): void;
  /**
   * V3 (F7) : accepte la reprise proposée par `continue-offer`. À n'appeler qu'après une
   * autorisation réelle (vie possédée, vidéo confirmée) : le moteur ne valide ni pub ni paiement.
   * Renvoie false sans effet hors attente de décision (double appel, partie finie, v1,
   * `allowContinue` absent). Optionnel dans le type pour les doubles de test du shell.
   */
  continueRun?(): boolean;
  /** V3 (F7) : refuse la reprise ; fin normale, `onEnd` une seule fois. Sans effet sinon. */
  declineContinue?(): void;
};

/** Événement de partie pour le shell (mesure first_placement, annonces). Aucune règle à recopier. */
export type GameEvent =
  /**
   * `points`, `score` et `height` sont toujours fournis par `mountGame` (en v1 : 1 point par étage,
   * score = hauteur). Optionnels dans le type pour rester additifs envers les doubles de test.
   */
  | { type: 'placement'; tick: number; floor: number; perfect: boolean; perfectStreak: number; points?: number; score?: number; height?: number }
  | { type: 'miss'; tick: number; floor: number }
  /** v2 : jauge après une pose qui la change (ou remise à zéro par une reprise). */
  | { type: 'gauge'; value: number; max: number; next: BonusId }
  | { type: 'bonus-start'; bonus: BonusId; floors: number }
  | { type: 'bonus-end'; bonus: BonusId }
  /** v2, `allowContinue` : la partie attend `continueRun()` ou `declineContinue()` ; pas d'onEnd. */
  | { type: 'continue-offer'; tick: number }
  | { type: 'continue-start'; countdownTicks: number };

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
  /**
   * V2 (F4) : univers et apparence des blocs. Validés à la création : un identifiant inconnu
   * retombe sur Confiserie / Gomme. Aucun effet sur les règles, le rejeu ou le score.
   */
  appearance?: Appearance;
  /**
   * V3 (F7) : proposer la reprise au premier raté (rulesVersion 2 seulement). Défaut false :
   * le raté termine normalement (Tour du jour, défis, classées). Ignoré en v1.
   */
  allowContinue?: boolean;
};

/**
 * Options internes (F3), non exportées par `src/game/index.ts` : utilisées par la démo et
 * les tests. L'option publique `appearance` sera ajoutée en F4 après accord avec Alexis.
 */
export type InternalMountOptions = MountOptions & {
  /** Raccourci interne (démo, tests) ; `appearance.theme` prime s'il est fourni. */
  theme?: ThemeId;
  /** Variante « la tour voyage » (avis FLK V2) : les univers se succèdent avec la hauteur. */
  voyage?: boolean;
  /** Interne (démo, harnais) : apparence V3 pas encore exposée au shell ; prime sur appearance.skin. */
  drawSkin?: DrawSkinId;
};

/** Délai entre le raté et onEnd, pour voir le bloc tomber (ms de rendu, gelé en pause). */
export const END_DELAY_MS = 650;

/** Vue d'inspection pour les tests de navigateur ; ne fait pas partie de l'API publique. */
export interface GameInspector {
  readonly sim: Simulation | SimulationV2;
  readonly renderer: Renderer;
  readonly sfx: Sfx;
  readonly frames: number;
  readonly pause: 'none' | 'shell' | 'hidden';
  readonly destroyed: boolean;
  readonly endReported: boolean;
}

export function createGame(options: InternalMountOptions): Required<GameHandle> & { inspect(): GameInspector } {
  const { canvas, config, onEnd } = options;
  // Échecs de montage, synchrones et sans effet de bord (rien n'est encore attaché) :
  // RangeError si seed ou rulesVersion invalide, Error si le contexte Canvas 2D est indisponible.
  const v2 = config.rulesVersion === 2;
  const sim: Simulation | SimulationV2 = v2 ? new SimulationV2(config) : new Simulation(config as RunConfigV1);
  const allowContinue = v2 && options.allowContinue === true;
  const doc = canvas.ownerDocument;
  const win = doc.defaultView ?? window;
  const media = typeof win.matchMedia === 'function' ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const appearance = resolveAnyAppearance(options.appearance ?? { theme: options.theme });
  const theme = options.voyage ? VOYAGE : getTheme(appearance.theme);
  const renderer = new Renderer(canvas, options.reducedMotion ?? media?.matches ?? false, theme, isDrawSkinId(options.drawSkin) ? options.drawSkin : appearance.skin);
  const sfx = new Sfx(options.sound ?? true, theme.audio);

  let destroyed = false;
  let pauseReason: 'none' | 'shell' | 'hidden' = 'none';
  let raf: number | null = null;
  let frames = 0;
  let endElapsed = 0;
  let endReported = false;
  let lastFrame: number | null = null;
  let lastCountdown = 0;

  const notify = (event: GameEvent) => {
    if (!options.onEvent) return;
    try {
      options.onEvent(event);
    } catch (error) {
      // Une erreur du shell ne doit pas casser la boucle de jeu ; elle reste visible.
      console.error('[game] onEvent a levé une erreur', error);
    }
  };
  const nextBonus = () => (sim instanceof SimulationV2 ? sim.nextBonus : 'ralenti');
  const onEvent = (e: StepEvent | StepEventV2) => {
    if (renderer.onEvent(e)) sfx.milestone();
    if (e.kind === 'resumed') {
      sfx.countdown(0);
      return;
    }
    if (e.kind === 'placed') {
      const ev = e as StepEventV2 & { kind: 'placed' };
      const isV2 = 'points' in e;
      notify({
        type: 'placement', tick: e.tick, floor: e.floor, perfect: e.perfect, perfectStreak: e.perfectStreak,
        points: isV2 ? ev.points : 1, score: isV2 ? ev.score : e.floor, height: isV2 ? ev.height : e.floor,
      });
      if (e.perfect) sfx.perfect(e.perfectStreak);
      else sfx.place(e.placed.width / START_WIDTH);
      if (isV2) {
        if (ev.bonusEnded) {
          notify({ type: 'bonus-end', bonus: ev.bonusEnded });
          sfx.bonusEnd();
        }
        if (ev.bonusStarted) {
          notify({ type: 'bonus-start', bonus: ev.bonusStarted, floors: BONUS_FLOORS });
          sfx.bonusStart(ev.bonusStarted);
        }
        // Jauge changée : toute pose hors bonus, et le retour à zéro en fin de bonus.
        if (ev.bonus === null || ev.bonusEnded) notify({ type: 'gauge', value: ev.gauge, max: GAUGE_MAX, next: nextBonus() });
      }
      return;
    }
    notify({ type: 'miss', tick: e.tick, floor: e.floor });
    sfx.miss();
    input.setEnabled(false); // rend l'espace au DOM (écran de résultat ou offre de reprise)
    if ('canContinue' in e && e.canContinue && sim instanceof SimulationV2) {
      // Attente de décision : seulement si l'application l'a autorisée pour cette partie.
      if (allowContinue) notify({ type: 'continue-offer', tick: e.tick });
      else sim.finish();
    }
  };
  const driver = new FixedStepDriver<StepEvent | StepEventV2>(sim, onEvent);

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
    } else if (sim.status === 'countdown') {
      moving = sim.moving; // bloc réapparu, immobile jusqu'à la fin du compte à rebours
    }
    const hud = sim instanceof SimulationV2
      ? {
          height: sim.height,
          gauge: sim.gauge,
          gaugeMax: GAUGE_MAX,
          next: sim.nextBonus,
          bonus: sim.bonus,
          bonusLeft: sim.bonusFloorsLeft,
          bonusFloors: BONUS_FLOORS,
          countdown: sim.status === 'countdown' ? Math.ceil(sim.countdownLeft / TICK_RATE) : 0,
          fallen: sim.status === 'fallen',
        }
      : undefined;
    return {
      stack: sim.stack, moving, score: sim.score, perfectStreak: sim.perfectStreak, pause: pauseReason,
      ...(hud ? { v2: hud } : {}),
    };
  };

  const ticking = () => sim.status === 'running' || sim.status === 'countdown';

  const frame = (now: number) => {
    raf = null;
    if (destroyed) return;
    frames++;
    driver.advance(now);
    const v = view();
    if (v.v2 && v.v2.countdown !== lastCountdown) {
      if (v.v2.countdown > 0) sfx.countdown(v.v2.countdown);
      lastCountdown = v.v2.countdown;
    }
    renderer.draw(v, now);
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
    // En attente de reprise, la boucle s'arrête aussi une fois la chute dessinée.
    const waitingEnd = sim.status === 'ended' && !endReported;
    if (pauseReason === 'none' && (ticking() || waitingEnd || renderer.animating)) schedule();
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
      // Partie finie ou en attente de décision : rien à protéger (aucun tick ne passe),
      // on reprend l'animation pour que onEnd arrive et que l'offre reste lisible.
      if (sim.status === 'ended' || sim.status === 'fallen') resumeInternal();
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
    continueRun() {
      if (destroyed || !allowContinue || !(sim instanceof SimulationV2)) return false;
      if (!sim.continueRun()) return false;
      renderer.onContinue();
      input.setEnabled(true); // les appuis du compte à rebours sont refusés par le driver
      lastCountdown = 0;
      notify({ type: 'continue-start', countdownTicks: COUNTDOWN_TICKS });
      notify({ type: 'gauge', value: 0, max: GAUGE_MAX, next: sim.nextBonus });
      if (pauseReason === 'none') {
        lastFrame = null;
        driver.resume(win.performance.now());
        schedule();
      }
      return true;
    },
    declineContinue() {
      if (destroyed || !(sim instanceof SimulationV2) || !sim.finish()) return;
      // Partie finie : rien à protéger, l'animation de fin reprend pour que onEnd arrive.
      if (pauseReason === 'shell') pauseReason = 'none';
      lastFrame = null;
      schedule();
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
  return {
    pause: game.pause,
    resume: game.resume,
    destroy: game.destroy,
    continueRun: game.continueRun,
    declineContinue: game.declineContinue,
  };
}
