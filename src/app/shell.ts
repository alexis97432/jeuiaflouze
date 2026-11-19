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
import { PLAY_RULES_VERSION, type GameEvent, type GameHandle } from './game-contract';
import type { ShellPrefs, StartGame } from './game-loader';
import { cosmeticCard, previewOrSwatch, rarityChip, renderCollection, stateLine, type CollectionFilter, type PreviewFn } from './collection-view';
import { byRarity, catalogItem, MUSIC_CATALOG, sourceLabel, universeTrack, type CatalogItem } from './catalog';
import { checkOpenOffer, dailySelection, nextRotationAt, rotationDay, rotationLocalTime, untilRotation } from './rotation';
import type { AudioHub } from '../platform/audio-hub';
import type { MusicPlayer, PlayerState } from './music/player';
import type { DeviceInfo, Diagnostics } from './diagnostics';
import { createPreviewAnimator } from './preview-animator';
import { BONUS_HINTS, BONUS_NAMES, continuesOf, continueTicksOf, feversOf, heightOf, pointsOf, savesOf, type AnyRunResult } from './run-result';
import { AD_MESSAGES, createRewardGate, noAds, type RewardedAdProvider } from '../platform/ads/rewarded';
import { buyLife, LIFE_PRICE, livesOf, MAX_LIVES, returnLife, useLife } from './lives';
import { claimAllFree, claimSeasonTier, SEASON_1, seasonLevel, seasonPhase, seasonState, tierStatus, creditSeasonStars, seasonStarsLeftToday, SEASON_DAILY_STARS, type Season, type SeasonReward, type SeasonTier, type TierStatus, type Track } from './season';
import { COIN_SHOP, itemState, purchaseWithCoins, sellableItems, type ShopItem } from './shop';
import { isTrackId } from './music/tracks';
import { dayInWords, GAME_NAME, isAnySkinId, isThemeId, RARITIES, RARITY_INFO, rarityRank, renderAppearancePreview, type AnyAppearance } from '../game';
import {
  applyRunEconomy,
  dailyBonusLeft,
  DAILY_BONUS,
  DAILY_BONUS_MIN_HEIGHT,
  CALENDAR_REWARDS,
  calendarStatus,
  claimCalendar,
  equipMusic,
  equippedMusic,
  LEVEL_TITLES,
  levelInfo,
  readProgressDoc,
  type ProgressDoc,
} from './economy';
import { el, floors } from './dom';
import {
  activeObjectives,
  ownsMusic,
  rewardLabel,
  selectAppearance,
  type Objective,
  type ObjectiveId,
} from './progression';
import { createRunTracker, type RunTracker } from './run-tracker';
import { dailySeed, nextDailyChange, utcDateKey } from '../platform/daily';
import type { Mode, Tracker } from '../platform/metrics';
import { copyText, downloadFile, type ShareData, type ShareOutcome } from '../platform/share';
import { sanitizePrefs, type LocalStore, type MetaStore, type Prefs } from '../platform/storage';
import { applyPrefs, watchSystemPrefs } from './prefs';
import { browserHaptics, createHubUiSound, createUiSound, HAPTIC_PATTERNS, type HapticKind, type Haptics, type UiSound, type UiSoundKind } from './feedback';
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

