import {
  advance,
  BONUS_FLOORS,
  BOOST_FLOORS,
  COUNTDOWN_TICKS,
  GAUGE_MAX,
  SAVE_TICKS,
  Simulation,
  SimulationV2,
  SimulationV3,
  START_WIDTH,
  TICK_RATE,
  type BonusId,
  type BoostId,
  type RunConfig as RunConfigV1,
  type RunConfigV2,
  type RunConfigV3,
  type RunResult as RunResultV1,
  type RunResultV2,
  type RunResultV3,
  type StepEvent,
  type StepEventV2,
  type StepEventV3,
} from '../core';
import { FixedStepDriver } from '../input/fixed-step';
import { attachInput } from '../input/input';
import { Sfx } from './audio';
import { Renderer, type HudV2 } from './renderer';
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

/**
 * Configuration de partie : rulesVersion 1 (anciens défis), 2 (V3 : bonus, points, reprise) ou
 * 3 (V5 : Ralenti, Aimant, Bouclier, Fièvre).
 */
export type RunConfig = RunConfigV1 | RunConfigV2 | RunConfigV3;
/** Résultat final, union discriminée par `rulesVersion`. En v2/v3, `score` = points, `height` = étages. */
export type RunResult = RunResultV1 | RunResultV2 | RunResultV3;
/** Bonus v2 (Ralenti, ×2) et boosts v3 (Ralenti, Aimant, Bouclier). */
export type AnyBoostId = BonusId | BoostId;

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
  /**
   * V4 : son activé ou coupé et volume (0 à 1), appliqués en cours de partie (menu Pause).
   * Optionnel dans le type pour les doubles de test du shell.
   */
  setAudio?(sound: boolean, volume: number): void;
  /** V3 (F7) : refuse la reprise ; fin normale, `onEnd` une seule fois. Sans effet sinon. */
  declineContinue?(): void;
};

/** Événement de partie pour le shell (mesure first_placement, annonces). Aucune règle à recopier. */
export type GameEvent =
  /**
   * `points`, `score` et `height` sont toujours fournis par `mountGame` (en v1 : 1 point par étage,
   * score = hauteur). Optionnels dans le type pour rester additifs envers les doubles de test.
   */
  | {
      type: 'placement'; tick: number; floor: number; perfect: boolean; perfectStreak: number;
      points?: number; score?: number; height?: number;
      /** v3 : parfait obtenu grâce à l'Aimant (le bloc s'est collé). */
      snapped?: boolean;
      /** v3 : pose en Fièvre (points doublés). */
      fever?: boolean;
    }
  | { type: 'miss'; tick: number; floor: number }
  /** v2/v3 : jauge après une pose qui la change (ou remise à zéro par une reprise). */
  | { type: 'gauge'; value: number; max: number; next: AnyBoostId }
  | { type: 'bonus-start'; bonus: AnyBoostId; floors: number }
  | { type: 'bonus-end'; bonus: AnyBoostId }
  /** v3 : Fièvre (5 parfaits d'affilée) et sa fin au premier non-parfait ou au raté. */
  | { type: 'fever-start' }
  | { type: 'fever-end' }
  /** v3 : raté rattrapé par le Bouclier ; l'étage repart après `recoverTicks`. */
  | { type: 'saved'; tick: number; floor: number; recoverTicks: number }
  /** v2/v3, `allowContinue` : la partie attend `continueRun()` ou `declineContinue()` ; pas d'onEnd. */
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
  /** V4 : volume des sons, de 0 à 1 (défaut 1). */
  volume?: number;
  /**
   * V4 : effets visuels. `light` (mode Fluide) plafonne la résolution interne et réduit
   * particules et décor pour les téléphones modestes. Aucun effet sur les règles ni le rejeu.
   */
  effects?: 'full' | 'light';
  /**
   * V2 (F4) : univers et apparence des blocs. Validés à la création : un identifiant inconnu
   * retombe sur Confiserie / Gomme. Aucun effet sur les règles, le rejeu ou le score.
   */
  appearance?: Appearance;
  /**
   * V3 (F7) : proposer la reprise au premier raté (rulesVersion 2 et 3). Défaut false :
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

/**
 * Délai entre le raté et onEnd : on voit le bloc tomber et la caméra reculer pour montrer toute
 * la tour (ms de rendu, gelé en pause). V5 : 650 → 1000 ms.
 */
