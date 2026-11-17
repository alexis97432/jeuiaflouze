/**
 * Shell (V4) : accueil → jeu → résultat → rejouer / défier, en DOM accessible.
 * Interface V4 : composants `ui/`, préférences (thème, son, vibrations, animations, effets),
 * fenêtres accessibles, bouton retour du téléphone. Voir docs/V4.md.
 * Le shell ne connaît pas les règles : il monte le jeu et lit `RunResult`.
 * Stockage, partage et URL sont injectés pour rester testables et tolérants aux pannes.
 */
import {
  buildChallengeUrl,
  INVALID_MESSAGES,
  parseChallenge,
  type Challenge,
  type InvalidReason,
} from './challenge-url';
import { PLAY_RULES_VERSION, RULES_VERSION, type GameEvent, type GameHandle } from './game-contract';
import type { ShellPrefs, StartGame } from './game-loader';
import { previewOrSwatch, renderCollection, type PreviewFn } from './collection-view';
import { BONUS_NAMES, continuesOf, continueTicksOf, heightOf, pointsOf, type AnyRunResult } from './run-result';
import { AD_MESSAGES, createRewardGate, noAds, type RewardedAdProvider } from '../platform/ads/rewarded';
import { buyLife, LIFE_PRICE, livesOf, MAX_LIVES, returnLife, useLife } from './lives';
import { claimSeasonTier, nextTier, SEASON_1, seasonPhase, seasonState, tierStatus, addSeasonStars, type Season, type SeasonReward, type Track } from './season';
import { COIN_SHOP, itemState, purchaseWithCoins, sellableItems, type ShopItem } from './shop';
import { dayInWords, isAnySkinId, renderAppearancePreview, type AnyAppearance } from '../game';
import {
  applyRunEconomy,
  CALENDAR_REWARDS,
  calendarStatus,
  claimCalendar,
  LEVEL_TITLES,
  levelInfo,
  readProgressDoc,
  type ProgressDoc,
} from './economy';
import { el, floors } from './dom';
import {
  activeObjectives,
  BADGE_IDS,
  earnedBadges,
  rewardLabel,
  selectAppearance,
  SKIN_IDS,
  OBTAINABLE_V3_SKINS,
  THEME_IDS,
  unlockedSkins,
  unlockedThemes,
  type Objective,
  type ObjectiveId,
} from './progression';
import { createRunTracker, type RunTracker } from './run-tracker';
import { dailySeed, nextDailyChange, utcDateKey } from '../platform/daily';
import type { Mode, Tracker } from '../platform/metrics';
import { downloadFile, type ShareData, type ShareOutcome } from '../platform/share';
import { sanitizePrefs, type LocalStore, type MetaStore, type Prefs } from '../platform/storage';
import { applyPrefs, watchSystemPrefs } from './prefs';
import { browserHaptics, createUiSound, HAPTIC_PATTERNS, type HapticKind, type Haptics, type UiSound, type UiSoundKind } from './feedback';
import {
  cardTitle,
  confetti,
  dockButton,
  iconOnlyButton,
  openSheet,
  progressBar,
  rangeInput,
  segmented,
  showToast,
  switchButton,
  uiButton,
  type SheetHandle,
} from './ui/components';
import { icon, type IconName } from './ui/icons';
import {
  cleanPseudo,
  isPlayerIdentity,
  unavailableLeaderboard,
  type BoardEntry,
  type BoardKind,
  type LeaderboardService,
  type PlayerIdentity,
  type RankTicket,
  type ServiceError,
} from '../platform/services/leaderboard';

export type Screen = 'home' | 'game' | 'result' | 'collection' | 'rewards' | 'settings' | 'shop' | 'leaderboard' | 'season';

/**
 * Délai pendant lequel les boutons du résultat ignorent les activations : un joueur qui tape
 * ou appuie sur Espace au moment du raté ne doit pas relancer ou partager par accident.
 */
export const RESULT_INPUT_GUARD_MS = 500;

export type ShellOptions = {
  root: HTMLElement;
  startGame: StartGame;
  tracker: Tracker;
  store: LocalStore;
  /** Progression V2 et records du jour (`poc:meta:v1:`). */
  meta: MetaStore;
  /** Date courante (Tour du jour) ; injectable pour les tests. */
  today?: () => Date;
  /** URL complète de la page au démarrage. */
  url: string;
  /** Remplace l'URL affichée sans recharger (history.replaceState). */
  replaceUrl: (url: string) => void;
  share: (data: ShareData) => Promise<ShareOutcome>;
  newSeed: () => number;
  newRunId: () => string;
  doc?: Document;
  /** Horloge monotone (ms) ; injectable pour les tests. */
  now?: () => number;
  /**
   * Verrou entre onglets (Web Locks). Par défaut `navigator.locks` ; `null` force le repli
   * sans verrou (navigateur sans Web Locks). Injectable pour les tests.
   */
  locks?: Pick<LockManager, 'request'> | null;
  /** Boutique en pièces : catalogue et test « le moteur sait dessiner ». Injectables (tests). */
  shop?: { catalog: readonly ShopItem[]; isAvailable: (id: string) => boolean; preview?: PreviewFn };
  /** Service de classement (V3-A3). Absent : « Indisponible », le jeu reste entier. */
  leaderboard?: LeaderboardService;
  /** Identifiant pseudonyme de l'appareil pour le classement (32 hex). */
  newPlayerId?: () => string;
  /** V4 : vibrations (défaut : `navigator.vibrate` s'il existe). */
  haptics?: Haptics;
  /** V4 : petits sons d'interface (défaut : Web Audio). */
  uiSound?: UiSound;
  /**
   * V4 : historique du navigateur, pour que le bouton retour du téléphone ramène à l'accueil
   * (et mette en pause pendant une partie). Absent : désactivé (tests).
   */
  history?: Pick<History, 'pushState' | 'back'> | null;
  /** Saison en cours (V3-A5) ; injectable pour les tests. */
  season?: Season;
  /**
   * Reprise après une chute (V3-A6, F7) : vidéo récompensée et vies. Sans régie ni vie,
   * aucune offre n'est faite (la partie se termine comme avant). Jamais en Tour du jour ni défi.
   */
  revive?: { ads?: RewardedAdProvider; lives?: LivesProvider };
  /**
   * Image de résultat (F9, `renderResultCard`, convertie en PNG par main.ts). Absente ou null :
   * partage du lien seul, sans bouton d'image.
   */
  resultImage?: (result: AnyRunResult, mode: Mode, day: string | null, appearance?: AnyAppearance) => Promise<File | null>;
  /** Enregistre un fichier (téléchargement) ; injectable pour les tests. */
  saveFile?: (file: File) => boolean;
};

/** Vies de reprise possédées (achats vérifiés par le serveur). Par défaut : aucune. */
export type LivesProvider = {
  count(): number;
  /** Consomme une vie pour `requestId` (idempotent côté serveur). */
  consume(requestId: string): Promise<'ok' | 'none' | 'error'>;
  /** Rend la vie consommée par `requestId` si la reprise n'a pas eu lieu (idempotent). */
  refund(requestId: string): Promise<void>;
};

/** Nom du verrou Web Locks qui sérialise toute écriture de progression entre onglets. */
export const PROGRESS_LOCK = 'poc:meta:v1:progress';

export type Shell = {
  readonly screen: Screen;
  destroy(): void;
};

type RunState = {
  runId: string;
  seed: number;
  mode: Mode;
  challenge: Challenge | null;
  /** Date UTC figée au lancement, seulement pour la Tour du jour. */
  day: string | null;
  /** Objectifs actifs au lancement : seuls ceux-ci peuvent être validés par la partie. */
  activeAtStart: ObjectiveId[];
  events: RunTracker;
  handle: GameHandle | null;
  /** Ticket du serveur de classement : seule une partie lancée avec un ticket peut être classée. */
  ticket: RankTicket | null;
  /** Moyen de la reprise acceptée (« vie », « vidéo »), sinon null. */
  revivedWith: string | null;
  /** Pause de l'écran de jeu (onglet caché, retour du téléphone) ; null hors partie. */
  controls: RunControls | null;
};

type RunControls = {
  hidden(): void;
  visible(): void;
  back(): void;
  setFallen(value: boolean): void;
};