export type Screen = 'home' | 'game' | 'result' | 'collection' | 'settings' | 'shop' | 'leaderboard' | 'season';
/** Écrans de menu reliés par la barre d'onglets (V6). */
type TabScreen = 'home' | 'shop' | 'collection' | 'season' | 'leaderboard';
const TAB_SCREENS: readonly Screen[] = ['home', 'shop', 'collection', 'season', 'leaderboard'];

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
  /** Copie du lien de défi (« Copier le lien ») ; défaut : presse-papiers puis repli execCommand. */
  copy?: (text: string) => Promise<boolean>;
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
  /** V7 : centrale audio (un seul contexte : musique, effets, interface). Absente : sons d'avant. */
  audio?: AudioHub;
  /** V7 : lecteur de musique (pistes procédurales). Absent : pas de musique. */
  music?: MusicPlayer;
  /** V7 : journal de diagnostic local (Réglages → Diagnostic). */
  diagnostics?: Diagnostics;
  /** V7 : caractéristiques de l'appareil pour le rapport de diagnostic. */
  deviceInfo?: () => DeviceInfo;
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
  /** Inspection (tests) : aperçus vivants suivis et boucle d'animation active. */
  readonly previews: { watched: number; running: boolean };
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
/** Tampons de fin de partie (variété cosmétique, sans effet sur le jeu). */
const STAMPS = ['CRASH !', 'BOUM !', 'PATATRAS !'] as const;
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
  const hub = options.audio ?? null;
  const music = options.music ?? null;
  const diag = options.diagnostics ?? null;
  const uiSound = options.uiSound ?? (hub ? createHubUiSound(hub) : createUiSound(doc.defaultView as never));
  /**
   * V7 : piste voulue. Musique coupée : aucune (rien n'est rendu). Sinon la musique de l'univers
   * choisi, ou la musique équipée selon le réglage. Appliquée tout de suite, avec fondu.
   */
  const desiredTrack = (): string | null => {
    if (!prefs.music) return null;
    if (prefs.musicSource === 'equipee') return equippedMusic(progress);
    return universeTrack(progress.selected.theme) ?? equippedMusic(progress);
  };
  const syncAudio = () => {
    hub?.setMusic(prefs.music, prefs.musicVolume);
    hub?.setSfx(!prefs.muted, prefs.volume);
    music?.want(desiredTrack());
  };
  const savePrefs = (next: Partial<Prefs>) => {
    prefs = sanitizePrefs({ ...prefs, ...next });
    store.writePrefs(prefs);
    applyPrefs(doc, prefs);
    run?.handle?.setAudio?.(!prefs.muted, prefs.volume);
    syncAudio();
    animator.refresh();
  };
  /** Ce que le moteur reçoit : `reducedMotion` absent = le moteur suit l'appareil en direct. */
  const gamePrefs = (): ShellPrefs => ({
    muted: prefs.muted,
    volume: prefs.volume,
    effects: prefs.effects,
    ...(prefs.motion === 'system' ? {} : { reducedMotion: prefs.motion === 'reduce' }),
  });
  syncAudio();
  const fx = {
    haptic(kind: HapticKind) {
      if (prefs.haptics) haptics.vibrate(HAPTIC_PATTERNS[kind]);
    },
    sound(kind: UiSoundKind) {
      if (!prefs.muted) uiSound.play(kind, prefs.volume);
    },
  };

  // --- V6 : aperçus vivants (boucle partagée, arrêtée en animations réduites et mode Fluide) ---
  // Même règle que l'interface (applyPrefs pose data-motion : choix du joueur ou de l'appareil).
  const motionReduced = () => doc.documentElement.dataset.motion === 'reduce';
  const animator = createPreviewAnimator(doc.defaultView as (Window & typeof globalThis) | null, () => prefs.effects === 'full' && !motionReduced());
  const animate = (canvas: HTMLCanvasElement, draw: (time: number | undefined) => void) => animator.watch(canvas, draw);

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
    // V7 : une écoute de musique s'arrête dès qu'on quitte l'écran (jamais deux pistes à la fois).
    if (changed) music?.stopPreview();
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
    const tab = (TAB_SCREENS as readonly string[]).includes(next) ? (next as TabScreen) : null;
    if (tab) lastTab = tab;
    const content = children.filter((c): c is HTMLElement => c !== null);
    if (tab) {
      // V6 : chaque écran de menu a la même barre du haut et la même barre d'onglets.
      const main = el(doc, 'div', { class: 'screen-body' });
      main.append(...content);
      view.replaceChildren(topBar(), main, tabBar(tab));
    } else {
      view.replaceChildren(...content);
    }
    view.dataset.tabs = tab ? 'true' : 'false';
    // Les aperçus de l'écran précédent sont oubliés : rien ne continue de tourner.
    animator.prune();
    // V7 : boutons « Écouter » de l'écran affiché alignés sur l'état réel du lecteur (l'écoute de
    // l'écran précédent vient d'être arrêtée, après la construction de ce nouvel écran).
    if (changed) refreshListen();
    // Nouvel écran : on repart du haut (pas la position de défilement de l'écran précédent).
    if (changed) {
      try {
        doc.defaultView?.scrollTo?.(0, 0);
      } catch {
        // jsdom ou contexte sans défilement : sans conséquence.
      }
    }
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

  /** Interrupteur des effets sonores (Réglages et Pause) : appliqué tout de suite, y compris en partie. */
  const soundToggle = (onChange?: () => void, label = 'Effets sonores') =>
    switchButton(doc, {
      label,
      checked: !prefs.muted,
      testId: 'sound-toggle',
      onChange: (on) => {
        savePrefs({ muted: !on });
        if (on) fx.sound('tap');
        onChange?.();
      },
    });

  /** V7 : interrupteur de la musique (Réglages et Pause), indépendant des effets sonores. */
  const musicToggle = (onChange?: () => void) =>
    switchButton(doc, {
      label: 'Musique',
      checked: prefs.music,
      testId: 'music-toggle',
      onChange: (on) => {
        hub?.unlock();
        savePrefs({ music: on });
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

  /** En-tête d'écran : titre ; bouton Retour seulement hors des onglets (Réglages). */
  const screenHeader = (titleText: string, onBack?: () => void) => {
    const h = el(doc, 'h1', { tabindex: '-1', class: 'screen-title' }, titleText);
    const header = el(doc, 'div', { class: 'screen-header' });
    if (onBack) header.append(iconOnlyButton(doc, { icon: 'back', label: 'Retour', onClick: onBack, testId: 'back' }), h);
    else header.append(h);
    return { header, title: h };
  };
  /** Dernier onglet ouvert : Réglages y ramène. */
  let lastTab: TabScreen = 'home';
  const openTab = (tab: TabScreen) => {
    if (tab === 'shop') renderShop();
    else if (tab === 'collection') renderCollectionScreen();
    else if (tab === 'season') renderSeason();
    else if (tab === 'leaderboard') renderLeaderboard();
    else renderHome();
  };
  /** Retour vers le dernier onglet, focus rendu au bouton qui avait ouvert l'écran. */
  const backToTab = (testId: string) => () => {
    openTab(lastTab);
    view.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();
  };

  /** Bande des 7 jours du cadeau : jours déjà récupérés, jour du jour, jours à venir. */
  const calendarStrip = (canClaim: boolean) => {
    const index = progress.calendar.index;
    // Après le 7e jour, l'index repart à 0 : si le cadeau du jour est déjà pris, tout est coché.
    const doneCount = canClaim ? index : index === 0 && progress.calendar.lastClaimDate ? 7 : index;
    const strip = el(doc, 'ol', { class: 'calendar', 'aria-label': 'Les 7 jours du cadeau' });
    CALENDAR_REWARDS.forEach((amount, i) => {
      const done = i < doneCount;
      const today = canClaim && i === index;
      const li = el(doc, 'li', { class: `cal-day${done ? ' done' : ''}${today ? ' today' : ''}`, 'aria-label': `Jour ${i + 1} : ${amount} pièces${done ? ', récupéré' : today ? ', aujourd’hui' : ''}` });
      li.append(el(doc, 'span', {}, `J${i + 1}`), icon(doc, done ? 'check' : 'coin'), el(doc, 'span', {}, `+${amount}`));
      strip.append(li);
    });
    return strip;
  };

  /** Écran Passe, section Missions : cadeau du jour, niveau, missions (progression locale). */
  const missionsParts = (): HTMLElement[] => {
    const day = utcDateKey(today());
    const gift = el(doc, 'section', { class: 'card', 'aria-labelledby': 'gift-title' });
    const status = calendarStatus(progress, day);
    gift.append(cardTitle(doc, 'gift', 'Cadeau du jour', 'gift-title'), calendarStrip(status.canClaim));
    gift.append(el(doc, 'p', { 'data-testid': 'calendar', tabindex: '-1', class: 'hint' },
      status.canClaim ? `+${status.reward} pièces (jour ${status.dayInCycle} sur 7)` : 'Déjà récupéré aujourd’hui. Reviens demain !'));
    if (status.canClaim) {
      gift.append(uiButton(doc, {
        label: `Récupérer +${status.reward}`,
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
            announce('Cadeau du jour déjà récupéré.');
          }
          if (screen === 'season') renderSeason('calendar');
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
    // V8 : prime du jour (3 premières parties d'au moins 5 étages).
    const bonusLeft = dailyBonusLeft(progress, utcDateKey(today()));
    level.append(el(doc, 'p', { class: 'hint small', 'data-testid': 'daily-bonus' }, bonusLeft > 0
      ? `Prime du jour : +${DAILY_BONUS[0]} pièces pour ${bonusLeft === DAILY_BONUS.length ? 'tes' : 'les'} ${bonusLeft} prochaine${bonusLeft > 1 ? 's' : ''} partie${bonusLeft > 1 ? 's' : ''} d’au moins ${DAILY_BONUS_MIN_HEIGHT} étages.`
      : 'Prime du jour récupérée. Elle revient demain.'));

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
    return [gift, level, goalsPanel, note];
  };

  // --- Passe de saison (V3-A5 ; V6 : 30 niveaux, deux pistes) ----------------------------------
  const season = options.season ?? SEASON_1;
  const canDraw = (r: SeasonReward) => (r.kind === 'skin' ? isAnySkinId(r.id) : r.kind === 'theme' ? isThemeId(r.id) : true);
  const formatSeasonDay = (key: string) =>
    new Date(`${key}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const claimableTiers = () => {
    const day = utcDateKey(today());
    return season.tiers.filter((t) => tierStatus(progress, season, t, 'free', day, canDraw) === 'claimable');
  };
  const seasonClaimable = () => claimableTiers().length > 0;
  const rewardText = (r: SeasonReward) => (r.kind === 'coins' ? `+${r.amount} pièces` : `${r.kind === 'skin' ? 'Matière' : 'Univers'} ${r.name}`);
  const rewardItem = (r: SeasonReward) => (r.kind === 'coins' ? undefined : catalogItem(r.kind, r.id));
  let seasonTab: 'pass' | 'missions' = 'pass';

  /** Visuel d'une récompense : aperçu vivant d'un cosmétique, ou pièce et montant. */
  const rewardVisual = (r: SeasonReward, size: { width: number; height: number }) => {
    if (r.kind === 'coins') {
      const v = el(doc, 'div', { class: 'swatch coin-art', 'aria-hidden': 'true' });
      v.append(icon(doc, 'coin'), el(doc, 'span', {}, `+${r.amount}`));
      return v;
    }
    const appearance = (r.kind === 'skin'
      ? { theme: progress.selected.theme, skin: r.id }
      : { theme: r.id, skin: progress.selected.skin }) as AnyAppearance;
    return previewOrSwatch(doc, r.id, appearance, renderAppearancePreview, { animate, climb: r.kind === 'theme', material: r.kind === 'skin', size });
  };

  const claimTier = (tier: number, track: Track) => withProgressLock(() => {
    const r = updateDoc((current) => {
      const c = claimSeasonTier(current, season, tier, track, utcDateKey(today()), canDraw);
      return { doc: c.doc, result: c };
    });
    const text = r.ok ? `Récupéré : ${rewardText(r.reward)}.` : r.reason === 'claimed' ? 'Déjà récupéré.' : 'Pas encore disponible.';
    announce(text);
    if (r.ok) {
      fx.sound('reward');
      fx.haptic('reward');
    }
    if (screen === 'season') renderSeason(`tier-${tier}`, text);
    const item = r.ok ? rewardItem(r.reward) : undefined;
    if (item) revealItem(item);
  });

  const claimAll = () => withProgressLock(() => {
    const got = updateDoc((current) => {
      const c = claimAllFree(current, season, utcDateKey(today()), canDraw);
      return { doc: c.doc, result: c.rewards };
    });
    const coins = got.reduce((sum, r) => sum + (r.kind === 'coins' ? r.amount : 0), 0);
    const items = got.map(rewardItem).filter((i): i is CatalogItem => !!i);
    const text = got.length === 0
      ? 'Rien à récupérer pour l’instant.'
      : `Récupéré : ${[coins > 0 ? `+${coins} pièces` : '', ...items.map((i) => i.name)].filter(Boolean).join(', ')}.`;
    announce(text);
    if (got.length > 0) {
      fx.sound('reward');
      fx.haptic('reward');
    }
    if (screen === 'season') renderSeason('season-level', text);
    const best = [...items].sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity))[0];
    if (best) revealItem(best);
  });

  /** Une cellule de piste : visuel, récompense, rareté, état écrit et pictogramme. */
  const tierCell = (t: SeasonTier, track: Track, stars: number, day: string) => {
    const reward = track === 'free' ? t.free : t.premium;
    const st = tierStatus(progress, season, t, track, day, canDraw);
    const cell = el(doc, 'div', { class: `tier-cell ${track} ${st}`, 'data-testid': `tier-${t.tier}-${track}` });
    cell.append(rewardVisual(reward, { width: 96, height: 48 }), el(doc, 'p', { class: 'tier-reward' }, rewardText(reward)));
    const item = rewardItem(reward);
    if (item) cell.append(rarityChip(doc, item.rarity));
    const remaining = t.stars - stars;
    if (st === 'claimable') {
      cell.append(uiButton(doc, { label: 'Récupérer', variant: 'primary', size: 'sm', testId: `claim-tier-${t.tier}`, ariaLabel: `Récupérer le niveau ${t.tier} : ${rewardText(reward)}`, onClick: () => claimTier(t.tier, track) }));
    } else {
      const line: Record<Exclude<TierStatus, 'claimable'>, [IconName, string]> = {
        claimed: ['check', 'Récupéré'],
        locked: ['lock', `Verrouillé · ${remaining} ★`],
        soon: ['clock', 'Bientôt'],
        'premium-unavailable': ['lock', 'Premium'],
        ended: ['clock', 'Saison finie'],
      };
      const [ic, label] = line[st];
      cell.append(stateLine(doc, ic, label, `tier-state ${st}`));
    }
    return cell;
  };

  /** Écran du passe : niveau, prochaines récompenses, offre premium, piste ; ou les missions. */
  const renderSeason = (focusTestId?: string, notice?: string) => {
    const { header, title } = screenHeader(`Passe · ${season.name}`);
    const parts: HTMLElement[] = [header];
    parts.push(segmented(doc, {
      label: 'Section du passe',
      testId: 'season-tabs',
      value: seasonTab,
      options: [
        { value: 'pass', label: 'Saison' },
        { value: 'missions', label: 'Missions et cadeau' },
      ],
      onChange: (v) => {
        if (v === seasonTab) return; // section déjà ouverte : rien à redessiner
        seasonTab = v;
        renderSeason(); // focus sur le titre, comme à chaque écran : la nouvelle section est annoncée
      },
    }));
    if (notice) parts.push(el(doc, 'p', { class: 'notice ok', role: 'status', 'data-testid': 'season-notice' }, notice));
    if (seasonTab === 'missions') {
      parts.push(...missionsParts());
      show('season', parts, title);
      if (focusTestId) view.querySelector<HTMLElement>(`[data-testid="${focusTestId}"]`)?.focus();
      return;
    }
    const day = utcDateKey(today());
    const phase = seasonPhase(season, day);
    const stars = seasonState(progress, season).stars;
    const lv = seasonLevel(progress, season);

    const hero = el(doc, 'section', { class: 'card pass-hero', 'aria-labelledby': 'season-level' });
    const levelTitle = el(doc, 'h2', { class: 'pass-level', id: 'season-level', 'data-testid': 'season-level', tabindex: '-1' });
    levelTitle.append(el(doc, 'span', { class: 'pass-level-word' }, 'Niveau'), el(doc, 'span', { class: 'pass-level-num' }, String(lv.level)), el(doc, 'span', { class: 'pass-level-max' }, `/ ${lv.max}`));
    const starsLine = el(doc, 'p', { class: 'hint', 'data-testid': 'season-stars' });
    starsLine.append(icon(doc, 'star'), el(doc, 'span', {}, ` ${stars} étoile${stars > 1 ? 's' : ''} de saison`));
    hero.append(levelTitle, starsLine);
    let summary: string;
    if (phase === 'upcoming') summary = `Commence le ${formatSeasonDay(season.start)}.`;
    else if (phase === 'ended') summary = 'Saison finie. Tes cosmétiques restent à toi.';
    else if (lv.next) summary = `${lv.span - lv.into} étoile${lv.span - lv.into > 1 ? 's' : ''} avant le niveau ${lv.level + 1} · jusqu’au ${formatSeasonDay(season.end)}`;
    else summary = 'Niveau maximal atteint. Bravo !';
    if (lv.next && phase === 'active') hero.append(progressBar(doc, lv.into / lv.span, `Vers le niveau ${lv.level + 1}`, 'gold'));
    hero.append(el(doc, 'p', { class: 'hint small', 'data-testid': 'season-summary' }, summary));
    hero.append(el(doc, 'p', { class: 'hint small' }, 'Les étoiles se gagnent en jouant : étages posés et parfaits.'));
    if (phase === 'active') {
      // V8 : le passe avance d'au plus SEASON_DAILY_STARS étoiles par jour (régularité).
      const left = seasonStarsLeftToday(progress, season, day);
      hero.append(el(doc, 'p', { class: 'hint small', 'data-testid': 'season-today' }, left > 0
        ? `Aujourd’hui : encore ${left} étoile${left > 1 ? 's' : ''} de passe sur ${SEASON_DAILY_STARS}.`
        : `Plafond du jour atteint (${SEASON_DAILY_STARS} étoiles). Le passe repart demain.`));
    }
    const ready = claimableTiers().length;
    if (ready > 0) {
      hero.append(uiButton(doc, {
        label: ready > 1 ? `Tout récupérer (${ready})` : 'Récupérer (1)',
        icon: 'gift',
        variant: 'primary',
        block: true,
        testId: 'claim-all',
        onClick: () => claimAll(),
      }));
    }
    parts.push(hero);

    // Prochaines récompenses cosmétiques (gratuites et premium).
    const upcoming = season.tiers
      .filter((t) => t.stars > stars)
      .flatMap((t) => (['free', 'premium'] as const).map((track) => ({ t, track, reward: track === 'free' ? t.free : t.premium })))
      .filter((x) => x.reward.kind !== 'coins')
      .slice(0, 3);
    if (upcoming.length > 0) {
      const next = el(doc, 'section', { class: 'card', 'aria-labelledby': 'next-title', 'data-testid': 'season-next' });
      const list = el(doc, 'ul', { class: 'next-rewards' });
      for (const { t, track, reward } of upcoming) {
        const item = rewardItem(reward);
        const li = el(doc, 'li', { class: `next-reward ${track}` });
        li.append(rewardVisual(reward, { width: 120, height: 56 }), el(doc, 'p', { class: 'item-name' }, item?.name ?? rewardText(reward)));
        if (item) li.append(rarityChip(doc, item.rarity));
        li.append(el(doc, 'p', { class: 'item-meta' }, `Niveau ${t.tier} · ${track === 'free' ? 'Gratuit' : 'Premium'}`));
        list.append(li);
      }
      next.append(cardTitle(doc, 'sparkles', 'Prochaines récompenses', 'next-title'), list);
      parts.push(next);
    }

    // Offre premium : préparée et détaillée, jamais présentée comme achetable.
    const exclusives = season.tiers.map((t) => t.premium).map(rewardItem).filter((i): i is CatalogItem => !!i);
    const offer = el(doc, 'section', { class: 'card premium-offer', 'aria-labelledby': 'premium-title', 'data-testid': 'premium-offer' });
    const offerList = el(doc, 'ul', { class: 'premium-items' });
    for (const item of byRarity(exclusives).reverse()) {
      const li = el(doc, 'li', {});
      li.append(el(doc, 'span', { class: 'item-name' }, item.name), rarityChip(doc, item.rarity));
      offerList.append(li);
    }
    const money = el(doc, 'p', { class: 'money-note', 'data-testid': 'premium-note' });
    money.append(icon(doc, 'money'), el(doc, 'span', {}, 'Argent réel. Le paiement n’est pas encore ouvert : rien n’est en vente pour l’instant.'));
    const soon = uiButton(doc, { label: 'Bientôt disponible', variant: 'ghost', block: true, testId: 'premium-soon', onClick: () => undefined });
    soon.disabled = true;
    offer.append(
      cardTitle(doc, 'crown', 'Passe premium', 'premium-title'),
      el(doc, 'p', { class: 'hint small' }, `${exclusives.length} cosmétiques exclusifs, dont ${exclusives.filter((i) => i.rarity === 'legendaire').length} légendaires, et des pièces à chaque niveau.`),
      offerList,
      money,
      soon,
    );
    parts.push(offer);

    const head = el(doc, 'div', { class: 'track-head', 'aria-hidden': 'true' });
    head.append(el(doc, 'span', {}, 'Niveau'), el(doc, 'span', {}, 'Gratuit'), el(doc, 'span', {}, 'Premium'));
    parts.push(head);
    const list = el(doc, 'ol', { class: 'tiers', 'aria-label': 'Niveaux du passe' });
    for (const t of season.tiers) {
      const li = el(doc, 'li', { class: `tier${stars >= t.stars ? ' reached' : ''}`, 'data-testid': `tier-${t.tier}`, tabindex: '-1' });
      const node = el(doc, 'p', { class: 'tier-node', 'aria-label': `Niveau ${t.tier}, ${t.stars} étoiles` });
      node.append(el(doc, 'span', {}, String(t.tier)), el(doc, 'small', {}, `${t.stars}★`));
      li.append(node, tierCell(t, 'free', stars, day), tierCell(t, 'premium', stars, day));
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
    const { header, title } = screenHeader('Réglages', backToTab('nav-settings'));

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

    // V7 : musique et effets sonores réglés séparément, appliqués tout de suite et gardés.
    const musicRow = el(doc, 'div', { class: 'range-row' });
    const musicVolume = rangeInput(doc, {
      label: 'Volume de la musique',
      value: prefs.musicVolume * 100,
      testId: 'music-volume',
      disabled: !prefs.music,
      onCommit: (v) => savePrefs({ musicVolume: v / 100 }),
    });
    musicRow.append(icon(doc, 'mute'), musicVolume, icon(doc, 'sound'));
    const equippedName = catalogItem('music', equippedMusic(progress))?.name ?? '';
    const musicCard = settingsCard('music', 'Musique', 'set-music',
      musicToggle(() => {
        musicVolume.disabled = !prefs.music;
      }),
      musicRow,
      segmented(doc, {
        label: 'Musique en partie',
        testId: 'music-source',
        value: prefs.musicSource,
        options: [
          { value: 'univers', label: 'De l’univers' },
          { value: 'equipee', label: 'Ma musique' },
        ],
        onChange: (v) => savePrefs({ musicSource: v }),
      }),
      el(doc, 'p', { class: 'hint small', 'data-testid': 'music-equipped' }, `Ta musique : ${equippedName}. Écoute et équipe tes musiques dans Collection.`),
    );

    const volumeRow = el(doc, 'div', { class: 'range-row' });
    const volume = rangeInput(doc, {
      label: 'Volume des effets',
      value: prefs.volume * 100,
      testId: 'volume',
      disabled: prefs.muted,
      onCommit: (v) => {
        savePrefs({ volume: v / 100 });
        fx.sound('tap');
      },
    });
    volumeRow.append(icon(doc, 'mute'), volume, icon(doc, 'sound'));
    const sound = settingsCard('sound', 'Effets sonores', 'set-sound',
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

    const diagnostic = diagnosticCard();
    const help = uiButton(doc, { label: 'Comment jouer', icon: 'help', variant: 'ghost', block: true, testId: 'open-howto', onClick: () => openHowTo() });
    const note = el(doc, 'p', { class: 'hint small center' }, 'Tes réglages restent sur cet appareil.');
    // Licences de la police et des icônes, livrées avec le jeu (OFL 1.1, ISC, MIT).
    const credits = el(doc, 'p', { class: 'hint small center' });
    const creditsLink = el(doc, 'a', { href: 'licences-tiers.txt', class: 'credits', 'data-testid': 'credits', target: '_blank', rel: 'noopener' }, 'Crédits : police Fredoka, icônes Lucide');
    credits.append(creditsLink);
    const musicCredits = el(doc, 'p', { class: 'hint small center', 'data-testid': 'music-credits' }, 'Musiques : compositions originales de Stack or Crash, jouées par le synthétiseur du jeu (aucun fichier externe).');
    show('settings', [header, theme, musicCard, sound, vibration, motion, effects, diagnostic, help, note, credits, musicCredits], title);
  };

  /**
   * V7 : journal de diagnostic local. Rien n'est envoyé : le joueur copie le rapport s'il veut le
   * joindre à un signalement (exceptions, blocages, rechargements pendant une partie, contexte
   * graphique, son).
   */
  const diagnosticCard = () => {
    const entries = diag?.entries() ?? [];
    const last = entries[entries.length - 1];
    const summary = entries.length === 0
      ? 'Aucun incident enregistré sur cet appareil.'
      : `${entries.length} incident${entries.length > 1 ? 's' : ''} enregistré${entries.length > 1 ? 's' : ''} (dernier : ${last!.kind}).`;
    const status = el(doc, 'p', { role: 'status', class: 'hint small', 'data-testid': 'diag-status' });
    const copy = uiButton(doc, {
      label: 'Copier le rapport', icon: 'copy', variant: 'secondary', block: true, testId: 'diag-copy',
      onClick: () => {
        if (!diag) return;
        const report = diag.report(options.deviceInfo?.() ?? {});
        void (options.copy ?? ((t: string) => copyText(t)))(report).then((ok) => {
          status.textContent = ok ? 'Rapport copié. Colle-le dans ton message de signalement.' : 'Copie impossible ici : sélectionne le rapport ci-dessous.';
          if (!ok) {
            const area = el(doc, 'textarea', { class: 'diag-report', readonly: '', rows: '8', 'aria-label': 'Rapport de diagnostic', 'data-testid': 'diag-report' });
            area.value = report;
            status.after(area);
            area.select();
          }
          announce(status.textContent);
        });
      },
    });
    const clear = uiButton(doc, {
      label: 'Effacer le journal', variant: 'ghost', block: true, testId: 'diag-clear',
      onClick: () => {
        diag?.clear();
        renderSettings();
        announce('Journal effacé.');
      },
    });
    if (!diag) {
      copy.disabled = true;
      clear.disabled = true;
    }
    return settingsCard('activity', 'Diagnostic', 'set-diag',
      el(doc, 'p', { 'data-testid': 'diag-summary' }, summary),
      el(doc, 'p', { class: 'hint small' }, 'En cas de plantage, ce journal aide à comprendre la cause. Il reste sur ton appareil ; rien n’est envoyé.'),
      copy, clear, status,
    );
  };

  /** Fenêtre « Comment jouer » : six étapes, des mots simples. */
  const openHowTo = () => {
    const steps: [IconName, string][] = [
      ['hand', 'Touche l’écran pour poser le bloc qui bouge.'],
      ['target', 'Pose-le bien au-dessus : ce qui dépasse tombe.'],
      ['sparkles', 'Un bloc parfait donne plus de points et remplit la jauge Super.'],
      ['zap', 'Jauge pleine = un boost, à tour de rôle : Ralenti (plus lent), Aimant (les blocs se collent), Bouclier (un raté rattrapé).'],
      ['flame', '5 parfaits d’affilée = Fièvre : points ×2 tant que tu restes parfait !'],
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

  const shopConfig = options.shop ?? { catalog: COIN_SHOP, isAvailable: (id: string) => isAnySkinId(id) || isThemeId(id) || isTrackId(id) };
  /** Objets vendables (calculés une fois : la sélection du jour s'appuie sur cette liste). */
  let sellableMemo: ShopItem[] | null = null;
  const sellableCatalog = () => (sellableMemo ??= sellableItems(shopConfig.catalog, shopConfig.isAvailable));
  const shopPreview = shopConfig.preview ?? renderAppearancePreview;

  type ShopNotice = { text: string; testId: string };
  /** Achat confirmé en cours (bouton « Achat… » désactivé, aucun second débit possible). */
  let pendingPurchase: string | null = null;

  /** Apparence montrée par l'aperçu d'un objet (l'autre moitié reste celle du joueur). */
  const appearanceOf = (kind: 'skin' | 'theme' | 'music', id: string): AnyAppearance => (kind === 'skin'
    ? { theme: progress.selected.theme, skin: id }
    : { theme: id, skin: progress.selected.skin }) as AnyAppearance;

  /** Bouton d'achat : le prix est dans le bouton ; états solde insuffisant et achat en cours. */
  const buyButton = (name: string, price: number, testId: string, onBuy: () => void, pending: boolean) => {
    if (pending) {
      const b = uiButton(doc, { label: 'Achat…', variant: 'primary', size: 'sm', block: true, testId, onClick: () => undefined });
      b.disabled = true;
      b.setAttribute('aria-busy', 'true');
      return b;
    }
    if (progress.coins < price) {
      const missing = price - progress.coins;
      const b = uiButton(doc, { label: `Il manque ${missing}`, variant: 'ghost', size: 'sm', block: true, testId, ariaLabel: `Solde insuffisant : il manque ${missing} pièces du jeu pour ${name}`, onClick: () => undefined });
      b.append(icon(doc, 'coin'));
      b.disabled = true;
      b.classList.add('short');
      return b;
    }
    const b = uiButton(doc, { label: `Acheter · ${price}`, variant: 'primary', size: 'sm', block: true, testId, ariaLabel: `Acheter ${name} pour ${price} pièces du jeu`, onClick: onBuy });
    b.append(icon(doc, 'coin'));
    return b;
  };

  /** Fenêtre de confirmation d'achat : rien n'est débité avant la confirmation. */
  const confirmPurchase = (opts: { title: string; name: string; price: number; art?: HTMLElement; extra?: HTMLElement[]; onYes: () => void; yesTestId: string; noTestId: string }) => {
    const yes = uiButton(doc, { label: `Oui, acheter · ${opts.price}`, variant: 'primary', block: true, testId: opts.yesTestId, ariaLabel: `Confirmer l’achat de ${opts.name} pour ${opts.price} pièces du jeu`, onClick: () => { closeSheet(); opts.onYes(); } });
    yes.append(icon(doc, 'coin'));
    const no = uiButton(doc, { label: 'Annuler', variant: 'ghost', block: true, testId: opts.noTestId, onClick: () => closeSheet() });
    const body: HTMLElement[] = [];
    if (opts.art) {
      const box = el(doc, 'div', { class: 'art item-visual' });
      box.append(opts.art);
      body.push(box);
    }
    body.push(...(opts.extra ?? []));
    const left = progress.coins - opts.price;
    body.push(el(doc, 'p', { 'data-testid': 'confirm-text' }, `Prix : ${opts.price} pièces du jeu. Il t’en restera ${left}.`));
    openDialog({ title: opts.title, body, actions: [yes, no], testId: 'confirm', initialFocus: yes });
  };

  /** V7 : visuel d'une musique (disque aux couleurs de la rareté). */
  const musicArt = (item: CatalogItem, large = false) => {
    const art = el(doc, 'div', { class: `music-art${large ? ' large' : ''}`, 'data-rarity': item.rarity, 'aria-hidden': 'true' });
    const disc = el(doc, 'span', { class: 'music-disc' });
    disc.append(icon(doc, 'music'));
    art.append(disc);
    return art;
  };

  /**
   * V7 : bouton « Écouter » / « Arrêter » d'une musique. Une seule écoute à la fois : en lancer une
   * arrête la précédente ; quitter l'écran l'arrête aussi. Musique coupée : bouton indisponible.
   */
  const listenButton = (item: CatalogItem) => {
    const st = music?.state;
    const playing = st?.previewing === item.id;
    const loading = playing && st?.loading === item.id;
    const off = !music || !prefs.music;
    const b = uiButton(doc, {
      label: off ? 'Musique coupée' : loading ? 'Chargement…' : playing ? 'Arrêter' : 'Écouter',
      icon: playing ? 'stop' : 'listen',
      variant: 'secondary',
      size: 'sm',
      block: true,
      testId: `listen-${item.id}`,
      ariaLabel: off ? `Écoute indisponible : la musique est coupée dans Réglages` : playing ? `Arrêter l’écoute de ${item.name}` : `Écouter ${item.name}`,
      onClick: () => {
        if (!music || off) return;
        if (music.state.previewing === item.id) music.stopPreview();
        else {
          hub?.unlock();
          music.preview(item.id);
        }
        refreshListen();
      },
    });
    b.dataset.listen = item.id;
    b.setAttribute('aria-pressed', playing ? 'true' : 'false');
    if (off) b.disabled = true;
    return b;
  };
  /** Met à jour les boutons d'écoute visibles (état du lecteur), sans redessiner l'écran. */
  const refreshListen = () => {
    for (const b of [...view.querySelectorAll<HTMLButtonElement>('button[data-listen]')]) {
      const item = catalogItem('music', b.dataset.listen ?? '');
      if (!item) continue;
      const focused = doc.activeElement === b;
      const fresh = listenButton(item);
      b.replaceWith(fresh);
      if (focused) fresh.focus();
    }
  };
  const unsubscribeMusic = music?.subscribe((st: PlayerState) => {
    void st;
    refreshListen();
  }) ?? (() => undefined);

  /** Fenêtre « C'est à toi ! » : l'objet obtenu, animé, avec Équiper tout de suite ou plus tard. */
  const revealItem = (item: CatalogItem) => {
    const art = el(doc, 'div', { class: 'art item-visual reveal-art' });
    if (item.kind === 'music') art.append(musicArt(item, true));
    else art.append(previewOrSwatch(doc, item.id, appearanceOf(item.kind, item.id), renderAppearancePreview, { animate, climb: item.kind === 'theme', material: item.kind === 'skin', size: { width: 280, height: 140 } }));
    const equipped = item.kind === 'skin' ? progress.selected.skin === item.id
      : item.kind === 'theme' ? progress.selected.theme === item.id
        : equippedMusic(progress) === item.id && prefs.musicSource === 'equipee';
    const equip = uiButton(doc, {
      label: 'Équiper maintenant',
      icon: 'check',
      variant: 'primary',
      block: true,
      testId: 'reveal-equip',
      onClick: () => {
        closeSheet();
        equipItem(item);
      },
    });
    const later = uiButton(doc, { label: 'Plus tard', variant: 'ghost', block: true, testId: 'reveal-later', onClick: () => closeSheet() });
    openDialog({
      title: item.kind === 'skin' ? 'Nouvelle matière !' : item.kind === 'theme' ? 'Nouvel univers !' : 'Nouvelle musique !',
      body: [
        art,
        el(doc, 'p', { class: 'reveal-name', 'data-testid': 'reveal-name' }, item.name),
        rarityChip(doc, item.rarity),
        el(doc, 'p', { class: 'hint' }, item.blurb),
        el(doc, 'p', { class: 'hint small' }, item.kind === 'music' ? 'Composition originale du jeu. Elle se joue en partie quand elle est équipée.' : RARITY_INFO[item.rarity].promise),
      ],
      actions: equipped ? [later] : [equip, later],
      testId: 'reveal',
      initialFocus: equipped ? later : equip,
    });
    if (prefs.effects === 'full') confetti(doc, root);
  };

  /** Équipe un cosmétique possédé ; confirmation visible et lue, focus gardé sur la carte. */
  const equipItem = (item: CatalogItem) => withProgressLock(() => {
    if (item.kind === 'music') {
      const changed = updateDoc((current) => {
        const next = equipMusic(current, item.id);
        return { doc: next, result: next !== current };
      });
      const switchSource = prefs.musicSource !== 'equipee';
      if (!changed && !switchSource) return;
      // Équiper une musique, c'est vouloir l'entendre : elle remplace la musique des univers.
      if (switchSource) savePrefs({ musicSource: 'equipee' });
      else syncAudio();
      fx.haptic('tap');
      announce(`${item.name} est ta musique. Elle remplace la musique des univers ; tu peux revenir à celle de l’univers dans Réglages.`);
      showToast(doc, root, `${item.name} équipée !`);
    } else {
      const changed = updateDoc((current) => {
        const next = item.kind === 'skin' ? selectAppearance(current, { skin: item.id as AnyAppearance['skin'] }) : selectAppearance(current, { theme: item.id as AnyAppearance['theme'] });
        const same = next.selected.theme === current.selected.theme && next.selected.skin === current.selected.skin;
        return { doc: same ? current : next, result: !same };
      });
      if (!changed) return;
      if (item.kind === 'theme') syncAudio(); // musique de l'univers, si c'est le réglage
      fx.haptic('tap');
      const text = `${item.name} est équipé${item.kind === 'theme' ? '' : 'e'} pour ta prochaine partie.`;
      announce(text);
      showToast(doc, root, `${item.name} équipé${item.kind === 'theme' ? '' : 'e'} !`);
    }
    const focus = `${screen === 'shop' ? 'shop' : 'card'}-${screen === 'shop' ? item.id : `${item.kind}-${item.id}`}`;
    if (screen === 'shop') renderShop({ focus });
    else if (screen === 'collection') renderCollectionScreen(focus);
    else if (screen === 'season') renderSeason();
    else if (screen === 'home') renderHome();
  });

  /** V7 : texte du renouvellement (compte à rebours et heure locale de minuit UTC). */
  const renewalText = (nowMs: number) =>
    `Nouvelle sélection ${untilRotation(nowMs)}, à ${rotationLocalTime(nowMs)} (heure de ton appareil).`;
  /** Jour de la sélection affichée (pour détecter le renouvellement pendant que l'écran est ouvert). */
  let shopDay = -1;

  /**
   * Boutique en pièces du jeu (V7 : sélection du jour) : 3 matières, 1 univers et 2 musiques,
   * renouvelés chaque jour à minuit UTC ; vies toujours en vente ; prix dans les boutons.
   */
  const renderShop = (state: { notice?: ShopNotice; focus?: string } = {}) => {
    const { header, title } = screenHeader('Boutique');
    const sellable = sellableCatalog();
    const nowMs = today().getTime();
    const day = rotationDay(nowMs);
    shopDay = day;
    const offers = dailySelection(day, sellable);
    const parts: HTMLElement[] = [header];

    const wallet = el(doc, 'section', { class: 'card wallet', 'data-testid': 'wallet' });
    const amount = el(doc, 'p', { class: 'wallet-amount' });
    amount.append(icon(doc, 'coin'), el(doc, 'span', {}, `${progress.coins}`), el(doc, 'span', { class: 'wallet-unit' }, ` pièce${progress.coins > 1 ? 's' : ''} du jeu`));
    wallet.append(amount, el(doc, 'p', { class: 'hint small' }, 'Les pièces se gagnent en jouant. Elles ne s’achètent pas avec de l’argent réel et n’ont aucune valeur en euros.'));
    parts.push(wallet);

    if (state.notice) {
      parts.push(el(doc, 'p', { class: `notice ${state.notice.testId.endsWith('success') || state.notice.testId === 'shop-worn' || state.notice.testId === 'shop-renewed' ? 'ok' : 'warn'}`, role: 'status', 'data-testid': state.notice.testId, tabindex: '-1' }, state.notice.text));
    }

    const daily = el(doc, 'section', { class: 'card daily-head', 'aria-labelledby': 'shop-daily-title', 'data-testid': 'shop-daily' });
    daily.append(
      cardTitle(doc, 'refresh', 'Sélection du jour', 'shop-daily-title'),
      el(doc, 'p', { class: 'hint', 'data-testid': 'shop-renewal' }, renewalText(nowMs)),
      el(doc, 'p', { class: 'hint small' }, 'Même sélection pour tout le monde, renouvelée chaque jour à la même heure. Elle change les offres, jamais tes objets : ce que tu possèdes reste dans ta collection.'),
    );
    parts.push(daily);

    const section = (kind: 'skin' | 'theme' | 'music', iconName: IconName, label: string) => {
      const box = el(doc, 'section', { class: 'card', 'aria-labelledby': `shop-${kind}-title`, 'data-testid': `shop-section-${kind}` });
      box.append(cardTitle(doc, iconName, label, `shop-${kind}-title`));
      const list = el(doc, 'ul', { class: 'items' });
      const ofKind = offers.filter((i) => i.kind === kind);
      const ordered = byRarity(ofKind.map((i) => catalogItem(i.kind, i.id)).filter((c): c is CatalogItem => !!c));
      for (const item of ordered) {
        const shopItem = ofKind.find((i) => i.id === item.id)!;
        const st = itemState(progress, shopItem);
        const equipped = st === 'owned' && (kind === 'skin' ? progress.selected.skin === item.id
          : kind === 'theme' ? progress.selected.theme === item.id
            : prefs.musicSource === 'equipee' && equippedMusic(progress) === item.id);
        const visual = kind === 'music'
          ? musicArt(item)
          : previewOrSwatch(doc, item.id, appearanceOf(kind, item.id), shopPreview, { animate, climb: kind === 'theme', material: kind === 'skin' });
        const tail: HTMLElement[] = [];
        if (kind === 'music') tail.push(listenButton(item));
        const fem = kind === 'music' ? 'e' : '';
        if (equipped) tail.push(stateLine(doc, 'check', `Équipé${fem}`, 'equipped'));
        else if (st === 'owned') {
          tail.push(stateLine(doc, 'check', `Possédé${fem}`, 'owned'), uiButton(doc, { label: 'Équiper', variant: 'secondary', size: 'sm', block: true, testId: `equip-${item.id}`, ariaLabel: `Équiper ${item.name}`, onClick: () => equipItem(item) }));
        } else {
          tail.push(buyButton(item.name, shopItem.price, `buy-${item.id}`, () => confirmPurchase({
            title: `Acheter ${item.name} ?`,
            name: item.name,
            price: shopItem.price,
            art: kind === 'music' ? musicArt(item, true) : previewOrSwatch(doc, item.id, appearanceOf(kind, item.id), shopPreview, { animate, climb: kind === 'theme', material: kind === 'skin', size: { width: 280, height: 140 } }),
            extra: [rarityChip(doc, item.rarity), el(doc, 'p', { class: 'hint' }, item.blurb)],
            onYes: () => startPurchase(shopItem, item, day),
            yesTestId: 'confirm-buy',
            noTestId: 'cancel-buy',
          }), pendingPurchase === item.id));
        }
        list.append(cosmeticCard(doc, item, visual, equipped ? 'equipped' : st === 'owned' ? 'owned' : 'locked', tail, `shop-${item.id}`));
      }
      if (ordered.length === 0) list.append(el(doc, 'li', { class: 'empty hint', 'data-testid': 'shop-empty' }, 'Rien à vendre aujourd’hui. Reviens demain !'));
      box.append(list);
      return box;
    };
    if (offers.length === 0) {
      const empty = el(doc, 'section', { class: 'card' });
      empty.append(el(doc, 'p', { 'data-testid': 'shop-empty' }, 'Rien à vendre pour l’instant. Reviens bientôt !'));
      parts.push(empty);
    } else {
      if (offers.some((i) => i.kind === 'skin')) parts.push(section('skin', 'palette', 'Matières'));
      if (offers.some((i) => i.kind === 'theme')) parts.push(section('theme', 'orbit', 'Univers'));
      if (offers.some((i) => i.kind === 'music')) parts.push(section('music', 'music', 'Musiques'));
    }
    parts.push(livesShopSection());
    parts.push(el(doc, 'p', { class: 'hint small center' }, 'Aucun tirage au hasard : tu vois exactement ce que tu achètes. Les cosmétiques ne changent jamais le score.'));
    show('shop', parts, title);
    if (state.focus) view.querySelector<HTMLElement>(`[data-testid="${state.focus}"]`)?.focus();
  };

  /**
   * V7 : renouvellement automatique si l'écran reste ouvert. Toutes les 30 s (et au retour sur la
   * page), le compte à rebours est mis à jour ; à minuit UTC, la nouvelle sélection s'affiche.
   * Aucune récompense n'est liée au renouvellement.
   */
  const checkRotation = () => {
    if (destroyed || screen !== 'shop') return;
    const nowMs = today().getTime();
    if (rotationDay(nowMs) !== shopDay && pendingPurchase === null) {
      renderShop({ notice: { text: 'Nouvelle sélection du jour !', testId: 'shop-renewed' } });
      announce('Nouvelle sélection du jour dans la boutique.');
      return;
    }
    const line = view.querySelector<HTMLElement>('[data-testid="shop-renewal"]');
    if (line) line.textContent = renewalText(nowMs);
  };
  const rotationTimer = setInterval(checkRotation, 30_000);
  void nextRotationAt;

  /** Vies de reprise en pièces : stock, prix dans le bouton, confirmation, maximum. */
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
      const b = buyButton('1 vie', LIFE_PRICE, 'buy-life', () => confirmPurchase({
        title: 'Acheter une vie ?', name: '1 vie', price: LIFE_PRICE, onYes: () => buyLifeNow(), yesTestId: 'confirm-life', noTestId: 'cancel-life',
      }), pendingPurchase === 'life');
      box.append(b);
    }
    return box;
  };

  const celebrate = (soundKind: UiSoundKind = 'coin') => {
    fx.sound(soundKind);
    fx.haptic('reward');
    if (prefs.effects === 'full') confetti(doc, root);
  };

  const buyLifeNow = () => {
    pendingPurchase = 'life';
    if (screen === 'shop') renderShop();
    withProgressLock(() => {
      const r = updateDoc((current) => {
        const b = buyLife(current);
        return { doc: b.doc, result: b };
      });
      pendingPurchase = null;
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
  };

  /**
   * Achat confirmé : bouton « Achat… » puis transaction unique sous le verrou de progression.
   * V7 : l'offre confirmée (objet, prix, jour) est vérifiée. Après minuit UTC, elle reste honorée
   * 5 minutes au prix confirmé ; au-delà, elle a expiré et rien n'est débité. Jamais un autre objet
   * ni un autre prix : le débit compare le prix du catalogue au prix confirmé.
   */
  const startPurchase = (shopItem: ShopItem, item: CatalogItem, offerDay: number) => {
    if (pendingPurchase !== null) return;
    const open = checkOpenOffer({ kind: shopItem.kind, id: shopItem.id, day: offerDay }, today().getTime(), sellableCatalog());
    if (!open.ok) {
      const notice: ShopNotice = { text: `L’offre ${item.name} a expiré : la sélection du jour a changé à ${rotationLocalTime(today().getTime() - 60_000)} (heure de ton appareil). Rien n’a été débité.`, testId: 'shop-expired' };
      announce(notice.text);
      fx.sound('error');
      if (screen === 'shop') renderShop({ notice, focus: notice.testId });
      return;
    }
    pendingPurchase = shopItem.id;
    if (screen === 'shop') renderShop();
    withProgressLock(() => {
      const result = updateDoc((current) => {
        const r = purchaseWithCoins(current, shopItem.id, shopConfig.catalog, shopItem.price);
        return { doc: r.doc, result: r };
      });
      pendingPurchase = null;
      const notice: ShopNotice = result.ok
        ? { text: `C’est à toi ! ${item.name} est dans ta collection.`, testId: 'shop-success' }
        : result.reason === 'owned'
          ? { text: `Tu as déjà ${item.name}.`, testId: 'shop-owned' }
          : result.reason === 'insufficient'
            ? { text: `Il te manque ${result.missing ?? 0} pièces pour ${item.name}.`, testId: 'shop-insufficient' }
            : result.reason === 'price-changed'
              ? { text: `Le prix de ${item.name} a changé. Rien n’a été débité.`, testId: 'shop-price-changed' }
              : { text: 'Cet objet n’est plus en vente.', testId: 'shop-unknown' };
      announce(notice.text);
      if (result.ok) {
        fx.sound('reward');
        fx.haptic('reward');
      } else fx.sound('error');
      if (screen === 'shop') renderShop({ notice, focus: notice.testId });
      if (result.ok) revealItem(item);
    });
  };

  /** Explication des raretés, en mots simples (jamais la couleur seule). */
  const openRarityHelp = () => {
    const list = el(doc, 'ul', { class: 'rarity-help' });
    for (const r of RARITIES) {
      const li = el(doc, 'li', {});
      li.append(rarityChip(doc, r), el(doc, 'span', {}, RARITY_INFO[r].promise));
      list.append(li);
    }
    const ok = uiButton(doc, { label: 'Compris', variant: 'primary', block: true, testId: 'rarity-ok', onClick: () => closeSheet() });
    openDialog({
      title: 'Les raretés',
      body: [
        list,
        el(doc, 'p', { class: 'hint small' }, 'La rareté décrit la réalisation de l’objet. Elle ne change jamais le score, les collisions ni le classement. Aucun objet ne se gagne au hasard.'),
      ],
      actions: [ok],
      testId: 'rarity-sheet',
    });
  };

  let collectionFilter: CollectionFilter = 'all';
  const renderCollectionScreen = (focusCard?: string) => {
    const { nodes, focus } = renderCollection(doc, progress, {
      onSelect: (next) => {
        const item = next.skin ? catalogItem('skin', next.skin) : next.theme ? catalogItem('theme', next.theme) : undefined;
        if (item) equipItem(item);
      },
      onFilter: (f) => {
        if (f === collectionFilter) return;
        collectionFilter = f;
        renderCollectionScreen();
        view.querySelector<HTMLElement>(`[data-testid="collection-filter-${f}"]`)?.focus();
      },
      onRarityHelp: () => openRarityHelp(),
    }, { filter: collectionFilter, ...(focusCard ? { focusCard } : {}), ...(options.shop?.preview ? { preview: options.shop.preview } : {}), animate });
    show('collection', [...nodes, musicCollection()], focus);
    if (focusCard?.startsWith('card-music-')) view.querySelector<HTMLElement>(`[data-testid="${focusCard}"]`)?.focus();
  };

  /**
   * V7 : musiques de la collection. Toutes visibles (avec leur provenance) ; les possédées
   * s'écoutent et s'équipent, même quand elles ne sont plus dans la sélection du jour.
   */
  const musicCollection = () => {
    const box = el(doc, 'section', { class: 'card', 'aria-labelledby': 'col-music-title', 'data-testid': 'collection-music' });
    const mode = prefs.musicSource === 'equipee'
      ? `En jeu : ta musique équipée (${catalogItem('music', equippedMusic(progress))?.name ?? ''}).`
      : 'En jeu : la musique de l’univers choisi. Équipe une musique pour l’entendre partout.';
    box.append(cardTitle(doc, 'music', 'Musiques', 'col-music-title'), el(doc, 'p', { class: 'hint small', 'data-testid': 'music-mode' }, mode));
    const list = el(doc, 'ul', { class: 'items' });
    for (const item of byRarity(MUSIC_CATALOG)) {
      const owned = ownsMusic(progress, item.id);
      if ((collectionFilter === 'owned' && !owned) || (collectionFilter === 'missing' && owned)) continue;
      const equipped = owned && prefs.musicSource === 'equipee' && equippedMusic(progress) === item.id;
      const tail: HTMLElement[] = [listenButton(item)];
      if (equipped) tail.push(stateLine(doc, 'check', 'Équipée', 'equipped'));
      else if (owned) {
        tail.push(stateLine(doc, 'check', 'Possédée', 'owned'), uiButton(doc, {
          label: 'Équiper', variant: 'secondary', size: 'sm', block: true, testId: `equip-music-${item.id}`, ariaLabel: `Équiper la musique ${item.name}`,
          onClick: () => equipItem(item),
        }));
      } else tail.push(stateLine(doc, 'lock', sourceLabel(item.source), 'locked', 'Pour l’obtenir : '));
      list.append(cosmeticCard(doc, item, musicArt(item), equipped ? 'equipped' : owned ? 'owned' : 'locked', tail, `card-music-${item.id}`));
    }
    if (!list.firstChild) list.append(el(doc, 'li', { class: 'empty hint' }, collectionFilter === 'owned' ? 'Aucune musique ici.' : 'Tu as toutes les musiques !'));
    box.append(list);
    return box;
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

  /** Barre du haut des écrans de menu : niveau, pièces, vies, aide et réglages. */
  const topBar = () => {
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

  /**
   * Barre d'onglets (V6) : un écran par fonction, toujours au même endroit. L'onglet actif est
   * marqué (aria-current, forme et couleur) ; une pastille signale une récompense à récupérer.
   */
  const tabBar = (active: TabScreen) => {
    const day = utcDateKey(today());
    const giftReady = calendarStatus(progress, day).canClaim || seasonClaimable();
    const nav = el(doc, 'nav', { class: 'dock tabbar', 'aria-label': 'Menu principal' });
    const tab = (id: TabScreen, iconName: IconName, label: string, testId: string, open: () => void, dot = false, name?: string) => {
      const aria = dot ? `${label}, une récompense t’attend` : name;
      // Onglet déjà ouvert : l'écran revient à son état de départ (haut, première section) et le dit.
      const onClick = id === active
        ? () => {
          seasonTab = 'pass';
          collectionFilter = 'all';
          open();
          doc.defaultView?.scrollTo?.(0, 0);
          announce(`Tu es déjà sur l’écran ${label}.`);
        }
        : open;
      const b = dockButton(doc, { icon: iconName, label, testId, onClick, dot, ...(aria ? { ariaLabel: aria } : {}) });
      b.classList.add('tab');
      if (id === active) {
        b.classList.add('active');
        b.setAttribute('aria-current', 'page');
      }
      return b;
    };
    nav.append(
      // Nom lu « Jouer (accueil) » : il contient le libellé visible et se distingue du grand bouton Jouer.
      tab('home', 'play', 'Jouer', 'nav-home', () => renderHome(), false, 'Jouer (accueil)'),
      tab('shop', 'shop', 'Boutique', 'nav-shop', () => renderShop()),
      tab('collection', 'palette', 'Collection', 'nav-collection', () => renderCollectionScreen()),
      tab('season', 'medal', 'Passe', 'nav-season', () => renderSeason(), giftReady),
      tab('leaderboard', 'trophy', 'Classement', 'nav-leaderboard', () => renderLeaderboard()),
    );
    return nav;
  };

  const brandHero = (withTagline = true) => {
    const title = el(doc, 'h1', { tabindex: '-1', class: 'brand-title', 'aria-label': GAME_NAME, lang: 'en' });
    title.append(el(doc, 'span', {}, 'Stack'), ' ', el(doc, 'span', { class: 'small-word' }, 'or'), ' ', el(doc, 'span', { class: 'accent' }, 'Crash'));
    const logo = el(doc, 'div', { class: 'logo bounce', 'aria-hidden': 'true' });
    for (let i = 0; i < 3; i++) logo.append(el(doc, 'span', {}));
    const hero = el(doc, 'header', { class: 'hero' });
    hero.append(logo, title);
    if (withTagline) hero.append(el(doc, 'p', { class: 'tagline' }, 'Touche pour poser le bloc !'));
    return hero;
  };

  /** « Ton look » : l'apparence équipée, vivante, et l'accès direct à la collection. */
  const lookCard = () => {
    const skinItem = catalogItem('skin', progress.selected.skin);
    const themeItem = catalogItem('theme', progress.selected.theme);
    if (!skinItem || !themeItem) return null;
    const card = el(doc, 'section', { class: 'card look-card', 'aria-labelledby': 'look-title', 'data-testid': 'look' });
    const art = el(doc, 'div', { class: 'item-visual look-art' });
    art.append(previewOrSwatch(doc, 'look', { theme: progress.selected.theme, skin: progress.selected.skin } as AnyAppearance, renderAppearancePreview, { animate, size: { width: 132, height: 64 } }));
    const text = el(doc, 'div', { class: 'look-text' });
    const line = (label: string, item: CatalogItem) => {
      const p = el(doc, 'p', { class: 'look-line' });
      p.append(el(doc, 'span', { class: 'look-label' }, `${label} `), el(doc, 'strong', {}, item.name), ' ', rarityChip(doc, item.rarity));
      return p;
    };
    text.append(el(doc, 'h2', { class: 'card-title', id: 'look-title' }, 'Ton look'), line('Matière', skinItem), line('Univers', themeItem));
    const change = uiButton(doc, { label: 'Changer', icon: 'palette', variant: 'ghost', size: 'sm', testId: 'look-change', onClick: () => renderCollectionScreen() });
    card.append(art, text, change);
    return card;
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
    if (invalidReason) {
      const box = el(doc, 'section', { class: 'card' });
      const alert = el(doc, 'p', { role: 'alert', class: 'notice danger', 'data-testid': 'invalid-link' }, INVALID_MESSAGES[invalidReason]);
      const play = uiButton(doc, { label: 'Nouvelle partie', icon: 'play', variant: 'primary', size: 'xl', block: true, onClick: playFree });
      box.append(alert);
      show('home', [brandHero(false), box, play, recordLine()], play);
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
      show('home', [brandHero(false), card, accept, free, recordLine()], accept);
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
    show('home', [brandHero(), actions, lookCard(), homeMission()], play);
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
    const { header, title } = screenHeader('Classement');
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

  /** Score affiché au classement : des points (règles v2 et v3 ; le classement en ligne est en v3). */
  const boardScore = (score: number) => `${score} point${score > 1 ? 's' : ''}`;

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
    const had = run?.handle != null;
    run?.handle?.destroy();
    if (run) {
      run.handle = null;
      run.controls = null;
    }
    if (had) {
      // V7 : la musique redevient celle des menus ; la partie est close proprement (journal).
      music?.setGameActive(false);
      music?.setIntensity(0.15);
      diag?.runEnded();
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
      musicToggle(),
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
        // Défi d'un ami : mêmes règles que la partie d'origine (v1, v2 ou v3) ; sinon règles v3.
        config: mode === 'challenge' && runChallenge ? { seed, rulesVersion: runChallenge.rulesVersion } : { seed, rulesVersion: PLAY_RULES_VERSION },
        prefs: gamePrefs(),
        appearance: progress.selected,
        ...(allowContinue ? { allowContinue } : {}),
        // V7 : effets sonores sur le contexte audio de l'application (jamais un contexte par partie).
        audio: hub?.sfxOutput() ?? null,
        onIncident: (incident) => diag?.record(incident.kind, incident.message, {
          where: incident.layer, ...(incident.stack ? { stack: incident.stack } : {}), ...(incident.ms !== undefined ? { ms: incident.ms } : {}),
        }),
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
      music?.setGameActive(true);
      music?.setIntensity(0.25);
      diag?.runStarted({ mode, theme: progress.selected.theme, skin: progress.selected.skin, music: desiredTrack() ?? 'aucune', effects: prefs.effects });
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
    // V7 : la musique suit la hauteur (sections plus énergiques en haut) et s'efface un instant sous
    // les sons importants (parfait, boost, Fièvre, chute) ; journal : partie toujours en vie.
    if (event.type === 'placement') {
      const height = event.height ?? event.floor;
      music?.setIntensity(Math.min(1, 0.2 + height / 50));
      diag?.runBeat({ floor: height });
      if (event.perfect) hub?.duck(0.75, 0.12);
    } else if (event.type === 'bonus-start' || event.type === 'fever-start') hub?.duck(0.6, 0.3);
    else if (event.type === 'miss') hub?.duck(0.5, 0.6);
    switch (event.type) {
      case 'placement':
        fx.haptic(event.perfect ? 'perfect' : 'place');
        break;
      case 'miss':
        current.controls?.setFallen(true);
        fx.haptic('miss');
        diag?.runBeat({}, true);
        break;
      case 'continue-offer':
        showReviveOffer(current, stage, canvas);
        break;
      case 'continue-start':
        current.controls?.setFallen(false);
        announce(`C’est reparti ! Prêt dans ${Math.round(event.countdownTicks / 120)} secondes.`);
        break;
      case 'bonus-start':
        // Annonce courte et explicite : le nom du boost et ce qu'il fait (sans manuel).
        announce(`${BONUS_NAMES[event.bonus]} pour ${event.floors} étages : ${BONUS_HINTS[event.bonus]} !`);
        fx.haptic('reward');
        break;
      case 'bonus-end':
        announce(`Fin du ${BONUS_NAMES[event.bonus]}.`);
        break;
      case 'fever-start':
        announce('Fièvre ! Points doublés tant que tu enchaînes les parfaits.');
        fx.haptic('reward');
        break;
      case 'fever-end':
        announce('Fin de la Fièvre.');
        break;
      case 'saved':
        announce('Sauvé par le Bouclier ! Le bloc repart.');
        fx.haptic('miss');
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
        const day = utcDateKey(today());
        const e = applyRunEconomy(doc, current.activeAtStart, {
          runId: current.runId,
          mode: current.mode,
          score: height, // gains sur la hauteur, jamais sur les points ×2 (accord #27, C7)
          perfectCount: result.perfectCount,
          longestStreak: current.events.longestStreak,
        }, day);
        // Étoiles de saison : mêmes étoiles, même écriture ; 0 si la partie était déjà comptée.
        // V8 : plafond quotidien du passe (SEASON_DAILY_STARS).
        const credit = creditSeasonStars(e.doc, season, day, e.gained.xp);
        return { doc: credit.doc, result: { ...e, seasonStars: credit.credited } };
      });
      const isDailyRecord = current.day ? meta.submitDaily(current.day, height) : false;
      renderResult(current, result, {
        isRecord,
        isDailyRecord,
        completedNow: economy.completedNow,
        gained: economy.gained,
        seasonStars: economy.seasonStars,
      });
    });
  };

  type Outcome = {
    isRecord: boolean;
    isDailyRecord: boolean;
    completedNow: Objective[];
    gained: { xp: number; coins: number; bonus: number; levelUp: { from: number; to: number } | null };
    /** V8 : étoiles réellement créditées au passe (plafond du jour). */
    seasonStars: number;
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
    // V5 : tampon de BD qui prolonge la chute du jeu (décoratif, jamais lu).
    const stampWord = isRecord ? 'RECORD !' : outcome.gained.levelUp ? 'BRAVO !' : STAMPS[Math.floor(Math.random() * STAMPS.length)]!;
    card.append(el(doc, 'p', { class: 'stamp', 'aria-hidden': 'true' }, stampWord), title);
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
    // V5 : les exploits de la partie (Fièvres, rattrapages du Bouclier), en pastilles.
    const fevers = feversOf(result);
    const saves = savesOf(result);
    if (fevers > 0 || saves > 0) {
      const feats = el(doc, 'p', { class: 'feats', 'data-testid': 'feats' });
      if (fevers > 0) {
        const f = el(doc, 'span', { class: 'feat fever' });
        f.append(icon(doc, 'flame'), el(doc, 'span', {}, `${fevers} Fièvre${fevers > 1 ? 's' : ''}`));
        feats.append(f);
      }
      if (saves > 0) {
        const sv = el(doc, 'span', { class: 'feat shield' });
        sv.append(icon(doc, 'shield'), el(doc, 'span', {}, `${saves} sauvetage${saves > 1 ? 's' : ''}`));
        if (fevers > 0) feats.append(el(doc, 'span', { class: 'sr-only' }, ' · '));
        feats.append(sv);
      }
      card.append(feats);
      summary += ` ${feats.textContent}.`;
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
      // V8 : d'où viennent les pièces, et où en est le passe aujourd'hui.
      const notes: string[] = [];
      if (outcome.gained.bonus > 0) notes.push(`dont ${outcome.gained.bonus} de prime du jour`);
      if (seasonPhase(season, utcDateKey(today())) === 'active') {
        notes.push(outcome.seasonStars < outcome.gained.xp
          ? `passe : +${outcome.seasonStars}, plafond du jour atteint`
          : `passe : +${outcome.seasonStars}`);
      }
      if (notes.length > 0) {
        const line = el(doc, 'p', { class: 'hint small center', 'data-testid': 'gains-detail' }, `${notes.join(' · ')}.`);
        card.append(line);
        summary += ` ${line.textContent}`;
      }
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
    // Lien calculé dès l'écran affiché : le clic appelle le partage sans rien attendre avant
    // (activation utilisateur conservée sur téléphone). Mêmes règles et même partie, score en étages.
    const challengeLink = buildChallengeUrl(options.url, current.seed, height, result.rulesVersion);
    const shareButton = uiButton(doc, { label: 'Défier un ami', icon: 'share', variant: 'secondary', block: true, testId: 'share', onClick: guarded(() => void doShare()) });
    const copyButton = uiButton(doc, { label: 'Copier le lien', icon: 'copy', variant: 'ghost', block: true, testId: 'copy-link', onClick: guarded(() => void doCopy()) });
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
    /** Lien affiché et sélectionné, à copier à la main (ni partage ni presse-papiers). */
    const showLink = () => {
      const label = el(doc, 'label', { for: 'challenge-link', class: 'card-title' }, 'Lien du défi');
      const input = el(doc, 'input', {
        id: 'challenge-link',
        type: 'text',
        readonly: '',
        class: 'text-input',
        'data-testid': 'challenge-link',
      });
      input.value = challengeLink;
      fallback.replaceChildren(label, input, el(doc, 'p', { class: 'hint small center' }, 'Appuie longtemps sur le lien pour le copier.'));
      fallback.hidden = false;
      input.focus();
      input.select();
    };
    const doShare = async () => {
      shareButton.disabled = true;
      tracker.track('share_attempt', { mode: current.mode, runId: current.runId });
      let shareOutcome: ShareOutcome;
      try {
        // Lien seul, sans image jointe ni attente : voir src/platform/share.ts.
        shareOutcome = await options.share({
          title: GAME_NAME,
          text: `J’ai empilé ${floors(height)}${revived ? ' (avec une reprise)' : ''}. Tu fais mieux sur la même partie ?`,
          url: challengeLink,
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
      else if (shareOutcome === 'cancelled') status.textContent = 'Partage annulé. Tu peux aussi copier le lien.';
      else {
        status.textContent = 'Copie automatique impossible. Copie le lien ci-dessous.';
        showLink();
      }
    };
    const doCopy = async () => {
      tracker.track('share_attempt', { mode: current.mode, runId: current.runId });
      let copied: boolean;
      try {
        copied = await (options.copy ?? ((text: string) => copyText(text)))(challengeLink);
      } catch {
        copied = false;
      }
      if (destroyed || screen !== 'result') return;
      if (copied) {
        tracker.track('share_success', { mode: current.mode, runId: current.runId });
        fallback.hidden = true;
        status.textContent = 'Lien du défi copié. Colle-le dans un message !';
        fx.haptic('tap');
      } else {
        status.textContent = 'Copie automatique impossible. Copie le lien ci-dessous.';
        showLink();
      }
    };

    // Actions principales juste sous le score (visibles sans défiler, même sur 320 × 568) :
    // Rejouer, puis Défier un ami et Accueil. Le reste (image, collection) vient après les infos.
    const actions = el(doc, 'div', { class: 'result-actions' });
    const row = el(doc, 'div', { class: 'row' });
    row.append(shareButton, home);
    actions.append(retry, row, copyButton);
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
      ...(result.rulesVersion !== 1 ? { continueTicks: continueTicksOf(result) } : {}),
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
    const hidden = doc.visibilityState === 'hidden';
    // V7 : aucun son en arrière-plan ; au retour, la musique reprend là où elle était.
    hub?.background(hidden);
    if (run?.handle) diag?.runVisibility(!hidden);
    if (!hidden) checkRotation();
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
    get previews() {
      return animator.stats;
    },
    destroy() {
      destroyed = true;
      clearTimeout(guardTimer);
      closeSheet();
      stopRun();
      unwatchPrefs();
      animator.destroy();
      uiSound.close();
      clearInterval(rotationTimer);
      unsubscribeMusic();
      music?.stopPreview();
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