export const END_DELAY_MS = 1000;

/** Vue d'inspection pour les tests de navigateur ; ne fait pas partie de l'API publique. */
export interface GameInspector {
  readonly sim: Simulation | SimulationV2 | SimulationV3;
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
  const sim: Simulation | SimulationV2 | SimulationV3 = config.rulesVersion === 3
    ? new SimulationV3(config)
    : config.rulesVersion === 2 ? new SimulationV2(config) : new Simulation(config as RunConfigV1);
  /** Simulation avec reprise (v2, v3), sinon null (v1). */
  const resumable = sim instanceof SimulationV2 || sim instanceof SimulationV3 ? sim : null;
  const allowContinue = resumable !== null && options.allowContinue === true;
  const doc = canvas.ownerDocument;
  const win = doc.defaultView ?? window;
  const media = typeof win.matchMedia === 'function' ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const appearance = resolveAnyAppearance(options.appearance ?? { theme: options.theme });
  const theme = options.voyage ? VOYAGE : getTheme(appearance.theme);
  const renderer = new Renderer(canvas, options.reducedMotion ?? media?.matches ?? false, theme, isDrawSkinId(options.drawSkin) ? options.drawSkin : appearance.skin);
  const sfx = new Sfx(options.sound ?? true, theme.audio, options.volume ?? 1);
  renderer.quality = options.effects === 'light' ? 'light' : 'full';
  // Qualité adaptative (V6) : résolution interne réduite dès qu'elle se déclenche.
  renderer.onAutoLight = () => measure();
  renderer.onGag = (kind) => sfx.gag(kind);

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
  const nextBonus = (): AnyBoostId =>
    sim instanceof SimulationV3 ? sim.nextBoost : sim instanceof SimulationV2 ? sim.nextBonus : 'ralenti';
  const onEvent = (e: StepEvent | StepEventV2 | StepEventV3) => {
    if (renderer.onEvent(e)) sfx.milestone();
    if (e.kind === 'resumed') {
      if ('cause' in e && e.cause === 'save') sfx.rearm();
      else sfx.countdown(0);
      return;
    }
    if (e.kind === 'saved') {
      // Bouclier : la tour reste ; les appuis sont ignorés par la simulation jusqu'à la reprise.
      notify({ type: 'saved', tick: e.tick, floor: e.floor, recoverTicks: SAVE_TICKS });
      sfx.shieldSave();
      if (e.fever) notify({ type: 'fever-end' });
      return;
    }
    if (e.kind === 'placed') {
      const isV2 = 'points' in e;
      const v3 = 'boost' in e ? e : null;
      const v2 = !v3 && isV2 ? (e as Extract<StepEventV2, { kind: 'placed' }>) : null;
      notify({
        type: 'placement', tick: e.tick, floor: e.floor, perfect: e.perfect, perfectStreak: e.perfectStreak,
        points: isV2 ? (e as { points: number }).points : 1,
        score: isV2 ? (e as { score: number }).score : e.floor,
        height: isV2 ? (e as { height: number }).height : e.floor,
        ...(v3 ? { snapped: v3.snapped, fever: v3.fever } : {}),
      });
      if (v3?.snapped) sfx.snap();
      if (e.perfect) sfx.perfect(e.perfectStreak);
      else sfx.place(e.placed.width / START_WIDTH);
      const ended = v3 ? v3.boostEnded : v2?.bonusEnded ?? null;
      const started = v3 ? v3.boostStarted : v2?.bonusStarted ?? null;
      if (ended) {
        notify({ type: 'bonus-end', bonus: ended });
        sfx.bonusEnd();
      }
      if (started) {
        notify({ type: 'bonus-start', bonus: started, floors: v3 ? BOOST_FLOORS[started as BoostId] : BONUS_FLOORS });
        sfx.bonusStart(started);
      }
      if (v3?.feverEnded) {
        notify({ type: 'fever-end' });
        sfx.feverEnd();
      }
      if (v3?.feverStarted) {
        notify({ type: 'fever-start' });
        sfx.feverStart();
      }
      // Jauge changée : toute pose hors boost, et le retour à zéro en fin de boost.
      if (v3 ? v3.boost === null || v3.boostEnded : v2 ? v2.bonus === null || v2.bonusEnded : false) {
        notify({ type: 'gauge', value: (v3 ?? v2)!.gauge, max: GAUGE_MAX, next: nextBonus() });
      }
      return;
    }
    notify({ type: 'miss', tick: e.tick, floor: e.floor });
    if ('fever' in e && e.fever) notify({ type: 'fever-end' });
    sfx.miss();
    input.setEnabled(false); // rend l'espace au DOM (écran de résultat ou offre de reprise)
    if ('canContinue' in e && e.canContinue && resumable) {
      // Attente de décision : seulement si l'application l'a autorisée pour cette partie.
      if (allowContinue) notify({ type: 'continue-offer', tick: e.tick });
      else resumable.finish();
    }
  };
  const driver = new FixedStepDriver<StepEvent | StepEventV2 | StepEventV3>(sim, onEvent);

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
    const hud: HudV2 | undefined = sim instanceof SimulationV3
      ? {
          height: sim.height,
          gauge: sim.gauge,
          gaugeMax: GAUGE_MAX,
          next: sim.nextBoost,
          bonus: sim.boost,
          bonusLeft: sim.boostFloorsLeft,
          bonusFloors: BOOST_FLOORS[sim.boost ?? sim.nextBoost],
          // Le compte à rebours chiffré (3, 2, 1) n'existe que pour la reprise ; le rattrapage du
          // Bouclier (0,75 s) est montré autrement.
          countdown: sim.status === 'countdown' && sim.countdownKind === 'continue' ? Math.ceil(sim.countdownLeft / TICK_RATE) : 0,
          fallen: sim.status === 'fallen',
          rules: 3,
          fever: sim.fever,
          streak: sim.perfectStreak,
          tolerance: sim.tolerance,
          recovering: sim.status === 'countdown' && sim.countdownKind === 'save' ? sim.countdownLeft / SAVE_TICKS : 0,
        }
      : sim instanceof SimulationV2
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
      ended: sim.status === 'ended',
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
    // Arrière-plan : le son est suspendu (aucun effet sonore qui traîne), puis repris au retour.
    if (doc.visibilityState === 'hidden') sfx.suspend();
    else sfx.resume();
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
      renderer.dispose();
    },
    continueRun() {
      if (destroyed || !allowContinue || !resumable) return false;
      if (!resumable.continueRun()) return false;
      renderer.onContinue();
      input.setEnabled(true); // les appuis du compte à rebours sont refusés par le driver
      lastCountdown = 0;
      notify({ type: 'continue-start', countdownTicks: COUNTDOWN_TICKS });
      notify({ type: 'gauge', value: 0, max: GAUGE_MAX, next: nextBonus() });
      if (pauseReason === 'none') {
        lastFrame = null;
        driver.resume(win.performance.now());
        schedule();
      }
      return true;
    },
    setAudio(sound: boolean, volume: number) {
      if (destroyed) return;
      sfx.setEnabled(sound);
      sfx.setVolume(volume);
    },
    declineContinue() {
      if (destroyed || !resumable || !resumable.finish()) return;
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
    setAudio: game.setAudio,
  };
}