const BOARD_LABELS: Record<BoardKind, string> = { global: 'Monde', weekly: 'Semaine', daily: 'Aujourd’hui' };
const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`);
const SERVICE_MESSAGES: Record<ServiceError, string> = {
  unavailable: 'Classement en ligne indisponible pour l’instant.',
  offline: 'Pas de connexion. Vérifie Internet, puis réessaie.',
  busy: 'Beaucoup de monde en ce moment. Réessaie dans une minute.',
  rejected: 'Le classement a refusé la demande.',
  server: 'Le classement ne répond pas. Réessaie plus tard.',
};
/** Marge avant expiration pour qu'une partie lancée avec ce ticket ait le temps de finir. */
const TICKET_MARGIN_MS = 15 * 60_000;

function defaultPlayerId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Heure locale du prochain changement de tour (minuit UTC), calculée par le navigateur. */
const formatLocalTime = (at: Date) =>
  at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function createShell(options: ShellOptions): Shell {
  const doc = options.doc ?? document;
  const now = options.now ?? (() => performance.now());
  let guardTimer: ReturnType<typeof setTimeout> | undefined;
  const { root, tracker, store, meta } = options;
  const today = options.today ?? (() => new Date());
  // Une seule lecture (document v2 migré) et toujours le document complet en écriture :
  // XP, pièces et calendrier ne peuvent pas être perdus par un chemin qui ne connaîtrait que A3
  // (revue E1 FLK, M1).
  const loaded = readProgressDoc(meta.readProgress());
  let progress: ProgressDoc = loaded.doc;
  let writable = loaded.writable;
  /** Relit le document stocké (un autre onglet a pu écrire depuis) et met l'état à jour. */
  const refreshDoc = () => {
    const fresh = readProgressDoc(meta.readProgress());
    progress = fresh.doc;
    writable = writable && fresh.writable;
  };
  /**
   * Toute modification relit d'abord le document stocké, applique `change`, puis écrit le
   * document complet : avec deux onglets, aucun ne peut effacer les gains de l'autre ni
   * permettre une seconde réclamation du même jour (revue E1 branché FLK, M2). Synchrone :
   * rien ne peut s'intercaler entre la relecture et l'écriture dans un même onglet.
   */
  const locks = options.locks !== undefined ? options.locks : (doc.defaultView?.navigator.locks ?? null);
  /**
   * Exécute `section` (lecture → modification → écriture, synchrone) sous un verrou Web Locks
   * commun à tous les onglets du jeu : deux onglets réellement concurrents ne peuvent plus lire
   * tous deux avant d'écrire (revue C6 Codex, revue E1 branché FLK M2). Sans Web Locks
   * (navigateurs anciens), repli : relecture juste avant l'écriture, sans exclusion entre onglets.
   */
  const withProgressLock = (section: () => void): void => {
    if (!locks) {
      section();
      return;
    }
    void locks.request(PROGRESS_LOCK, () => {
      if (!destroyed) section();
    }).catch((error: unknown) => {
      console.error('[shell] verrou de progression indisponible, repli sans verrou', error);
      if (!destroyed) section();
    });
  };
  const updateDoc = <R>(change: (current: ProgressDoc) => { doc: ProgressDoc; result: R }): R => {
    refreshDoc();
    const { doc: next, result } = change(progress);
    if (next !== progress) {
      progress = next;
      if (writable) meta.writeProgress(progress);
    }
    return result;
  };
  let screen: Screen = 'home';
  let run: RunState | null = null;
  let destroyed = false;
  // --- Préférences V4 : appliquées tout de suite, suivies quand l'appareil change -------------
  let prefs: Prefs = store.readPrefs();
  applyPrefs(doc, prefs);
  const unwatchPrefs = watchSystemPrefs(doc, () => prefs);
  const haptics = options.haptics ?? browserHaptics(doc.defaultView?.navigator);
  const uiSound = options.uiSound ?? createUiSound(doc.defaultView as never);
  const savePrefs = (next: Partial<Prefs>) => {
    prefs = sanitizePrefs({ ...prefs, ...next });
    store.writePrefs(prefs);
    applyPrefs(doc, prefs);
    run?.handle?.setAudio?.(!prefs.muted, prefs.volume);
  };
  /** Ce que le moteur reçoit : `reducedMotion` absent = le moteur suit l'appareil en direct. */
  const gamePrefs = (): ShellPrefs => ({
    muted: prefs.muted,
    volume: prefs.volume,
    effects: prefs.effects,
    ...(prefs.motion === 'system' ? {} : { reducedMotion: prefs.motion === 'reduce' }),
  });
  const fx = {
    haptic(kind: HapticKind) {
      if (prefs.haptics) haptics.vibrate(HAPTIC_PATTERNS[kind]);
    },
    sound(kind: UiSoundKind) {
      if (!prefs.muted) uiSound.play(kind, prefs.volume);
    },
  };

  // --- Classement (V3-A3) : identité pseudonyme et tickets préchargés -------------------------
  const leaderboard = options.leaderboard ?? unavailableLeaderboard;
  const storedPlayer = meta.readPlayer();
  let player: PlayerIdentity | null = isPlayerIdentity(storedPlayer) ? storedPlayer : null;
  const tickets: { free?: RankTicket; daily?: RankTicket } = {};
  const ticketLoading = { free: false, daily: false };
  const freshTicket = (t: RankTicket | undefined): t is RankTicket => {
    if (!t) return false;
    const at = today();
    return t.expiresAt - at.getTime() > TICKET_MARGIN_MS && (t.mode !== 'daily' || t.day === utcDateKey(at));
  };
  /**
   * Demande à l'avance un ticket par mode : la partie démarre sans attendre le réseau. Sans
   * pseudo, sans serveur ou hors ligne, la partie se joue quand même, simplement non classée.
   */
  const prefetchTickets = () => {
    if (!leaderboard.available || !player?.pseudo || destroyed) return;
    for (const mode of ['free', 'daily'] as const) {
      if (freshTicket(tickets[mode]) || ticketLoading[mode]) continue;
      ticketLoading[mode] = true;
      void leaderboard.issueTicket(mode, PLAY_RULES_VERSION).then((r) => {
        ticketLoading[mode] = false;
        if (r.ok && r.value.mode === mode && r.value.rulesVersion === PLAY_RULES_VERSION) tickets[mode] = r.value;
      });
    }
  };
  const takeTicket = (mode: Mode, day: string | null): RankTicket | null => {
    const key = mode === 'daily' ? 'daily' : mode === 'free' ? 'free' : null;
    if (!key) return null; // défi d'un ami : séquence imposée par le lien, jamais classée
    const t = tickets[key];
    if (!freshTicket(t)) return null;
    if (key === 'daily' && (t.day !== day || t.seed !== dailySeed(t.day))) return null;
    delete tickets[key];
    return t;
  };

  const parsed = parseChallenge(new URL(options.url).search);
  let challenge: Challenge | null = parsed.kind === 'challenge' ? parsed.challenge : null;
  let invalidReason: InvalidReason | null = parsed.kind === 'invalid' ? parsed.reason : null;
  if (challenge) tracker.track('challenge_open', { mode: 'challenge' });

  const live = el(doc, 'p', { class: 'sr-only', 'aria-live': 'polite', 'data-testid': 'live' });
  const view = el(doc, 'div', { class: 'view' });
  root.replaceChildren(view, live);

  const announce = (message: string) => {
    live.textContent = message;
  };

  // --- Fenêtres et bouton retour du téléphone ----------------------------------------------
  // Le shell ajoute au plus UNE entrée d'historique : pour un écran secondaire, ou pour une
  // fenêtre ouverte depuis l'accueil. Le retour du téléphone la consomme (voir onPopState).
  const historyApi = options.history ?? null;
  let historyPushed = false;
  let ignoreNextPop = false;
  const pushHistory = () => {
    if (!historyApi || historyPushed) return;
    try {
      historyApi.pushState({ poc: 'sub' }, '');
      historyPushed = true;
    } catch {
      // Historique indisponible (iframe sandbox) : le retour du téléphone garde son effet par défaut.
    }
  };
  const popOwnHistory = () => {
    if (!historyApi || !historyPushed) return;
    historyPushed = false;
    ignoreNextPop = true;
    try {
      historyApi.back();
    } catch {
      ignoreNextPop = false;
    }
  };

  let sheet: SheetHandle | null = null;
  /** L'entrée d'historique a été ajoutée par une fenêtre ouverte à l'accueil. */
  let sheetPushed = false;
  /** Changement d'écran en cours : la fenêtre se ferme sans toucher à l'historique. */
  let switching = false;
  const closeSheet = () => {
    const s = sheet;
    sheet = null;
    s?.close();
  };
  const openDialog = (spec: Parameters<typeof openSheet>[2]) => {
    closeSheet();
    const handle = openSheet(doc, root, {
      ...spec,
      onClose: () => {
        if (sheet === handle) sheet = null;
        if (sheetPushed && !switching) {
          sheetPushed = false;
          popOwnHistory();
        }
        spec.onClose?.();
      },
    });
    sheet = handle;
    if (screen === 'home' && !historyPushed) {
      pushHistory();
      sheetPushed = historyPushed;
    }
    return handle;
  };

  const show = (next: Screen, children: (HTMLElement | null)[], focus: HTMLElement) => {
    const changed = next !== screen;
    if (changed) {
      switching = true;
      closeSheet();
      switching = false;
      sheetPushed = false; // l'entrée éventuelle appartient désormais au nouvel écran
    }
    screen = next;
    clearTimeout(guardTimer);
    delete view.dataset.inputReady;
    view.classList.toggle('entering', changed);
    view.replaceChildren(...children.filter((c): c is HTMLElement => c !== null));
    view.dataset.screen = next;
    root.dataset.screen = next; // mise en page pleine page pendant la partie
    if (next === 'home') popOwnHistory();
    else pushHistory();
    focus.focus();
  };

  const recordLine = () => {
    const best = store.readBest();
    const text = store.persistent ? `Record : ${floors(best)}` : `Record : ${floors(best)} (pas sauvegardé sur cet appareil)`;
    const p = el(doc, 'p', { class: 'record-line', 'data-testid': 'record' });
    p.append(icon(doc, 'trophy'), el(doc, 'span', {}, text));
    return p;
  };

  /** Interrupteur du son (Réglages et Pause) : appliqué tout de suite, y compris en partie. */
  const soundToggle = (onChange?: () => void) =>
    switchButton(doc, {
      label: 'Son',
      checked: !prefs.muted,
      testId: 'sound-toggle',
      onChange: (on) => {
        savePrefs({ muted: !on });
        if (on) fx.sound('tap');
        onChange?.();
      },
    });

  const livesText = () => {
    const n = livesOf(progress);
    return `${n} vie${n > 1 ? 's' : ''}`;
  };

  /** Pastille chiffrée : le nombre est visible, l'unité est lue (« 150 pièces », « 1 vie »). */
  const countPill = (iconName: IconName, n: number, unit: string, kind: string, testId: string) => {
    const words = `${n} ${unit}${n > 1 ? 's' : ''}`;
    const p = el(doc, 'p', { class: `pill ${kind}`, 'data-testid': testId, title: words });
    p.append(icon(doc, iconName), el(doc, 'span', {}, String(n)), el(doc, 'span', { class: 'sr-only' }, ` ${unit}${n > 1 ? 's' : ''}`));
    return p;
  };

  /** Badge de niveau : anneau de progression ; le texte lu reste « Niveau N ». */
  const levelBadge = () => {
    const info = levelInfo(progress.xp);
    const ratio = info.toNext === null ? 1 : info.intoLevel / (info.intoLevel + info.toNext);
    const badge = el(doc, 'p', { class: 'pill level', 'data-testid': 'level', title: `Niveau ${info.level}` });
    const ring = el(doc, 'span', { class: 'level-ring' });
    ring.style.setProperty('--p', String(ratio));
    ring.append(el(doc, 'span', {}, String(info.level)));
    badge.append(el(doc, 'span', { class: 'level-word' }, 'Niveau '), ring);
    return badge;
  };

  /** Pastilles : niveau, pièces, vies (barre du haut et en-têtes des écrans de progression). */
  const statusChips = () => {
    const bar = el(doc, 'div', { class: 'topbar chips' });
    bar.append(
      levelBadge(),
      countPill('coin', progress.coins, 'pièce', 'coin', 'coins'),
      countPill('heart', livesOf(progress), 'vie', 'heart', 'lives'),
    );
    return bar;
  };

  const screenHeader = (titleText: string, onBack: () => void) => {
    const back = iconOnlyButton(doc, { icon: 'back', label: 'Retour', onClick: onBack, testId: 'back' });
    const h = el(doc, 'h1', { tabindex: '-1', class: 'screen-title' }, titleText);
    const header = el(doc, 'div', { class: 'screen-header' });
    header.append(back, h);
    return { header, title: h };
  };
  /** Retour vers l'accueil, focus rendu au bouton qui avait ouvert l'écran. */
  const backHome = (testId: string) => () => {
    renderHome();
    view.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();
  };

  /** Bande des 7 jours du cadeau : jours déjà pris, jour du jour, jours à venir. */
  const calendarStrip = (canClaim: boolean) => {
    const index = progress.calendar.index;
    // Après le 7e jour, l'index repart à 0 : si le cadeau du jour est déjà pris, tout est coché.
    const doneCount = canClaim ? index : index === 0 && progress.calendar.lastClaimDate ? 7 : index;
    const strip = el(doc, 'ol', { class: 'calendar', 'aria-label': 'Les 7 jours du cadeau' });
    CALENDAR_REWARDS.forEach((amount, i) => {
      const done = i < doneCount;
      const today = canClaim && i === index;
      const li = el(doc, 'li', { class: `cal-day${done ? ' done' : ''}${today ? ' today' : ''}`, 'aria-label': `Jour ${i + 1} : ${amount} pièces${done ? ', pris' : today ? ', aujourd’hui' : ''}` });
      li.append(el(doc, 'span', {}, `J${i + 1}`), icon(doc, done ? 'check' : 'coin'), el(doc, 'span', {}, `+${amount}`));
      strip.append(li);
    });
    return strip;
  };

  /** Écran Récompenses : cadeau du jour, passe, niveau, missions, collection (progression locale). */
  const renderRewards = (focusTestId?: string) => {
    const { header, title } = screenHeader('Récompenses', backHome('nav-rewards'));
    const day = utcDateKey(today());

    const gift = el(doc, 'section', { class: 'card', 'aria-labelledby': 'gift-title' });
    const status = calendarStatus(progress, day);
    gift.append(cardTitle(doc, 'gift', 'Cadeau du jour', 'gift-title'), calendarStrip(status.canClaim));
    gift.append(el(doc, 'p', { 'data-testid': 'calendar', tabindex: '-1', class: 'hint' },
      status.canClaim ? `+${status.reward} pièces (jour ${status.dayInCycle} sur 7)` : 'Déjà pris aujourd’hui. Reviens demain !'));
    if (status.canClaim) {
      gift.append(uiButton(doc, {
        label: `Prendre +${status.reward}`,
        icon: 'gift',
        variant: 'primary',
        block: true,
        testId: 'claim',
        onClick: () => withProgressLock(() => {
          const result = updateDoc((current) => {
            const r = claimCalendar(current, utcDateKey(today()));
            return { doc: r.doc, result: r };
          });
          if (result.claimed) {
            announce(`+${result.reward} pièces récupérées.`);
            fx.sound('coin');
            fx.haptic('reward');
            showToast(doc, root, `+${result.reward} pièces !`);
          } else {
            announce('Cadeau du jour déjà pris.');
          }
          if (screen === 'rewards') renderRewards('calendar');
        }),
      }));
    }

    const info = levelInfo(progress.xp);
    const level = el(doc, 'section', { class: 'card', 'aria-labelledby': 'level-title' });
    level.append(cardTitle(doc, 'star', `Niveau ${info.level}${info.title ? ` · ${info.title}` : ''}`, 'level-title'));
    if (info.toNext !== null) {
      level.append(
        progressBar(doc, info.intoLevel / (info.intoLevel + info.toNext), 'Vers le niveau suivant'),
        el(doc, 'p', { class: 'hint', 'data-testid': 'xp' }, `Encore ${info.toNext} étoile${info.toNext > 1 ? 's' : ''} pour le niveau ${info.level + 1}`),
      );
    } else {
      level.append(el(doc, 'p', { class: 'hint', 'data-testid': 'xp' }, 'Niveau maximal, bravo !'));
    }

    const goalsPanel = el(doc, 'section', { class: 'card', 'aria-labelledby': 'goals-title' });
    const goals = el(doc, 'ul', { class: 'missions', 'data-testid': 'goals' });
    for (const o of activeObjectives(progress)) {
      const li = el(doc, 'li', {});
      const text = el(doc, 'span', {}, o.label);
      text.append(el(doc, 'span', { class: 'reward' }, ` → ${rewardLabel(o.reward)}`));
      li.append(icon(doc, 'target'), text);
      goals.append(li);
    }
    if (goals.childElementCount === 0) goals.append(el(doc, 'li', {}, 'Toutes les missions sont réussies. Bravo !'));
    goalsPanel.append(cardTitle(doc, 'missions', 'Missions', 'goals-title'), goals);

    const note = el(doc, 'p', { class: 'hint small center' }, writable
      ? 'Ta progression est gardée sur cet appareil.'
      : 'Une version plus récente du jeu est ouverte ailleurs : cette partie de jeu n’est pas sauvegardée ici.');
    show('rewards', [header, statusChips(), gift, seasonPanel(), level, goalsPanel, collectionButton(), note], title);
    if (focusTestId) view.querySelector<HTMLElement>(`[data-testid="${focusTestId}"]`)?.focus();
  };

  // --- Passe de saison (V3-A5) ---------------------------------------------------------------
  const season = options.season ?? SEASON_1;
  const canDraw = (id: string) => isAnySkinId(id);
  const formatSeasonDay = (key: string) =>
    new Date(`${key}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const seasonClaimable = () => {
    const day = utcDateKey(today());
    return season.tiers.some((t) => tierStatus(progress, season, t, 'free', day, canDraw) === 'claimable');
  };
  const rewardText = (r: SeasonReward) => (r.kind === 'coins' ? `+${r.amount} pièces` : `Apparence ${r.name}`);

  const seasonPanel = () => {
    const day = utcDateKey(today());
    const phase = seasonPhase(season, day);
    const panel = el(doc, 'section', { class: 'card', 'aria-labelledby': 'season-title' });
    panel.append(cardTitle(doc, 'medal', `Passe · ${season.name}`, 'season-title'));
    const stars = seasonState(progress, season).stars;
    const next = nextTier(progress, season);
    if (phase === 'upcoming') {
      panel.append(el(doc, 'p', { 'data-testid': 'season-summary' }, `Commence le ${formatSeasonDay(season.start)}.`));
    } else if (phase === 'ended') {
      panel.append(el(doc, 'p', { 'data-testid': 'season-summary' }, 'Saison finie. Tes apparences restent à toi.'));
    } else if (next) {
      const prev = season.tiers.filter((t) => t.stars <= stars).at(-1)?.stars ?? 0;
      panel.append(
        progressBar(doc, (stars - prev) / (next.stars - prev), `Vers le palier ${next.tier}`, 'gold'),
        el(doc, 'p', { class: 'hint', 'data-testid': 'season-summary' },
          `Palier ${next.tier} dans ${next.stars - stars} étoile${next.stars - stars > 1 ? 's' : ''} · jusqu’au ${formatSeasonDay(season.end)}`),
      );
    } else {
      panel.append(el(doc, 'p', { 'data-testid': 'season-summary' }, 'Tous les paliers sont atteints. Bravo !'));
    }
    const ready = seasonClaimable();
    panel.append(uiButton(doc, {
      label: ready ? 'Voir le passe · cadeau à prendre' : 'Voir le passe',
      icon: 'medal',
      variant: ready ? 'accent' : 'ghost',
      block: true,
      testId: 'open-season',
      onClick: () => renderSeason(),
    }));
    return panel;
  };

  const claimTier = (tier: number, track: Track) => withProgressLock(() => {
    const r = updateDoc((current) => {
      const c = claimSeasonTier(current, season, tier, track, utcDateKey(today()), canDraw);
      return { doc: c.doc, result: c };
    });
    const text = r.ok ? `Pris : ${rewardText(r.reward)}.` : r.reason === 'claimed' ? 'Déjà pris.' : 'Pas encore disponible.';
    announce(text);
    if (r.ok) {
      fx.sound('reward');
      fx.haptic('reward');
    }
    if (screen === 'season') renderSeason(`tier-${tier}`, text);
  });

  /** Écran du passe : piste de paliers, gratuite réclamable, premium en aperçu (indisponible). */
  const renderSeason = (focusTestId?: string, notice?: string) => {
    const { header, title } = screenHeader(`Passe · ${season.name}`, () => renderRewards('open-season'));
    const day = utcDateKey(today());
    const stars = seasonState(progress, season).stars;
    const parts: HTMLElement[] = [header];
    if (notice) parts.push(el(doc, 'p', { class: 'notice ok', role: 'status', 'data-testid': 'season-notice' }, notice));
    const intro = el(doc, 'section', { class: 'card' });
    const starsLine = el(doc, 'p', { class: 'card-title', 'data-testid': 'season-stars' });
    starsLine.append(icon(doc, 'star'), el(doc, 'span', {}, `${stars} étoile${stars > 1 ? 's' : ''} de saison`));
    intro.append(
      starsLine,
      el(doc, 'p', { class: 'hint small' }, `Du ${formatSeasonDay(season.start)} au ${formatSeasonDay(season.end)}. Les étoiles se gagnent en jouant.`),
      el(doc, 'p', { class: 'hint small', 'data-testid': 'premium-note' }, 'Piste Premium : indisponible pour l’instant. Rien n’est en vente.'),
    );
    parts.push(intro);
    const head = el(doc, 'div', { class: 'track-head', 'aria-hidden': 'true' });
    head.append(el(doc, 'span', {}, 'Palier'), el(doc, 'span', {}, 'Gratuit'), el(doc, 'span', {}, 'Premium'));
    parts.push(head);
    const list = el(doc, 'ol', { class: 'tiers', 'aria-label': 'Paliers' });
    for (const t of season.tiers) {
      const li = el(doc, 'li', { class: `tier${stars >= t.stars ? ' reached' : ''}`, 'data-testid': `tier-${t.tier}`, tabindex: '-1' });
      const node = el(doc, 'p', { class: 'tier-node', 'aria-label': `Palier ${t.tier}, ${t.stars} étoiles` });
      node.append(el(doc, 'span', {}, String(t.tier)), el(doc, 'small', {}, `${t.stars}★`));
      li.append(node);
      for (const track of ['free', 'premium'] as const) {
        const reward = track === 'free' ? t.free : t.premium;
        const st = tierStatus(progress, season, t, track, day, canDraw);
        const cell = el(doc, 'div', { class: `tier-cell ${track} ${st}`, 'data-testid': `tier-${t.tier}-${track}` });
        if (reward.kind === 'skin') {
          // Pas encore dessinée par le moteur : pastille « ? », jamais l'aperçu d'une autre apparence.
          cell.append(isAnySkinId(reward.id)
            ? previewOrSwatch(doc, reward.id, { theme: progress.selected.theme, skin: reward.id }, renderAppearancePreview)
            : el(doc, 'div', { class: 'swatch soon', 'aria-hidden': 'true' }, '?'));
        }
        cell.append(el(doc, 'p', { class: 'tier-reward' }, rewardText(reward)));
        const remaining = t.stars - stars;
        const label: Record<typeof st, string> = {
          claimed: 'Pris',
          claimable: '',
          locked: `${remaining} étoile${remaining > 1 ? 's' : ''}`,
          soon: 'Bientôt',
          'premium-unavailable': 'Indisponible',
          ended: 'Saison finie',
        };
        if (st === 'claimable') {
          cell.append(uiButton(doc, { label: 'Prendre', variant: 'primary', size: 'sm', testId: `claim-tier-${t.tier}`, onClick: () => claimTier(t.tier, track) }));
        } else {
          const state = el(doc, 'p', { class: 'tier-state' });
          const stIcon: IconName = st === 'claimed' ? 'check' : st === 'locked' || st === 'premium-unavailable' ? 'lock' : 'clock';
          state.append(icon(doc, stIcon), el(doc, 'span', {}, ` ${label[st]}`));
          cell.append(state);
        }
        li.append(cell);
      }
      list.append(li);
    }
    parts.push(list);
    show('season', parts, title);
    if (focusTestId) view.querySelector<HTMLElement>(`[data-testid="${focusTestId}"]`)?.focus();
  };

  // --- Réglages V4 -------------------------------------------------------------------------
  const settingsCard = (iconName: IconName, titleText: string, id: string, ...content: HTMLElement[]) => {
    const card = el(doc, 'section', { class: 'card settings-group', 'aria-labelledby': id });
    card.append(cardTitle(doc, iconName, titleText, id), ...content);
    return card;
  };

  const renderSettings = () => {
    const { header, title } = screenHeader('Réglages', backHome('nav-settings'));

    const theme = settingsCard('auto', 'Couleurs', 'set-theme',
      segmented(doc, {
        label: 'Couleurs de l’écran',
        testId: 'theme',
        value: prefs.theme,
        options: [
          { value: 'system', label: 'Auto' },
          { value: 'light', label: 'Clair' },
          { value: 'dark', label: 'Sombre' },
        ],
        onChange: (v) => savePrefs({ theme: v }),
      }),
      el(doc, 'p', { class: 'hint small' }, 'Auto suit le réglage de ton appareil.'),
    );

    const volumeRow = el(doc, 'div', { class: 'range-row' });
    const volume = rangeInput(doc, {
      label: 'Volume',
      value: prefs.volume * 100,
      testId: 'volume',
      disabled: prefs.muted,
      onCommit: (v) => {
        savePrefs({ volume: v / 100 });
        fx.sound('tap');
      },
    });
    volumeRow.append(icon(doc, 'mute'), volume, icon(doc, 'sound'));
    const sound = settingsCard('sound', 'Son', 'set-sound',
      soundToggle(() => {
        volume.disabled = prefs.muted;
      }),
      volumeRow,
    );

    const vibration = settingsCard('vibrate', 'Vibrations', 'set-haptics',
      haptics.available
        ? switchButton(doc, {
          label: 'Vibrations',
          checked: prefs.haptics,
          testId: 'haptics-toggle',
          onChange: (on) => {
            savePrefs({ haptics: on });
            if (on) fx.haptic('reward');
          },
        })
        : el(doc, 'p', { class: 'hint', 'data-testid': 'haptics-unavailable' }, 'Ton appareil ne propose pas les vibrations.'),
    );

    const motion = settingsCard('magic', 'Animations', 'set-motion',
      segmented(doc, {
        label: 'Animations',
        testId: 'motion',
        value: prefs.motion,
        options: [
          { value: 'system', label: 'Auto' },
          { value: 'reduce', label: 'Réduites' },
          { value: 'full', label: 'Normales' },
        ],
        onChange: (v) => savePrefs({ motion: v }),
      }),
      el(doc, 'p', { class: 'hint small' }, 'Réduites : moins de mouvements à l’écran. Auto suit ton appareil.'),
    );

    const effects = settingsCard('zap', 'Effets visuels', 'set-effects',
      segmented(doc, {
        label: 'Effets visuels',
        testId: 'effects',
        value: prefs.effects,
        options: [
          { value: 'full', label: 'Complets' },
          { value: 'light', label: 'Fluides' },
        ],
        onChange: (v) => savePrefs({ effects: v }),
      }),
      el(doc, 'p', { class: 'hint small' }, 'Fluides : moins d’effets, pour les téléphones plus lents.'),
    );

    const help = uiButton(doc, { label: 'Comment jouer', icon: 'help', variant: 'ghost', block: true, testId: 'open-howto', onClick: () => openHowTo() });
    const note = el(doc, 'p', { class: 'hint small center' }, 'Tes réglages restent sur cet appareil.');
    // Licences de la police et des icônes, livrées avec le jeu (OFL 1.1, ISC, MIT).
    const credits = el(doc, 'p', { class: 'hint small center' });
    const creditsLink = el(doc, 'a', { href: 'licences-tiers.txt', class: 'credits', 'data-testid': 'credits', target: '_blank', rel: 'noopener' }, 'Crédits : police Fredoka, icônes Lucide');
    credits.append(creditsLink);
    show('settings', [header, theme, sound, vibration, motion, effects, help, note, credits], title);
  };

  /** Fenêtre « Comment jouer » : six étapes, des mots simples. */
  const openHowTo = () => {
    const steps: [IconName, string][] = [
      ['hand', 'Touche l’écran pour poser le bloc qui bouge.'],
      ['target', 'Pose-le bien au-dessus : ce qui dépasse tombe.'],
      ['sparkles', 'Un bloc parfait donne plus de points et remplit la jauge Super.'],
      ['zap', 'Jauge pleine = bonus : Ralenti ou points ×2 pendant 5 étages.'],
      ['heart', 'Après une chute, une vie te laisse continuer.'],
      ['trophy', 'Monte le plus haut possible et bats ton record !'],
    ];
    const list = el(doc, 'ol', { class: 'howto' });
    for (const [name, text] of steps) {
      const li = el(doc, 'li', {});
      const badge = el(doc, 'span', { class: 'step-ic' });
      badge.append(icon(doc, name));
      li.append(badge, el(doc, 'span', {}, text));
      list.append(li);
    }
    const ok = uiButton(doc, { label: 'C’est compris !', variant: 'primary', block: true, testId: 'howto-ok', onClick: () => closeSheet() });
    openDialog({ title: 'Comment jouer', body: [list], actions: [ok], testId: 'howto' });
  };

  const shopConfig = options.shop ?? { catalog: COIN_SHOP, isAvailable: (id: string) => isAnySkinId(id) };
  const shopPreview = shopConfig.preview ?? renderAppearancePreview;

  type ShopNotice = { text: string; testId: string };

  /** Ligne de prix (pièce + montant). */
  const priceTag = (amount: number) => {
    const p = el(doc, 'p', { class: 'item-meta price' });
    p.append(icon(doc, 'coin'), el(doc, 'span', {}, `${amount} pièces`));
    return p;
  };

  /** Fenêtre de confirmation d'achat : rien n'est débité avant « Oui, acheter ». */
  const confirmPurchase = (titleText: string, question: string, onYes: () => void, yesTestId: string, noTestId: string, art?: HTMLElement) => {
    const yes = uiButton(doc, { label: 'Oui, acheter', icon: 'coin', variant: 'primary', block: true, testId: yesTestId, onClick: () => { closeSheet(); onYes(); } });
    const no = uiButton(doc, { label: 'Non', variant: 'ghost', block: true, testId: noTestId, onClick: () => closeSheet() });
    const body: HTMLElement[] = [];
    if (art) {
      const box = el(doc, 'div', { class: 'art item-visual' });
      box.append(art);
      body.push(box);
    }
    body.push(el(doc, 'p', { 'data-testid': 'confirm-text' }, question));
    openDialog({ title: titleText, body, actions: [yes, no], testId: 'confirm', initialFocus: yes });
  };

  /** Boutique en pièces : aperçu, prix, confirmation en fenêtre, achat atomique sous verrou. */
  const renderShop = (state: { notice?: ShopNotice; focus?: string } = {}) => {
    const { header, title } = screenHeader('Boutique', backHome('nav-shop'));
    const items = sellableItems(shopConfig.catalog, shopConfig.isAvailable);
    const parts: HTMLElement[] = [header, statusChips()];

    if (state.notice) {
      parts.push(el(doc, 'p', { class: `notice ${state.notice.testId.endsWith('success') || state.notice.testId === 'shop-worn' ? 'ok' : 'warn'}`, role: 'status', 'data-testid': state.notice.testId, tabindex: '-1' }, state.notice.text));
    }

    const skinsCard = el(doc, 'section', { class: 'card', 'aria-labelledby': 'shop-skins-title' });
    skinsCard.append(cardTitle(doc, 'palette', 'Apparences', 'shop-skins-title'));
    if (items.length === 0) {
      skinsCard.append(el(doc, 'p', { 'data-testid': 'shop-empty' }, 'Rien à vendre pour l’instant. Reviens bientôt !'));
    } else {
      const list = el(doc, 'ul', { class: 'items' });
      for (const item of items) {
        const st = itemState(progress, item);
        const chosen = st === 'owned' && progress.selected.skin === item.id;
        const li = el(doc, 'li', { 'data-testid': `shop-${item.id}`, tabindex: '-1' });
        const card = el(doc, 'div', { class: `item ${st}${chosen ? ' selected' : ''}` });
        const visual = el(doc, 'div', { class: 'item-visual' });
        const preview = () => previewOrSwatch(doc, item.id, { theme: progress.selected.theme, skin: isAnySkinId(item.id) ? item.id : progress.selected.skin }, shopPreview);
        visual.append(preview());
        card.append(visual, el(doc, 'p', { class: 'item-name' }, item.name));
        if (chosen) {
          const badge = el(doc, 'span', { class: 'badge', 'aria-hidden': 'true' });
          badge.append(icon(doc, 'check'));
          card.append(badge, el(doc, 'p', { class: 'item-meta' }, 'Choisi'));
        } else if (st === 'owned') {
          card.append(uiButton(doc, { label: 'Mettre', variant: 'secondary', size: 'sm', block: true, onClick: () => wear(item) }));
        } else {
          card.append(priceTag(item.price));
          if (st === 'affordable') {
            card.append(uiButton(doc, {
              label: 'Acheter',
              variant: 'primary',
              size: 'sm',
              block: true,
              ariaLabel: `Acheter ${item.name} pour ${item.price} pièces`,
              onClick: () => confirmPurchase(`Acheter ${item.name} ?`, `Acheter ${item.name} pour ${item.price} pièces ?`, () => buy(item), 'confirm-buy', 'cancel-buy', preview()),
            }));
          } else {
            card.append(el(doc, 'p', { class: 'item-meta lock' }, `Il te manque ${item.price - progress.coins} pièces.`));
          }
        }
        li.append(card);
        list.append(li);
      }
      skinsCard.append(list);
    }
    parts.push(skinsCard, livesShopSection());
    parts.push(el(doc, 'p', { class: 'hint small center' }, 'Les pièces se gagnent en jouant. Elles ne s’achètent pas.'));
    show('shop', parts, title);
    if (state.focus) view.querySelector<HTMLElement>(`[data-testid="${state.focus}"]`)?.focus();
  };

  /** Vies de reprise en pièces : stock, prix, confirmation, maximum. */
  const livesShopSection = () => {
    const box = el(doc, 'section', { class: 'card', 'aria-labelledby': 'lives-title', 'data-testid': 'shop-lives' });
    const n = livesOf(progress);
    box.append(
      cardTitle(doc, 'heart', 'Vies', 'lives-title'),
      el(doc, 'p', {}, 'Une vie te laisse continuer une partie libre après la première chute.'),
      el(doc, 'p', { class: 'hint', 'data-testid': 'lives-count' }, `Tu as ${livesText()} (maximum ${MAX_LIVES}).`),
    );
    if (n >= MAX_LIVES) {
      box.append(el(doc, 'p', { class: 'tag ok' }, 'Maximum atteint.'));
    } else {
      box.append(priceTag(LIFE_PRICE));
      if (progress.coins >= LIFE_PRICE) {
        box.append(uiButton(doc, {
          label: 'Acheter 1 vie',
          icon: 'heart',
          variant: 'primary',
          block: true,
          testId: 'buy-life',
          ariaLabel: `Acheter 1 vie pour ${LIFE_PRICE} pièces`,
          onClick: () => confirmPurchase('Acheter une vie ?', `Acheter 1 vie pour ${LIFE_PRICE} pièces ?`, () => buyLifeNow(), 'confirm-life', 'cancel-life'),
        }));
      } else {
        box.append(el(doc, 'p', { class: 'item-meta lock' }, `Il te manque ${LIFE_PRICE - progress.coins} pièces.`));
      }
    }
    return box;
  };

  const celebrate = (soundKind: UiSoundKind = 'coin') => {
    fx.sound(soundKind);
    fx.haptic('reward');
    if (prefs.effects === 'full') confetti(doc, root);
  };

  const buyLifeNow = () => withProgressLock(() => {
    const r = updateDoc((current) => {
      const b = buyLife(current);
      return { doc: b.doc, result: b };
    });
    const notice: ShopNotice = r.ok
      ? { text: `C’est à toi ! Tu as maintenant ${livesText()}.`, testId: 'life-success' }
      : r.reason === 'full'
        ? { text: `Tu as déjà le maximum de ${MAX_LIVES} vies.`, testId: 'life-full' }
        : { text: `Il te manque ${r.missing ?? 0} pièces pour une vie.`, testId: 'shop-insufficient' };
    announce(notice.text);
    if (r.ok) celebrate();
    else fx.sound('error');
    if (screen === 'shop') renderShop({ notice, focus: notice.testId });
  });

  const buy = (item: ShopItem) => withProgressLock(() => {
    const result = updateDoc((current) => {
      const r = purchaseWithCoins(current, item.id, shopConfig.catalog);
      return { doc: r.doc, result: r };
    });
    const notice: ShopNotice = result.ok
      ? { text: `C’est à toi ! ${item.name} est dans ta collection.`, testId: 'shop-success' }
      : result.reason === 'owned'
        ? { text: `Tu as déjà ${item.name}.`, testId: 'shop-owned' }
        : result.reason === 'insufficient'
          ? { text: `Il te manque ${result.missing ?? 0} pièces pour ${item.name}.`, testId: 'shop-insufficient' }
          : { text: 'Cet objet n’est plus en vente.', testId: 'shop-unknown' };
    announce(notice.text);
    if (result.ok) celebrate('reward');
    else fx.sound('error');
    if (screen === 'shop') renderShop({ notice, focus: notice.testId });
  });

  const wear = (item: ShopItem) => withProgressLock(() => {
    updateDoc((current) => {
      if (!isAnySkinId(item.id)) return { doc: current, result: null };
      const updated = selectAppearance(current, { skin: item.id });
      return { doc: updated, result: null };
    });
    fx.haptic('tap');
    if (screen === 'shop') renderShop({ notice: { text: `${item.name} est mis pour ta prochaine partie.`, testId: 'shop-worn' }, focus: 'shop-worn' });
  });

  const collectionCount = () => {
    const skins = unlockedSkins(progress).filter((id) => (SKIN_IDS as readonly string[]).includes(id) || (OBTAINABLE_V3_SKINS as readonly string[]).includes(id));
    const owned = unlockedThemes(progress).length + skins.length + earnedBadges(progress).length;
    const total = THEME_IDS.length + SKIN_IDS.length + OBTAINABLE_V3_SKINS.length + BADGE_IDS.length;
    return { owned, total };
  };

  const collectionButton = () => {
    const { owned, total } = collectionCount();
    return uiButton(doc, { label: `Ma collection ${owned}/${total}`, icon: 'palette', variant: 'secondary', block: true, testId: 'open-collection', onClick: () => renderCollectionScreen() });
  };

  /** D'où la collection a été ouverte (dock de l'accueil ou écran Récompenses) : le retour y ramène. */
  let collectionFrom: 'home' | 'rewards' = 'rewards';
  const renderCollectionScreen = (focusCard?: string) => {
    const { nodes, focus } = renderCollection(doc, progress, {
      onSelect: (next) => withProgressLock(() => {
        const changed = updateDoc((current) => {
          const updated = selectAppearance(current, next);
          const same = updated.selected.theme === current.selected.theme && updated.selected.skin === current.selected.skin;
          return { doc: same ? current : updated, result: !same };
        });
        if (!changed || screen !== 'collection') return;
        // Le focus reste sur la carte choisie, pas sur le titre.
        renderCollectionScreen(next.theme ? `card-theme-${next.theme}` : `card-skin-${next.skin}`);
        announce('Sélection enregistrée.');
      }),
      onBack: () => {
        if (collectionFrom === 'rewards') renderRewards('open-collection');
        else backHome('nav-collection')();
      },
    }, focusCard);
    show('collection', nodes, focus);
  };

  const clearChallengeUrl = () => {
    const url = new URL(options.url);
    url.search = '';
    url.hash = '';
    try {
      options.replaceUrl(url.toString());
    } catch {
      // L'historique peut être indisponible (iframe sandbox) : sans conséquence pour le jeu.
    }
  };

  const playFree = () => {
    challenge = null;
    invalidReason = null;
    clearChallengeUrl();
    startRun(null);
  };

  /** Barre du haut de l'accueil : niveau, pièces, vies, aide et réglages. */
  const homeTopbar = () => {
    const bar = el(doc, 'div', { class: 'topbar' });
    bar.append(
      levelBadge(),
      countPill('coin', progress.coins, 'pièce', 'coin', 'coins'),
      countPill('heart', livesOf(progress), 'vie', 'heart', 'lives'),
      el(doc, 'span', { class: 'spacer' }),
    );
    const tools = el(doc, 'div', { class: 'tools' });
    const help = iconOnlyButton(doc, { icon: 'help', label: 'Comment jouer', onClick: () => openHowTo(), testId: 'nav-help' });
    help.classList.add('help');
    tools.append(help, iconOnlyButton(doc, { icon: 'settings', label: 'Réglages', onClick: () => renderSettings(), testId: 'nav-settings' }));
    bar.append(tools);
    return bar;
  };

  /** Dock du bas : quatre entrées, la pastille signale un cadeau à prendre. */
  const homeDock = () => {
    const day = utcDateKey(today());
    const giftReady = calendarStatus(progress, day).canClaim || seasonClaimable();
    const dock = el(doc, 'nav', { class: 'dock', 'aria-label': 'Menu' });
    dock.append(
      dockButton(doc, { icon: 'shop', label: 'Boutique', testId: 'nav-shop', onClick: () => renderShop() }),
      dockButton(doc, { icon: 'palette', label: 'Collection', testId: 'nav-collection', onClick: () => { collectionFrom = 'home'; renderCollectionScreen(); } }),
      dockButton(doc, {
        icon: 'gift',
        label: 'Récompenses',
        testId: 'nav-rewards',
        dot: giftReady,
        ...(giftReady ? { ariaLabel: 'Récompenses, un cadeau t’attend' } : {}),
        onClick: () => { collectionFrom = 'rewards'; renderRewards(); },
      }),
      dockButton(doc, { icon: 'trophy', label: 'Classement', testId: 'nav-leaderboard', onClick: () => renderLeaderboard() }),
    );
    return dock;
  };

  const brandHero = (withTagline = true) => {
    const title = el(doc, 'h1', { tabindex: '-1', class: 'brand-title', 'aria-label': 'Pile ou Crash' });
    title.append(el(doc, 'span', {}, 'Pile'), ' ', el(doc, 'span', { class: 'small-word' }, 'ou'), ' ', el(doc, 'span', { class: 'accent' }, 'Crash'));
    const logo = el(doc, 'div', { class: 'logo bounce', 'aria-hidden': 'true' });
    for (let i = 0; i < 3; i++) logo.append(el(doc, 'span', {}));
    const hero = el(doc, 'header', { class: 'hero' });
    hero.append(logo, title);
    if (withTagline) hero.append(el(doc, 'p', { class: 'tagline' }, 'Touche pour poser le bloc !'));
    return hero;
  };

  /** Prochaine mission (grands écrans seulement, en CSS) : un but clair pour la partie suivante. */
  const homeMission = () => {
    const next = activeObjectives(progress)[0];
    if (!next) return null;
    const card = el(doc, 'section', { class: 'card home-mission', 'aria-labelledby': 'home-mission-title', 'data-testid': 'home-mission' });
    const head = el(doc, 'h2', { class: 'card-title', id: 'home-mission-title' });
    head.append(icon(doc, 'missions'), el(doc, 'span', {}, 'Prochaine mission'));
    const reward = el(doc, 'p', { class: 'hint small' });
    reward.append(icon(doc, 'gift'), el(doc, 'span', {}, ` À gagner : ${rewardLabel(next.reward)}`));
    card.append(head, el(doc, 'p', { class: 'mission-label' }, next.label), reward);
    return card;
  };

  const renderHome = () => {
    collectionFrom = 'rewards';
    if (invalidReason) {
      const box = el(doc, 'section', { class: 'card' });
      const alert = el(doc, 'p', { role: 'alert', class: 'notice danger', 'data-testid': 'invalid-link' }, INVALID_MESSAGES[invalidReason]);
      const play = uiButton(doc, { label: 'Nouvelle partie', icon: 'play', variant: 'primary', size: 'xl', block: true, onClick: playFree });
      box.append(alert);
      show('home', [homeTopbar(), brandHero(false), box, play, recordLine(), el(doc, 'span', { class: 'home-spacer' }), homeDock()], play);
      return;
    }
    if (challenge) {
      const card = el(doc, 'section', { class: 'card challenge-card', 'aria-labelledby': 'challenge-title' });
      card.append(
        cardTitle(doc, 'users', 'Un ami te défie !', 'challenge-title'),
        el(doc, 'p', { 'data-testid': 'challenge-invite' }, `Dépasse ${floors(challenge.target)} sur la même partie que ton ami.`),
        el(doc, 'p', { class: 'hint small' }, 'C’est ton ami qui annonce son score.'),
      );
      const accept = uiButton(doc, { label: 'Relever le défi', icon: 'play', variant: 'primary', size: 'xl', block: true, onClick: () => startRun(null) });
      const free = uiButton(doc, { label: 'Partie libre', variant: 'ghost', block: true, onClick: playFree });
      show('home', [homeTopbar(), brandHero(false), card, accept, free, recordLine(), el(doc, 'span', { class: 'home-spacer' }), homeDock()], accept);
      return;
    }

    // Une seule action principale, très visible, sans défiler (320×568, paysage).
    const play = uiButton(doc, { label: 'Jouer', icon: 'play', variant: 'primary', size: 'xl', block: true, testId: 'play', onClick: () => startRun(null) });
    play.classList.add('pulse');

    const now = today();
    const day = utcDateKey(now);
    const dailyCard = el(doc, 'div', { class: 'daily-card' });
    const daily = uiButton(doc, { label: 'Défi du jour', icon: 'calendar', variant: 'secondary', block: true, testId: 'daily', onClick: () => startRun(null, 'daily') });
    const dailyBest = meta.readDailyBest(day);
    const dailyHint = el(doc, 'p', { class: 'hint small center', 'data-testid': 'daily-hint', 'data-day': day },
      `Le même pour tous · nouveau à ${formatLocalTime(nextDailyChange(now))}${dailyBest > 0 ? ` · ton record : ${floors(dailyBest)}` : ''}`);
    dailyCard.append(daily, dailyHint);
    const actions = el(doc, 'div', { class: 'home-actions' });
    actions.append(play, dailyCard, recordLine());
    show('home', [homeTopbar(), brandHero(), actions, homeMission(), el(doc, 'span', { class: 'home-spacer' }), homeDock()], play);
    prefetchTickets();
  };

  /** Choix du pseudo : jamais le vrai nom, validé comme sur le serveur. */
  const pseudoBlock = (editing: boolean, kind: BoardKind) => {
    const box = el(doc, 'section', { class: 'card pseudo', 'data-testid': 'pseudo-block' });
    if (player?.pseudo && !editing) {
      const line = el(doc, 'p', { class: 'card-title', 'data-testid': 'pseudo' });
      line.append(icon(doc, 'users'), el(doc, 'span', {}, `Ton pseudo : ${player.pseudo}`));
      box.append(line, uiButton(doc, { label: 'Changer', variant: 'ghost', size: 'sm', testId: 'pseudo-change', onClick: () => renderLeaderboard(kind, true) }));
      return box;
    }
    const form = el(doc, 'form', { class: 'pseudo-form' });
    const input = el(doc, 'input', {
      id: 'pseudo-input', type: 'text', maxlength: '16', autocomplete: 'off', class: 'text-input', 'data-testid': 'pseudo-input',
    });
    input.value = player?.pseudo ?? '';
    const error = el(doc, 'p', { class: 'hint small', role: 'alert', 'data-testid': 'pseudo-error' });
    const save = uiButton(doc, { label: 'Valider', variant: 'primary', block: true, testId: 'pseudo-save', onClick: () => undefined });
    save.type = 'submit';
    form.append(
      el(doc, 'label', { for: 'pseudo-input', class: 'card-title' }, 'Choisis un pseudo pour être classé'),
      el(doc, 'p', { class: 'hint small' }, 'Pas ton vrai nom. 3 à 16 lettres ou chiffres.'),
      input,
      save,
      error,
    );
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const pseudo = cleanPseudo(input.value);
      if (!pseudo) {
        error.textContent = 'Ce pseudo ne va pas : 3 à 16 lettres ou chiffres.';
        fx.sound('error');
        input.focus();
        return;
      }
      player = { id: player?.id ?? (options.newPlayerId ?? defaultPlayerId)(), pseudo };
      meta.writePlayer(player);
      announce(`Pseudo enregistré : ${pseudo}.`);
      prefetchTickets();
      renderLeaderboard(kind);
    });
    box.append(form);
    return box;
  };

  let boardRequest = 0;
  /** Écran Classement : Monde, Semaine, Aujourd'hui ; chargement, erreurs, démo, pagination. */
  const renderLeaderboard = (kind: BoardKind = 'global', editingPseudo = false) => {
    const { header, title } = screenHeader('Classement', backHome('nav-leaderboard'));
    const parts: HTMLElement[] = [header];
    if (!leaderboard.available) {
      const card = el(doc, 'section', { class: 'card empty-art' });
      card.append(
        icon(doc, 'trophy'),
        el(doc, 'p', { class: 'card-title', 'data-testid': 'board-unavailable' }, 'Classement en ligne indisponible pour l’instant.'),
        el(doc, 'p', { class: 'hint' }, 'Tu peux jouer quand même : ton record reste sur cet appareil.'),
      );
      parts.push(card, recordLine());
      show('leaderboard', parts, title);
      return;
    }
    const tabs = el(doc, 'div', { class: 'seg', role: 'group', 'aria-label': 'Tableau' });
    for (const k of ['global', 'weekly', 'daily'] as const) {
      const b = el(doc, 'button', { type: 'button', 'data-testid': `board-${k}`, 'aria-pressed': String(k === kind) }, BOARD_LABELS[k]);
      b.addEventListener('click', () => renderLeaderboard(k));
      tabs.append(b);
    }
    const content = el(doc, 'div', { class: 'board', 'data-testid': 'board' });
    parts.push(pseudoBlock(editingPseudo, kind), tabs, content);
    show('leaderboard', parts, title);
    if (editingPseudo) view.querySelector<HTMLElement>('#pseudo-input')?.focus();
    void loadBoard(kind, content, 0, []);
  };

  /** Score affiché au classement : des points en règles v2 (hauteur en v1). */
  const boardScore = (score: number) => (PLAY_RULES_VERSION === 2 ? `${score} point${score > 1 ? 's' : ''}` : floors(score));

  const loadBoard = async (kind: BoardKind, content: HTMLElement, offset: number, shown: BoardEntry[]) => {
    const request = ++boardRequest;
    const loading = el(doc, 'p', { role: 'status', class: 'hint center', 'data-testid': 'board-loading' }, 'Chargement…');
    if (offset === 0) content.replaceChildren(loading);
    else content.append(loading);
    const r = await leaderboard.read(kind, {
      rulesVersion: PLAY_RULES_VERSION,
      offset,
      limit: 20,
      ...(player ? { player: player.id } : {}),
    });
    if (destroyed || screen !== 'leaderboard' || request !== boardRequest) return; // réponse périmée
    loading.remove();
    if (!r.ok) {
      const retry = uiButton(doc, { label: 'Réessayer', icon: 'replay', variant: 'secondary', block: true, testId: 'board-retry', onClick: () => void loadBoard(kind, content, offset, shown) });
      content.append(el(doc, 'p', { role: 'alert', class: 'notice warn', 'data-testid': 'board-error' }, SERVICE_MESSAGES[r.error]), retry);
      return;
    }
    const pageData = r.value;
    const entries = [...shown, ...pageData.entries];
    const nodes: HTMLElement[] = [];
    if (pageData.demo) {
      nodes.push(el(doc, 'p', { class: 'notice warn', 'data-testid': 'board-demo' }, 'Mode démo : ces joueurs sont inventés pour l’essai.'));
    }
    if (pageData.you) {
      nodes.push(el(doc, 'p', { class: 'notice ok', 'data-testid': 'board-you' }, `Ta place : ${ordinal(pageData.you.rank)} sur ${pageData.total}`));
    }
    if (entries.length === 0) {
      nodes.push(el(doc, 'p', { class: 'hint center', 'data-testid': 'board-empty' }, 'Personne pour l’instant. Sois le premier !'));
    } else {
      const list = el(doc, 'ol', { class: 'board-list', 'aria-label': `Classement ${BOARD_LABELS[kind]}` });
      for (const e of entries) {
        const li = el(doc, 'li', { class: e.you ? 'you' : '' });
        li.append(
          el(doc, 'span', { class: 'board-rank' }, ordinal(e.rank)),
          el(doc, 'span', { class: 'board-name' }, e.you ? `${e.pseudo} (toi)` : e.pseudo),
          el(doc, 'span', { class: 'board-score' }, boardScore(e.score)),
        );
        list.append(li);
      }
      nodes.push(list);
    }
    if (pageData.nextOffset !== null) {
      const next = pageData.nextOffset;
      nodes.push(uiButton(doc, { label: 'Voir plus', variant: 'ghost', block: true, testId: 'board-more', onClick: () => void loadBoard(kind, content, next, entries) }));
    }
    content.replaceChildren(...nodes);
  };

  const stopRun = () => {
    run?.handle?.destroy();
    if (run) {
      run.handle = null;
      run.controls = null;
    }
  };

  const startRun = (previous: RunState | null, requested?: Mode) => {
    stopRun();
    const mode: Mode = previous?.mode ?? requested ?? (challenge ? 'challenge' : 'free');
    // Défi d'un ami : même séquence. Défi du jour : seed de la date UTC, figée au lancement de
    // cette partie. Libre : nouvelle seed.
    const day = mode === 'daily' ? utcDateKey(today()) : null;
    const ticket = takeTicket(mode, day);
    const seed = ticket
      ? ticket.seed
      : mode === 'daily' && day ? dailySeed(day) : mode === 'challenge' && challenge ? challenge.seed : options.newSeed();
    const runId = options.newRunId();
    const current: RunState = {
      runId,
      seed,
      mode,
      challenge: mode === 'challenge' ? challenge : null,
      day,
      activeAtStart: activeObjectives(progress).map((o) => o.id),
      events: createRunTracker(),
      handle: null,
      ticket,
      revivedWith: null,
      controls: null,
    };
    run = current;

    const runChallenge = current.challenge;
    const heading = el(doc, 'h2', { class: 'sr-only', tabindex: '-1' },
      runChallenge
        ? `Défi d’un ami en cours : dépasse ${floors(runChallenge.target)}`
        : day
          ? 'Défi du jour en cours'
          : 'Partie en cours');
    const canvas = el(doc, 'canvas', {
      class: 'game-canvas',
      width: '360',
      height: '640',
      tabindex: '0',
      'aria-label': 'Zone de jeu. Touche l’écran ou appuie sur Espace pour poser le bloc.',
      'data-testid': 'game-canvas',
    });
    const stage = el(doc, 'div', { class: 'stage' });

    // --- Pause : bouton en haut à gauche, retour du téléphone, onglet caché -----------------
    // Après le raté (offre de reprise, fin), le bouton disparaît : le moteur attend déjà.
    let fallen = false;
    const hud = el(doc, 'div', { class: 'game-hud' });
    const pauseOverlay = el(doc, 'div', { class: 'overlay', hidden: '', 'data-testid': 'pause' });
    const pausePanel = el(doc, 'div', { class: 'overlay-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pause-title' });
    const reviveShown = () => stage.querySelector('[data-testid="revive"]') !== null;
    const syncHud = () => {
      hud.hidden = fallen || !pauseOverlay.hidden;
    };
    const resume = uiButton(doc, {
      label: 'Reprendre',
      icon: 'play',
      variant: 'primary',
      size: 'xl',
      block: true,
      testId: 'resume',
      onClick: () => {
        if (run !== current) return;
        pauseOverlay.hidden = true;
        syncHud();
        current.handle?.resume();
        canvas.focus();
      },
    });
    const quit = uiButton(doc, {
      label: 'Quitter la partie',
      icon: 'quit',
      variant: 'ghost',
      block: true,
      testId: 'quit',
      onClick: () => {
        if (run !== current) return;
        // Partie abandonnée : ni score, ni gains, ni record (rien n'est enregistré).
        stopRun();
        run = null;
        announce('Partie quittée.');
        renderHome();
      },
    });
    pausePanel.append(
      el(doc, 'h2', { id: 'pause-title' }, 'Pause'),
      el(doc, 'p', { class: 'hint' }, 'Ta partie t’attend.'),
      resume,
      soundToggle(),
      quit,
    );
    pauseOverlay.append(pausePanel);
    const pauseGame = (focus: boolean) => {
      if (run !== current || !current.handle) return;
      if (pauseOverlay.hidden) {
        current.handle.pause();
        pauseOverlay.hidden = false;
        syncHud();
        announce('Pause.');
      }
      if (focus && !reviveShown()) resume.focus();
    };
    hud.append(iconOnlyButton(doc, { icon: 'pause', label: 'Pause', testId: 'pause-button', onClick: () => pauseGame(true) }));
    current.controls = {
      // Onglet caché : pause (avant le raté ; ensuite le moteur gère seul la fin et l'offre).
      hidden: () => {
        if (!fallen) pauseGame(false);
      },
      // Retour à l'onglet : la reprise reste un choix explicite (bouton Reprendre).
      visible: () => {
        if (!pauseOverlay.hidden && !reviveShown()) resume.focus();
      },
      // Bouton retour du téléphone : jamais de sortie involontaire pendant une partie.
      back: () => {
        if (!fallen) pauseGame(true);
      },
      setFallen: (value: boolean) => {
        fallen = value;
        syncHud();
      },
    };

    const target = runChallenge
      ? el(doc, 'p', { class: 'target-strip', 'data-testid': 'target' }, `Objectif : plus de ${floors(runChallenge.target)}`)
      : day
        ? el(doc, 'p', { class: 'target-strip', 'data-testid': 'target' }, `Défi du jour${dayInWords(day) ? ` · ${dayInWords(day)}` : ''}`)
        : null;
    target?.prepend(icon(doc, runChallenge ? 'target' : 'calendar'));
    stage.append(canvas, hud, pauseOverlay);

    show('game', [heading, target, stage], canvas);

    let ended = false;
    let placed = false;
    // Reprise proposée seulement en partie libre, et seulement si un moyen réel existe.
    const allowContinue = mode === 'free' && (reviveAds.kind !== 'none' || reviveLives.count() > 0);
    try {
      current.handle = options.startGame({
        canvas,
        config: mode === 'challenge' && runChallenge?.rulesVersion === RULES_VERSION ? { seed, rulesVersion: RULES_VERSION } : { seed, rulesVersion: PLAY_RULES_VERSION },
        prefs: gamePrefs(),
        appearance: progress.selected,
        ...(allowContinue ? { allowContinue } : {}),
        onGameEvent: (event) => {
          if (run !== current) return;
          current.events.onEvent(event);
          onRunEvent(current, event, stage, canvas);
        },
        onFirstPlacement: () => {
          if (placed || destroyed || run !== current) return;
          placed = true;
          tracker.track('first_placement', { mode, runId });
        },
        onEnd: (result) => {
          if (ended || destroyed || run !== current) return; // onEnd unique et non périmé
          ended = true;
          // Différé : le moteur peut appeler onEnd depuis son propre gestionnaire.
          queueMicrotask(() => finishRun(current, result));
        },
      });
      // Mesures émises seulement après un montage réussi (revue A1 FLK, m1).
      if (previous) tracker.track('retry', { mode, runId, previousRunId: previous.runId });
      tracker.track('run_start', { mode, runId, ...(day ? { day } : {}) });
      announce('Partie commencée.');
    } catch (error) {
      console.error('[shell] le jeu n’a pas pu démarrer', error);
      run = null;
      const msg = el(doc, 'p', { role: 'alert', class: 'notice danger', 'data-testid': 'start-error' },
        'Le jeu n’a pas pu démarrer sur cet appareil.');
      const retry = uiButton(doc, { label: 'Réessayer', icon: 'replay', variant: 'primary', size: 'xl', block: true, onClick: () => startRun(null) });
      const home = uiButton(doc, { label: 'Accueil', icon: 'home', variant: 'ghost', block: true, onClick: renderHome });
      show('home', [brandHero(false), msg, retry, home], retry);
    }
  };

  // --- Reprise (V3-A6) -----------------------------------------------------------------------
  const reviveAds = options.revive?.ads ?? noAds;
  /**
   * Vies par défaut : celles gagnées en jeu (achetées en pièces, boutique), dans la progression
   * locale, retirées et rendues sous le verrou entre onglets. Un fournisseur serveur peut remplacer.
   */
  const localLives: LivesProvider = {
    count: () => livesOf(progress),
    consume: (requestId) =>
      new Promise((resolve) => {
        withProgressLock(() => {
          const r = updateDoc((current) => {
            const u = useLife(current, requestId);
            return { doc: u.doc, result: u };
          });
          resolve(r.ok ? 'ok' : 'none');
        });
      }),
    refund: (requestId) =>
      new Promise((resolve) => {
        withProgressLock(() => {
          updateDoc((current) => ({ doc: returnLife(current, requestId), result: null }));
          resolve();
        });
      }),
  };
  const reviveLives = options.revive?.lives ?? localLives;
  const rewardGate = createRewardGate(reviveAds);

  /**
   * Offre DOM après la chute (le moteur attend, aucun onEnd avant la décision) :
   * vie possédée, vidéo récompensée (démo libellée en dev), ou Terminer, toujours disponible.
   * Un refus, une vidéo absente ou une erreur ne donnent jamais de reprise.
   */
  const showReviveOffer = (current: RunState, stage: HTMLElement, canvas: HTMLCanvasElement) => {
    const handle = current.handle;
    if (!handle?.continueRun || !handle.declineContinue || stage.querySelector('[data-testid="revive"]')) return;
    if (reviveLives.count() === 0 && reviveAds.kind === 'none') {
      handle.declineContinue(); // aucun moyen réel : fin normale, aucune offre vide
      return;
    }
    const requestId = `${current.runId}:revive`;
    const box = el(doc, 'div', { class: 'overlay revive', 'data-testid': 'revive' });
    // Délai de garde (comme au résultat) : l'offre apparaît au moment de la chute ; un enfant qui
    // tape encore vite ne doit ni dépenser une vie ni terminer la partie sans l'avoir voulu.
    const readyAt = now() + RESULT_INPUT_GUARD_MS;
    const guarded = (action: () => void) => () => {
      if (now() < readyAt) return;
      action();
    };
    setTimeout(() => {
      box.dataset.inputReady = 'true';
    }, RESULT_INPUT_GUARD_MS);
    const panel = el(doc, 'div', { class: 'overlay-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'revive-title' });
    const msg = el(doc, 'p', { role: 'status', class: 'hint', 'data-testid': 'revive-status' });
    const buttons: HTMLButtonElement[] = [];
    const busy = (on: boolean) => buttons.forEach((b) => (b.disabled = on));
    const close = () => box.remove();
    const resumeWith = (how: string): boolean => {
      if (run !== current) return false;
      const accepted = handle.continueRun!();
      if (!accepted) {
        msg.textContent = 'Reprise impossible.';
        busy(false);
        return false;
      }
      current.revivedWith = how;
      close();
      fx.sound('reward');
      fx.haptic('reward');
      canvas.focus();
      return true;
    };
    const finish = () => {
      close();
      handle.declineContinue!();
    };
    const lives = reviveLives.count();
    if (lives > 0) {
      const b = uiButton(doc, {
        label: `Utiliser une vie (${lives})`,
        icon: 'heart',
        variant: 'primary',
        size: 'xl',
        block: true,
        testId: 'revive-life',
        onClick: guarded(() => {
          busy(true);
          msg.textContent = '';
          void reviveLives.consume(requestId).then((r) => {
            // Vie retirée mais reprise refusée (partie quittée, moteur hors attente) : elle est rendue
            // (revue FLK A6, m4). Le registre serveur rend une seule fois par requestId.
            if (r === 'ok' && (run !== current || !box.isConnected || !resumeWith('vie'))) {
              void reviveLives.refund(requestId);
              if (box.isConnected) msg.textContent = 'Reprise impossible. Ta vie t’a été rendue.';
              return;
            }
            if (run !== current || !box.isConnected || r === 'ok') return;
            msg.textContent = r === 'none' ? 'Plus de vie.' : 'La vie n’a pas pu être utilisée. Rien n’a été retiré.';
            busy(false);
          });
        }),
      });
      buttons.push(b);
    }
    if (reviveAds.kind !== 'none') {
      const b = uiButton(doc, {
        label: 'Regarder une vidéo',
        icon: 'video',
        variant: lives > 0 ? 'secondary' : 'primary',
        block: true,
        testId: 'revive-ad',
        onClick: guarded(() => {
          busy(true);
          msg.textContent = 'Vidéo en cours…';
          void rewardGate.reward(requestId, 'revive', () => resumeWith('vidéo')).then((outcome) => {
            if (run !== current || !box.isConnected) return;
            if (outcome === 'rewarded' || outcome === 'already-rewarded') return;
            msg.textContent = AD_MESSAGES[outcome];
            busy(false);
          });
        }),
      });
      buttons.push(b);
    }
    // Sans régie : la vidéo est montrée comme indisponible, jamais simulée.
    const adUnavailable = reviveAds.kind === 'none'
      ? (() => {
          const b = uiButton(doc, { label: 'Vidéo indisponible', icon: 'video', variant: 'ghost', block: true, testId: 'revive-ad-unavailable', onClick: () => undefined });
          b.disabled = true;
          b.setAttribute('aria-disabled', 'true');
          return b;
        })()
      : null;
    const end = uiButton(doc, { label: 'Terminer', variant: 'ghost', block: true, testId: 'revive-end', onClick: guarded(finish) });
    buttons.push(end);
    const art = el(doc, 'div', { class: 'revive-art', 'aria-hidden': 'true' });
    art.append(icon(doc, 'heart'));
    panel.append(art, el(doc, 'h2', { id: 'revive-title', class: 'revive-title' }, 'Oups ! Encore une chance ?'));
    if (reviveAds.kind === 'demo') panel.append(el(doc, 'p', { class: 'notice warn small', 'data-testid': 'revive-demo' }, reviveAds.label));
    panel.append(...buttons.slice(0, -1), ...(adUnavailable ? [adUnavailable] : []), end, msg);
    box.append(panel);
    stage.append(box);
    buttons[0]!.focus();
    announce('Oups ! Encore une chance ? Choisis, ou Terminer.');
  };

  /** Événements du moteur : vibrations mesurées, offre de reprise, compte à rebours, bonus, jauge. */
  const onRunEvent = (current: RunState, event: GameEvent, stage: HTMLElement, canvas: HTMLCanvasElement) => {
    switch (event.type) {
      case 'placement':
        fx.haptic(event.perfect ? 'perfect' : 'place');
        break;
      case 'miss':
        current.controls?.setFallen(true);
        fx.haptic('miss');
        break;
      case 'continue-offer':
        showReviveOffer(current, stage, canvas);
        break;
      case 'continue-start':
        current.controls?.setFallen(false);
        announce(`C’est reparti ! Prêt dans ${Math.round(event.countdownTicks / 120)} secondes.`);
        break;
      case 'bonus-start':
        announce(`Bonus ${BONUS_NAMES[event.bonus]} pour ${event.floors} étages !`);
        break;
      case 'bonus-end':
        announce(`Fin du bonus ${BONUS_NAMES[event.bonus]}.`);
        break;
      case 'gauge':
        // Jauge « Super » dessinée dans le canvas ; on n'annonce que la jauge pleine (pas de bruit).
        if (event.value >= event.max) announce('Jauge Super pleine !');
        break;
      default:
        break;
    }
  };

  const finishRun = (current: RunState, result: AnyRunResult) => {
    if (destroyed || run !== current) return;
    tracker.track('run_end', {
      mode: current.mode,
      runId: current.runId,
      score: result.score,
      durationTicks: result.durationTicks,
      perfectCount: result.perfectCount,
    });
    stopRun();
    prefetchTickets();
    // Record, progression et record du jour : une seule section exclusive entre onglets.
    withProgressLock(() => {
      const height = heightOf(result);
      const isRecord = store.submitScore({
        score: height,
        perfectCount: result.perfectCount,
        mode: current.mode,
      });
      const economy = updateDoc((doc) => {
        const e = applyRunEconomy(doc, current.activeAtStart, {
          runId: current.runId,
          mode: current.mode,
          score: height, // gains sur la hauteur, jamais sur les points ×2 (accord #27, C7)
          perfectCount: result.perfectCount,
          longestStreak: current.events.longestStreak,
        });
        // Étoiles de saison : mêmes étoiles, même écriture ; 0 si la partie était déjà comptée.
        return { doc: addSeasonStars(e.doc, season, utcDateKey(today()), e.gained.xp), result: e };
      });
      const isDailyRecord = current.day ? meta.submitDaily(current.day, height) : false;
      renderResult(current, result, {
        isRecord,
        isDailyRecord,
        completedNow: economy.completedNow,
        gained: economy.gained,
      });
    });
  };

  type Outcome = {
    isRecord: boolean;
    isDailyRecord: boolean;
    completedNow: Objective[];
    gained: { xp: number; coins: number; levelUp: { from: number; to: number } | null };
  };

  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

  const renderResult = (current: RunState, result: AnyRunResult, outcome: Outcome) => {
    const { isRecord } = outcome;
    const height = heightOf(result);
    const points = pointsOf(result);
    const revived = continuesOf(result) > 0;

    // --- Carte du score : titre, rubans, hauteur en grand, points, gains -------------------
    const card = el(doc, 'section', { class: 'card result-card', 'aria-labelledby': 'result-title' });
    const title = el(doc, 'h2', { id: 'result-title', class: 'result-title', tabindex: '-1' }, 'Partie terminée');
    card.append(title);
    let summary = `Partie terminée. Hauteur : ${height}.`;
    if (isRecord) {
      const ribbon = el(doc, 'p', { class: 'ribbon', 'data-testid': 'new-record' });
      ribbon.append(icon(doc, 'trophy'), el(doc, 'span', {}, 'Nouveau record !'));
      card.append(ribbon);
      summary += ' Nouveau record.';
    }
    const score = el(doc, 'p', { class: 'big-score', 'data-testid': 'score' });
    score.append(el(doc, 'span', { class: 'num' }, String(height)), ' ', el(doc, 'span', { class: 'unit' }, `étage${height > 1 ? 's' : ''}`));
    card.append(score);
    if (points !== null) {
      const p = el(doc, 'p', { class: 'points', 'data-testid': 'points' });
      p.append(icon(doc, 'sparkles'), el(doc, 'span', {}, plural(points, 'point')));
      card.append(p);
      summary += ` ${points} points.`;
    }
    if (outcome.gained.xp > 0 || outcome.gained.coins > 0) {
      const gains = el(doc, 'p', { class: 'gains', 'data-testid': 'gains' });
      const star = el(doc, 'span', { class: 'gain' });
      star.append(icon(doc, 'star'), el(doc, 'span', {}, `+${plural(outcome.gained.xp, 'étoile')}`));
      const coin = el(doc, 'span', { class: 'gain' });
      coin.append(icon(doc, 'coin'), el(doc, 'span', {}, `+${plural(outcome.gained.coins, 'pièce')}`));
      gains.append(star, el(doc, 'span', { class: 'sr-only' }, ' · '), coin);
      card.append(gains);
      summary += ` +${plural(outcome.gained.xp, 'étoile')} · +${plural(outcome.gained.coins, 'pièce')}.`;
    }
    if (outcome.gained.levelUp) {
      const newTitle = LEVEL_TITLES[outcome.gained.levelUp.to];
      // Le titre n'est annoncé que s'il est nouveau (niveaux 2, 5, 10) — revue FLK, m1.
      const text = `Niveau ${outcome.gained.levelUp.to} atteint${newTitle ? ` : ${newTitle}` : ''} !`;
      const ribbon = el(doc, 'p', { class: 'ribbon violet', 'data-testid': 'level-up' });
      ribbon.append(icon(doc, 'crown'), el(doc, 'span', {}, text));
      card.append(ribbon);
      summary += ` ${text}`;
    }

    // --- Lignes d'information : défi, défi du jour, reprise, classement ----------------------
    const lines = el(doc, 'div', { class: 'result-lines' });
    if (revived) {
      lines.append(el(doc, 'p', { 'data-testid': 'revived' }, 'Partie avec une reprise : hors classement.'));
      summary += ' Partie avec une reprise.';
    }
    if (current.challenge) {
      const t = current.challenge.target;
      const text =
        height > t
          ? `Défi relevé : ${height} contre ${t} !`
          : height === t
            ? `Égalité : ${t} partout. Encore un étage !`
            : `Pas encore : ${height} sur ${t}. Réessaie !`;
      lines.append(el(doc, 'p', { 'data-testid': 'challenge-outcome' }, text));
      summary += ` ${text}`;
    }
    if (current.day) {
      const best = meta.readDailyBest(current.day);
      const text = outcome.isDailyRecord ? 'Nouveau record du Défi du jour !' : `Record du Défi du jour : ${floors(best)}`;
      lines.append(el(doc, 'p', { 'data-testid': 'daily-outcome' }, text));
      summary += ` ${text}`;
    }
    const rankStatus = el(doc, 'p', { role: 'status', 'data-testid': 'rank-status' });
    const rankRetry = uiButton(doc, { label: 'Envoyer encore', icon: 'replay', variant: 'ghost', size: 'sm', testId: 'rank-retry', onClick: () => void sendRank(current, result, rankStatus, rankRetry) });
    rankRetry.hidden = true;
    if (revived) {
      rankStatus.textContent = 'Score gardé sur cet appareil.'; // « hors classement » est déjà dit juste au-dessus
    } else if (current.ticket && player?.pseudo) {
      rankStatus.textContent = 'Envoi au classement…';
    } else if (leaderboard.available && current.mode !== 'challenge') {
      rankStatus.textContent = player?.pseudo
        ? 'Partie non classée : pas de connexion au départ.'
        : 'Choisis un pseudo dans Classement pour être classé.';
    } else {
      rankStatus.textContent = 'Score gardé sur cet appareil.';
    }
    lines.append(rankStatus, rankRetry);
    lines.append(recordLine());

    const parts: HTMLElement[] = [card, lines];
    if (outcome.completedNow.length > 0) {
      const list = el(doc, 'ul', { class: 'completed-goals', 'aria-label': 'Missions réussies', 'data-testid': 'completed-goals' });
      for (const o of outcome.completedNow) {
        const li = el(doc, 'li', {});
        li.append(icon(doc, 'check'), el(doc, 'span', {}, `${o.label} : ${rewardLabel(o.reward)} débloqué !`));
        list.append(li);
      }
      parts.push(list);
      summary += ` ${outcome.completedNow.length} mission(s) réussie(s).`;
    }
    if (current.mode === 'free' && !revived && livesOf(progress) === 0) {
      const tip = el(doc, 'p', { class: 'notice small', 'data-testid': 'lives-tip' });
      tip.append(icon(doc, 'heart'), el(doc, 'span', {}, `Astuce : avec une vie (Boutique, ${LIFE_PRICE} pièces), tu peux continuer après une chute.`));
      parts.push(tip);
    }

    // --- Actions --------------------------------------------------------------------------
    const status = el(doc, 'p', { class: 'hint center', role: 'status', 'data-testid': 'share-status' });
    const fallback = el(doc, 'div', { class: 'fallback', hidden: '' });
    const readyAt = now() + RESULT_INPUT_GUARD_MS;
    const guarded = (action: () => void) => () => {
      if (now() < readyAt) return;
      action();
    };
    const retry = uiButton(doc, { label: 'Rejouer', icon: 'replay', variant: 'primary', size: 'xl', block: true, testId: 'retry', onClick: guarded(() => startRun(current)) });
    const shareButton = uiButton(doc, { label: 'Défier un ami', icon: 'share', variant: 'secondary', block: true, testId: 'share', onClick: guarded(() => void doShare()) });
    const home = uiButton(doc, { label: 'Accueil', icon: 'home', variant: 'ghost', block: true, testId: 'result-home', onClick: guarded(renderHome) });

    let imagePromise: Promise<File | null> | null = null;
    const resultImage = () => {
      if (!options.resultImage) return Promise.resolve(null);
      imagePromise ??= options.resultImage(result, current.mode, current.day, progress.selected).catch(() => null);
      return imagePromise;
    };
    const saveImage = uiButton(doc, {
      label: 'Enregistrer l’image',
      icon: 'image',
      variant: 'ghost',
      block: true,
      testId: 'save-image',
      onClick: guarded(() => {
        void resultImage().then((file) => {
          if (destroyed || screen !== 'result') return;
          if (!file) {
            status.textContent = 'Image indisponible sur cet appareil. Le lien du défi reste partageable.';
            return;
          }
          if ((options.saveFile ?? ((f: File) => downloadFile(f, doc)))(file)) {
            status.textContent = 'Image enregistrée.';
            fx.haptic('tap');
            return;
          }
          // Dernier secours : l'image affichée, à garder par un appui long (navigateurs sans téléchargement).
          try {
            const img = el(doc, 'img', { alt: 'Image du résultat', class: 'result-image', 'data-testid': 'result-image' });
            img.setAttribute('src', URL.createObjectURL(file));
            fallback.replaceChildren(img, el(doc, 'p', { class: 'hint small center' }, 'Appuie longtemps sur l’image pour l’enregistrer.'));
            fallback.hidden = false;
            status.textContent = 'Téléchargement impossible : l’image est affichée ci-dessous.';
          } catch {
            status.textContent = 'Image indisponible sur cet appareil. Le lien du défi reste partageable.';
          }
        });
      }),
    });
    const doShare = async () => {
      const url = buildChallengeUrl(options.url, current.seed, height, result.rulesVersion);
      shareButton.disabled = true;
      tracker.track('share_attempt', { mode: current.mode, runId: current.runId });
      let shareOutcome: ShareOutcome;
      try {
        const image = await resultImage();
        shareOutcome = await options.share({
          title: 'Pile ou Crash',
          text: `J’ai empilé ${floors(height)}${revived ? ' (avec une reprise)' : ''}. Tu fais mieux sur la même partie ?`,
          url,
          ...(image ? { files: [image] } : {}),
        });
      } catch {
        shareOutcome = 'unavailable';
      }
      if (destroyed || screen !== 'result') return;
      shareButton.disabled = false;
      if (shareOutcome === 'shared' || shareOutcome === 'copied') {
        tracker.track('share_success', { mode: current.mode, runId: current.runId });
      }
      fallback.hidden = true;
      if (shareOutcome === 'shared') status.textContent = 'Défi envoyé.';
      else if (shareOutcome === 'copied') status.textContent = 'Lien du défi copié. Colle-le dans un message !';
      else if (shareOutcome === 'cancelled') status.textContent = 'Partage annulé.';
      else {
        // Ni partage ni presse-papiers : on affiche le lien à copier à la main.
        status.textContent = 'Copie automatique impossible. Copie le lien ci-dessous.';
        const label = el(doc, 'label', { for: 'challenge-link', class: 'card-title' }, 'Lien du défi');
        const input = el(doc, 'input', {
          id: 'challenge-link',
          type: 'text',
          readonly: '',
          class: 'text-input',
          'data-testid': 'challenge-link',
        });
        input.value = url;
        fallback.replaceChildren(label, input);
        fallback.hidden = false;
        input.focus();
        input.select();
      }
    };

    // Actions principales juste sous le score (visibles sans défiler, même sur 320 × 568) :
    // Rejouer, puis Défier un ami et Accueil. Le reste (image, collection) vient après les infos.
    const actions = el(doc, 'div', { class: 'result-actions' });
    const row = el(doc, 'div', { class: 'row' });
    row.append(shareButton, home);
    actions.append(retry, row);
    const more = el(doc, 'div', { class: 'result-more' });
    if (options.resultImage) more.append(saveImage);
    const rewardShortcut = outcome.completedNow.length > 0;
    if (rewardShortcut) {
      more.append(uiButton(doc, { label: 'Voir la collection', icon: 'palette', variant: 'ghost', block: true, testId: 'result-collection', onClick: guarded(() => renderCollectionScreen()) }));
    }
    const [scoreCard, ...details] = parts;
    show('result', [scoreCard!, actions, status, fallback, ...details, more.childElementCount > 0 ? more : null], retry);
    // Fête mesurée : record ou niveau gagné (confettis seulement avec les effets complets).
    if (outcome.gained.levelUp) celebrate('levelup');
    else if (isRecord) celebrate('reward');
    if (current.ticket && player?.pseudo && !revived) void sendRank(current, result, rankStatus, rankRetry);
    // Marqueur observable (tests, styles) de la fin du délai de garde.
    guardTimer = setTimeout(() => {
      if (screen === 'result') view.dataset.inputReady = 'true';
    }, RESULT_INPUT_GUARD_MS);
    announce(summary);
  };

  /**
   * Envoie la partie (ticket + entrées) : le serveur rejoue et calcule lui-même le score.
   * Idempotent côté serveur : « Envoyer encore » après une coupure ne compte jamais deux fois.
   */
  const sendRank = async (current: RunState, result: AnyRunResult, status: HTMLElement, retry: HTMLButtonElement) => {
    if (!current.ticket || !player?.pseudo) return;
    retry.hidden = true;
    status.textContent = 'Envoi au classement…';
    const r = await leaderboard.submit({
      ticket: current.ticket.ticket,
      playerId: player.id,
      pseudo: player.pseudo,
      inputTicks: result.inputTicks,
      ...(result.rulesVersion === 2 ? { continueTicks: continueTicksOf(result) } : {}),
    });
    if (destroyed || !status.isConnected) return;
    let text: string;
    if (r.ok && r.value.ranked) {
      const kind: BoardKind = current.ticket.mode === 'daily' ? 'daily' : 'global';
      const p = r.value.placements[kind];
      text = p ? `Classement ${BOARD_LABELS[kind]} : ${ordinal(p.rank)} sur ${p.total}.` : 'Partie classée.';
      if (p && !p.improved) text += ' Ton meilleur score reste celui d’avant.';
    } else if (r.ok) {
      text = 'Partie avec reprise : elle n’entre pas au classement.';
    } else if (r.error === 'rejected') {
      text = r.code === 'unknown_ticket' ? 'Partie non classée : trop ancienne.' : 'Partie non classée : refusée par le classement.';
    } else {
      text = `Pas envoyé. ${SERVICE_MESSAGES[r.error]}`;
      retry.hidden = false;
    }
    status.textContent = text;
    announce(text);
  };

  // Modalité de la dernière interaction : l'anneau de focus du canvas n'apparaît qu'au clavier
  // (proposition FLK, revue F3) ; au toucher, rien ne se superpose au jeu.
  const onPointer = () => {
    root.dataset.input = 'pointer';
  };
  const onKey = (event: KeyboardEvent) => {
    // Espace (touche de jeu) exclue : un joueur qui alterne toucher et Espace ne voit pas
    // apparaître l'anneau pendant la partie (revue A3b FLK, m1).
    if (event.key === 'Tab' || event.key === 'Enter' || event.key.startsWith('Arrow')) {
      root.dataset.input = 'keyboard';
    }
  };
  const win = doc.defaultView;
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && !event.key.startsWith('poc:')) return;
    refreshDoc();
    if (event.key === null || event.key.endsWith(':prefs')) {
      prefs = store.readPrefs();
      applyPrefs(doc, prefs);
    }
    if (screen === 'home' && !sheet) renderHome();
  };
  win?.addEventListener('storage', onStorage);
  doc.addEventListener('pointerdown', onPointer, true);
  doc.addEventListener('keydown', onKey, true);

  const onVisibility = () => {
    if (screen !== 'game' || !run?.controls) return;
    if (doc.visibilityState === 'hidden') run.controls.hidden();
    else run.controls.visible();
  };
  doc.addEventListener('visibilitychange', onVisibility);

  /**
   * Bouton retour du téléphone : ferme la fenêtre ouverte, met la partie en pause, sinon
   * revient à l'accueil. À l'accueil, le retour garde son effet habituel (quitter la page).
   */
  const onPopState = () => {
    if (ignoreNextPop) {
      ignoreNextPop = false;
      // Course rare : un nouvel écran a été ouvert avant la fin du retour demandé par le shell,
      // qui a donc consommé la nouvelle entrée. On la remet pour garder le retour du téléphone.
      if (screen !== 'home' && historyPushed) {
        historyPushed = false;
        pushHistory();
      }
      return;
    }
    historyPushed = false; // l'entrée ajoutée par le shell vient d'être consommée
    sheetPushed = false;
    if (sheet) {
      closeSheet();
      if (screen !== 'home') pushHistory();
      return;
    }
    if (screen === 'game') {
      pushHistory();
      run?.controls?.back();
      return;
    }
    if (screen !== 'home') renderHome();
  };
  if (historyApi) win?.addEventListener('popstate', onPopState);

  renderHome();

  return {
    get screen() {
      return screen;
    },
    destroy() {
      destroyed = true;
      clearTimeout(guardTimer);
      closeSheet();
      stopRun();
      unwatchPrefs();
      uiSound.close();
      doc.removeEventListener('visibilitychange', onVisibility);
      doc.removeEventListener('pointerdown', onPointer, true);
      win?.removeEventListener('storage', onStorage);
      win?.removeEventListener('popstate', onPopState);
      doc.removeEventListener('keydown', onKey, true);
      delete root.dataset.screen;
      delete root.dataset.input;
      root.replaceChildren();
    },
  };
}
