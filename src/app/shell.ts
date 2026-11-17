/**
 * Shell A1 : accueil → jeu → résultat → rejouer / défier, en DOM accessible.
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
import { PLAY_RULES_VERSION, RULES_VERSION, type Appearance, type GameEvent, type GameHandle } from './game-contract';
import type { ShellPrefs, StartGame } from './game-loader';
import { previewOrSwatch, renderCollection, type PreviewFn } from './collection-view';
import { BONUS_NAMES, continuesOf, continueTicksOf, heightOf, pointsOf, type AnyRunResult } from './run-result';
import { AD_MESSAGES, createRewardGate, noAds, type RewardedAdProvider } from '../platform/ads/rewarded';
import { claimSeasonTier, nextTier, SEASON_1, seasonPhase, seasonState, tierStatus, addSeasonStars, type Season, type SeasonReward, type Track } from './season';
import { COIN_SHOP, itemState, purchaseWithCoins, sellableItems, type ShopItem } from './shop';
import { isSkinId, renderAppearancePreview } from '../game';
import {
  applyRunEconomy,
  calendarStatus,
  claimCalendar,
  LEVEL_TITLES,
  levelInfo,
  readProgressDoc,
  type ProgressDoc,
} from './economy';
import { button as domButton, el, floors, iconButton } from './dom';
import {
  activeObjectives,
  BADGE_IDS,
  earnedBadges,
  rewardLabel,
  selectAppearance,
  SKIN_IDS,
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
import type { LocalStore, MetaStore } from '../platform/storage';
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
  resultImage?: (result: AnyRunResult, mode: Mode, day: string | null, appearance?: Appearance) => Promise<File | null>;
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
const NO_LIVES: LivesProvider = { count: () => 0, consume: () => Promise.resolve('none'), refund: () => Promise.resolve() };

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
};

const BOARD_LABELS: Record<BoardKind, string> = { global: 'Monde', weekly: 'Semaine', daily: 'Aujourd’hui' };
const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`);
const SERVICE_MESSAGES: Record<ServiceError, string> = {
  unavailable: 'Classement indisponible pour cette version du jeu.',
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
  let pausedByVisibility = false;
  let prefs: ShellPrefs = store.readPrefs();

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

  const show = (next: Screen, children: (HTMLElement | null)[], focus: HTMLElement) => {
    screen = next;
    clearTimeout(guardTimer);
    delete view.dataset.inputReady;
    view.replaceChildren(...children.filter((c): c is HTMLElement => c !== null));
    view.dataset.screen = next;
    root.dataset.screen = next; // mise en page pleine page pendant la partie
    focus.focus();
  };

  const button = (label: string, onClick: () => void, primary = false, testId?: string) =>
    domButton(doc, label, onClick, primary ? 'primary' : 'secondary', testId);

  const recordLine = () => {
    const best = store.readBest();
    const text = store.persistent ? `Record : ${floors(best)}` : `Record : ${floors(best)} (non sauvegardé)`;
    return el(doc, 'p', { class: 'hint record-line', 'data-testid': 'record', 'data-icon': '🏆' }, text);
  };

  const soundToggle = () => {
    const b = el(doc, 'button', {
      type: 'button',
      class: 'btn ghost toggle',
      'aria-pressed': String(!prefs.muted),
      'data-testid': 'sound-toggle',
    }, prefs.muted ? 'Son : coupé' : 'Son : activé');
    b.dataset.icon = prefs.muted ? '🔇' : '🔊';
    b.addEventListener('click', () => {
      prefs = { muted: !prefs.muted };
      store.writePrefs(prefs);
      b.setAttribute('aria-pressed', String(!prefs.muted));
      b.textContent = prefs.muted ? 'Son : coupé' : 'Son : activé';
      b.dataset.icon = prefs.muted ? '🔇' : '🔊';
    });
    return b;
  };

  const coinsText = () => `${progress.coins} pièce${progress.coins > 1 ? 's' : ''}`;

  /** Pastilles du haut de l'accueil : niveau et pièces, sans détail. */
  const statusChips = () => {
    const info = levelInfo(progress.xp);
    const bar = el(doc, 'div', { class: 'chips' });
    bar.append(
      el(doc, 'p', { class: 'chip', 'data-icon': '⭐', 'data-testid': 'level' }, `Niveau ${info.level}`),
      el(doc, 'p', { class: 'chip', 'data-icon': '🪙', 'data-testid': 'coins' }, coinsText()),
    );
    return bar;
  };

  const screenHeader = (titleText: string, onBack: () => void) => {
    const back = iconButton(doc, '←', 'Retour', onBack, 'ghost', 'back');
    const h = el(doc, 'h1', { tabindex: '-1', class: 'screen-title' }, titleText);
    const header = el(doc, 'div', { class: 'screen-header' });
    header.append(back, h);
    return { header, title: h };
  };

  /** Écran Récompenses : cadeau du jour, niveau, objectifs, collection (progression locale). */
  const renderRewards = (focusTestId?: string) => {
    const { header, title } = screenHeader('Récompenses', () => {
      renderHome();
      view.querySelector<HTMLElement>('[data-testid="nav-rewards"]')?.focus();
    });
    const day = utcDateKey(today());

    const gift = el(doc, 'section', { class: 'panel', 'aria-labelledby': 'gift-title' });
    const status = calendarStatus(progress, day);
    gift.append(el(doc, 'h2', { id: 'gift-title', 'data-icon': '🎁' }, 'Cadeau du jour'));
    gift.append(el(doc, 'p', { 'data-testid': 'calendar', tabindex: '-1' },
      status.canClaim ? `+${status.reward} pièces (jour ${status.dayInCycle} sur 7)` : 'Déjà pris aujourd’hui. Reviens demain !'));
    if (status.canClaim) {
      gift.append(domButton(doc, `Prendre +${status.reward}`, () => withProgressLock(() => {
        const result = updateDoc((current) => {
          const r = claimCalendar(current, utcDateKey(today()));
          return { doc: r.doc, result: r };
        });
        if (result.claimed) announce(`+${result.reward} pièces récupérées.`);
        else announce('Cadeau du jour déjà pris.');
        if (screen === 'rewards') renderRewards('calendar');
      }), 'secondary', 'claim'));
    }

    const info = levelInfo(progress.xp);
    const level = el(doc, 'section', { class: 'panel', 'aria-labelledby': 'level-title' });
    level.append(el(doc, 'h2', { id: 'level-title', 'data-icon': '⭐' }, `Niveau ${info.level}${info.title ? ` · ${info.title}` : ''}`));
    if (info.toNext !== null) {
      level.append(
        el(doc, 'progress', { max: String(info.intoLevel + info.toNext), value: String(info.intoLevel), 'aria-label': 'Vers le niveau suivant' }),
        el(doc, 'p', { class: 'hint', 'data-testid': 'xp' }, `Encore ${info.toNext} étoile${info.toNext > 1 ? 's' : ''} pour le niveau ${info.level + 1}`),
      );
    } else {
      level.append(el(doc, 'p', { class: 'hint', 'data-testid': 'xp' }, 'Niveau maximal, bravo !'));
    }

    const goalsPanel = el(doc, 'section', { class: 'panel', 'aria-labelledby': 'goals-title' });
    const goals = el(doc, 'ul', { class: 'goals', 'data-testid': 'goals' });
    for (const o of activeObjectives(progress)) {
      const li = el(doc, 'li', {}, o.label);
      li.append(el(doc, 'span', { class: 'reward' }, ` → ${rewardLabel(o.reward)}`));
      goals.append(li);
    }
    if (goals.childElementCount === 0) goals.append(el(doc, 'li', {}, 'Tous les défis sont réussis. Bravo !'));
    goalsPanel.append(el(doc, 'h2', { id: 'goals-title', 'data-icon': '🎯' }, 'Défis à réussir'), goals);

    const note = el(doc, 'p', { class: 'hint small' }, writable
      ? 'Ta progression est gardée sur cet appareil.'
      : 'Sauvegarde d’une version plus récente du jeu : progression de cette session non enregistrée.');
    show('rewards', [header, statusChips(), gift, seasonPanel(), level, goalsPanel, collectionButton(), note], title);
    if (focusTestId) view.querySelector<HTMLElement>(`[data-testid="${focusTestId}"]`)?.focus();
  };

  // --- Passe de saison (V3-A5) ---------------------------------------------------------------
  const season = options.season ?? SEASON_1;
  const canDraw = (id: string) => isSkinId(id);
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
    const panel = el(doc, 'section', { class: 'panel', 'aria-labelledby': 'season-title' });
    panel.append(el(doc, 'h2', { id: 'season-title', 'data-icon': '🏅' }, season.name));
    const stars = seasonState(progress, season).stars;
    const next = nextTier(progress, season);
    if (phase === 'upcoming') {
      panel.append(el(doc, 'p', { 'data-testid': 'season-summary' }, `Commence le ${formatSeasonDay(season.start)}.`));
    } else if (phase === 'ended') {
      panel.append(el(doc, 'p', { 'data-testid': 'season-summary' }, 'Saison finie. Tes apparences restent à toi.'));
    } else if (next) {
      const prev = season.tiers.filter((t) => t.stars <= stars).at(-1)?.stars ?? 0;
      panel.append(
        el(doc, 'progress', { max: String(next.stars - prev), value: String(stars - prev), 'aria-label': `Vers le palier ${next.tier}` }),
        el(doc, 'p', { class: 'hint', 'data-testid': 'season-summary' },
          `Palier ${next.tier} dans ${next.stars - stars} étoile${next.stars - stars > 1 ? 's' : ''} · jusqu’au ${formatSeasonDay(season.end)}`),
      );
    } else {
      panel.append(el(doc, 'p', { 'data-testid': 'season-summary' }, 'Tous les paliers sont atteints. Bravo !'));
    }
    const open = iconButton(doc, '🏅', seasonClaimable() ? 'Voir le passe · cadeau à prendre' : 'Voir le passe', () => renderSeason(), 'secondary', 'open-season');
    panel.append(open);
    return panel;
  };

  const claimTier = (tier: number, track: Track) => withProgressLock(() => {
    const r = updateDoc((current) => {
      const c = claimSeasonTier(current, season, tier, track, utcDateKey(today()), canDraw);
      return { doc: c.doc, result: c };
    });
    const text = r.ok ? `Pris : ${rewardText(r.reward)}.` : r.reason === 'claimed' ? 'Déjà pris.' : 'Pas encore disponible.';
    announce(text);
    if (screen === 'season') renderSeason(`tier-${tier}`, text);
  });

  /** Écran du passe : paliers, piste gratuite réclamable, piste premium en aperçu (indisponible). */
  const renderSeason = (focusTestId?: string, notice?: string) => {
    const { header, title } = screenHeader(season.name, () => renderRewards('open-season'));
    const day = utcDateKey(today());
    const stars = seasonState(progress, season).stars;
    const parts: HTMLElement[] = [header];
    if (notice) parts.push(el(doc, 'p', { class: 'notice', role: 'status', 'data-testid': 'season-notice' }, notice));
    parts.push(
      el(doc, 'p', { 'data-testid': 'season-stars', 'data-icon': '⭐' }, `${stars} étoile${stars > 1 ? 's' : ''} de saison`),
      el(doc, 'p', { class: 'hint small' }, `Du ${formatSeasonDay(season.start)} au ${formatSeasonDay(season.end)}. Les étoiles se gagnent en jouant.`),
      el(doc, 'p', { class: 'hint small', 'data-testid': 'premium-note' }, 'Piste ✨ Premium : indisponible pour l’instant. Rien n’est en vente.'),
    );
    const list = el(doc, 'ol', { class: 'tiers', 'aria-label': 'Paliers' });
    for (const t of season.tiers) {
      const li = el(doc, 'li', { class: 'tier', 'data-testid': `tier-${t.tier}`, tabindex: '-1' });
      li.append(el(doc, 'p', { class: 'tier-head' }, `Palier ${t.tier} · ${t.stars} ⭐`));
      for (const track of ['free', 'premium'] as const) {
        const reward = track === 'free' ? t.free : t.premium;
        const st = tierStatus(progress, season, t, track, day, canDraw);
        const cell = el(doc, 'div', { class: `tier-cell ${track} ${st}`, 'data-testid': `tier-${t.tier}-${track}` });
        if (reward.kind === 'skin') {
          // Pas encore dessinée par le moteur : pastille « ? », jamais l'aperçu d'une autre apparence.
          cell.append(isSkinId(reward.id)
            ? previewOrSwatch(doc, reward.id, { theme: progress.selected.theme, skin: reward.id }, renderAppearancePreview)
            : el(doc, 'div', { class: 'swatch soon', 'aria-hidden': 'true' }, '?'));
        }
        cell.append(el(doc, 'p', { class: 'tier-reward' }, `${track === 'premium' ? '✨ ' : ''}${rewardText(reward)}`));
        const label: Record<typeof st, string> = {
          claimed: 'Pris ✓',
          claimable: '',
          locked: `🔒 ${t.stars - stars} étoile${t.stars - stars > 1 ? 's' : ''}`,
          soon: 'Bientôt',
          'premium-unavailable': 'Indisponible',
          ended: 'Saison finie',
        };
        cell.append(st === 'claimable'
          ? domButton(doc, 'Prendre', () => claimTier(t.tier, track), 'primary', `claim-tier-${t.tier}`)
          : el(doc, 'p', { class: 'tier-state' }, label[st]));
        li.append(cell);
      }
      list.append(li);
    }
    parts.push(list);
    show('season', parts, title);
    if (focusTestId) view.querySelector<HTMLElement>(`[data-testid="${focusTestId}"]`)?.focus();
  };

  /** Réglages discrets : son. */
  const renderSettings = () => {
    const { header, title } = screenHeader('Réglages', () => {
      renderHome();
      view.querySelector<HTMLElement>('[data-testid="nav-settings"]')?.focus();
    });
    show('settings', [header, soundToggle(), el(doc, 'p', { class: 'hint small' }, 'Le son démarre après ton premier toucher.')], title);
  };

  const shopConfig = options.shop ?? { catalog: COIN_SHOP, isAvailable: (id: string) => isSkinId(id) };
  const shopPreview = shopConfig.preview ?? renderAppearancePreview;

  type ShopNotice = { text: string; testId: string };

  /** Boutique en pièces (V3-A2) : aperçu, prix, confirmation, achat atomique sous verrou. */
  const renderShop = (state: { confirm?: string; notice?: ShopNotice; focus?: string } = {}) => {
    const { header, title } = screenHeader('Boutique', () => {
      renderHome();
      view.querySelector<HTMLElement>('[data-testid="nav-shop"]')?.focus();
    });
    const items = sellableItems(shopConfig.catalog, shopConfig.isAvailable);
    const parts: HTMLElement[] = [header, statusChips()];

    if (state.notice) {
      parts.push(el(doc, 'p', { class: 'notice', role: 'status', 'data-testid': state.notice.testId, tabindex: '-1' }, state.notice.text));
    }

    if (items.length === 0) {
      parts.push(el(doc, 'p', { 'data-testid': 'shop-empty' }, 'Rien à vendre pour l’instant. Reviens bientôt !'));
    } else {
      const list = el(doc, 'ul', { class: 'cards shop' });
      for (const item of items) {
        const st = itemState(progress, item);
        const li = el(doc, 'li', { class: `card ${st}`, 'data-testid': `shop-${item.id}`, tabindex: '-1' });
        li.append(
          previewOrSwatch(doc, item.id, { theme: progress.selected.theme, skin: isSkinId(item.id) ? item.id : progress.selected.skin }, shopPreview),
          el(doc, 'p', { class: 'card-name' }, item.name),
        );
        if (st === 'owned') {
          const chosen = progress.selected.skin === item.id;
          li.append(chosen
            ? el(doc, 'p', { class: 'card-state' }, 'Choisi')
            : domButton(doc, 'Mettre', () => wear(item), 'ghost'));
        } else if (state.confirm === item.id) {
          li.append(
            el(doc, 'p', { 'data-testid': 'confirm-text' }, `Acheter ${item.name} pour ${item.price} pièces ?`),
            domButton(doc, 'Oui, acheter', () => buy(item), 'primary', 'confirm-buy'),
            domButton(doc, 'Non', () => renderShop({ focus: `shop-${item.id}` }), 'ghost', 'cancel-buy'),
          );
        } else {
          li.append(el(doc, 'p', { class: 'price', 'data-icon': '🪙' }, `${item.price} pièces`));
          if (st === 'affordable') {
            const b = domButton(doc, 'Acheter', () => renderShop({ confirm: item.id, focus: 'confirm-buy' }), 'secondary');
            b.setAttribute('aria-label', `Acheter ${item.name} pour ${item.price} pièces`);
            li.append(b);
          } else {
            li.append(el(doc, 'p', { class: 'card-lock' }, `Il te manque ${item.price - progress.coins} pièces.`));
          }
        }
        list.append(li);
      }
      parts.push(list);
    }
    parts.push(el(doc, 'p', { class: 'hint small' }, 'Les pièces se gagnent en jouant. Elles ne s’achètent pas.'));
    show('shop', parts, title);
    if (state.focus) view.querySelector<HTMLElement>(`[data-testid="${state.focus}"]`)?.focus();
  };

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
    if (screen === 'shop') renderShop({ notice, focus: notice.testId });
  });

  const wear = (item: ShopItem) => withProgressLock(() => {
    updateDoc((current) => {
      if (!isSkinId(item.id)) return { doc: current, result: null };
      const updated = selectAppearance(current, { skin: item.id });
      return { doc: updated, result: null };
    });
    if (screen === 'shop') renderShop({ notice: { text: `${item.name} est mis pour ta prochaine partie.`, testId: 'shop-worn' }, focus: 'shop-worn' });
  });

  const collectionButton = () => {
    const owned = unlockedThemes(progress).length + unlockedSkins(progress).length + earnedBadges(progress).length;
    const total = THEME_IDS.length + SKIN_IDS.length + BADGE_IDS.length;
    const b = iconButton(doc, '🎨', `Ma collection ${owned}/${total}`, () => renderCollectionScreen(), 'secondary', 'open-collection');
    return b;
  };

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
        renderRewards('open-collection');
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

  const renderHome = () => {
    const title = el(doc, 'h1', { tabindex: '-1' }, 'Pile ou Crash');
    if (invalidReason) {
      const alert = el(doc, 'p', { role: 'alert', class: 'alert', 'data-testid': 'invalid-link' },
        INVALID_MESSAGES[invalidReason]);
      const play = button('Nouvelle partie', playFree, true);
      show('home', [title, alert, play, recordLine(), soundToggle()], play);
      return;
    }
    if (challenge) {
      const invite = el(doc, 'p', { 'data-testid': 'challenge-invite' },
        `Un ami vous défie : dépassez ${floors(challenge.target)} sur la même séquence.`);
      const note = el(doc, 'p', { class: 'hint' }, 'Score déclaré par votre ami, non vérifié.');
      const accept = button('Relever le défi', () => startRun(null), true);
      const free = button('Partie libre', playFree);
      show('home', [title, invite, note, accept, free, recordLine(), soundToggle()], accept);
      return;
    }
    title.textContent = '';
    title.append(el(doc, 'span', { class: 'brand-word' }, 'Pile'), ' ', el(doc, 'span', { class: 'brand-small' }, 'ou'), ' ',
      el(doc, 'span', { class: 'brand-word accent' }, 'Crash'));
    title.setAttribute('aria-label', 'Pile ou Crash');
    const logo = el(doc, 'div', { class: 'logo', 'aria-hidden': 'true' });
    for (let i = 0; i < 3; i++) logo.append(el(doc, 'span', {}));
    const brand = el(doc, 'header', { class: 'brand' });
    brand.append(logo, title, el(doc, 'p', { class: 'tagline' }, 'Touche pour poser le bloc !'));

    // Une seule action principale, toujours visible sans défiler (320×568, paysage).
    const play = iconButton(doc, '▶', 'Jouer', () => startRun(null), 'primary', 'play');
    play.classList.add('big');

    const now = today();
    const day = utcDateKey(now);
    const daily = iconButton(doc, '📅', 'Défi du jour', () => startRun(null, 'daily'), 'secondary', 'daily');
    const dailyHint = el(doc, 'p', { class: 'hint small', 'data-testid': 'daily-hint', 'data-day': day },
      `Le même pour tous · nouveau à ${formatLocalTime(nextDailyChange(now))}`);

    const giftReady = calendarStatus(progress, day).canClaim || seasonClaimable();
    const rewardsTab = iconButton(doc, '🎁', 'Récompenses', () => renderRewards(), 'tab', 'nav-rewards');
    if (giftReady) {
      rewardsTab.classList.add('has-dot');
      rewardsTab.setAttribute('aria-label', 'Récompenses, un cadeau t’attend');
    }
    const tabbar = el(doc, 'nav', { class: 'tabbar', 'aria-label': 'Menu' });
    tabbar.append(
      iconButton(doc, '🛍️', 'Boutique', () => renderShop(), 'tab', 'nav-shop'),
      iconButton(doc, '🏆', 'Classement', () => renderLeaderboard(), 'tab', 'nav-leaderboard'),
      rewardsTab,
      iconButton(doc, '⚙️', 'Réglages', () => renderSettings(), 'tab', 'nav-settings'),
    );
    show('home', [statusChips(), brand, play, daily, dailyHint, recordLine(), tabbar], play);
    prefetchTickets();
  };

  /** Choix du pseudo : jamais le vrai nom, validé comme sur le serveur. */
  const pseudoBlock = (editing: boolean, kind: BoardKind) => {
    const box = el(doc, 'div', { class: 'pseudo', 'data-testid': 'pseudo-block' });
    if (player?.pseudo && !editing) {
      box.append(
        el(doc, 'p', { 'data-testid': 'pseudo' }, `Ton pseudo : ${player.pseudo}`),
        domButton(doc, 'Changer', () => renderLeaderboard(kind, true), 'ghost', 'pseudo-change'),
      );
      return box;
    }
    const form = el(doc, 'form', { class: 'pseudo-form' });
    const input = el(doc, 'input', {
      id: 'pseudo-input', type: 'text', maxlength: '16', autocomplete: 'off', 'data-testid': 'pseudo-input',
    });
    input.value = player?.pseudo ?? '';
    const error = el(doc, 'p', { class: 'hint small', role: 'alert', 'data-testid': 'pseudo-error' });
    form.append(
      el(doc, 'label', { for: 'pseudo-input' }, 'Choisis un pseudo pour être classé'),
      el(doc, 'p', { class: 'hint small' }, 'Pas ton vrai nom. 3 à 16 lettres ou chiffres.'),
      input,
      domButton(doc, 'Valider', () => undefined, 'primary', 'pseudo-save'),
      error,
    );
    form.querySelector('button')!.type = 'submit';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const pseudo = cleanPseudo(input.value);
      if (!pseudo) {
        error.textContent = 'Ce pseudo ne va pas : 3 à 16 lettres ou chiffres.';
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
    const { header, title } = screenHeader('Classement', () => {
      renderHome();
      view.querySelector<HTMLElement>('[data-testid="nav-leaderboard"]')?.focus();
    });
    const parts: HTMLElement[] = [header];
    if (!leaderboard.available) {
      parts.push(
        el(doc, 'p', { class: 'notice', 'data-testid': 'board-unavailable' },
          'Classement indisponible : cette version du jeu n’est reliée à aucun serveur.'),
        el(doc, 'p', { class: 'hint' }, 'Tu peux jouer quand même. Ton record reste sur cet appareil.'),
        recordLine(),
      );
      show('leaderboard', parts, title);
      return;
    }
    const tabs = el(doc, 'div', { class: 'segmented', role: 'group', 'aria-label': 'Tableau' });
    for (const k of ['global', 'weekly', 'daily'] as const) {
      const b = domButton(doc, BOARD_LABELS[k], () => renderLeaderboard(k), 'ghost', `board-${k}`);
      b.setAttribute('aria-pressed', String(k === kind));
      tabs.append(b);
    }
    const content = el(doc, 'div', { class: 'board', 'data-testid': 'board' });
    parts.push(pseudoBlock(editingPseudo, kind), tabs, content);
    show('leaderboard', parts, title);
    if (editingPseudo) view.querySelector<HTMLElement>('#pseudo-input')?.focus();
    void loadBoard(kind, content, 0, []);
  };

  const loadBoard = async (kind: BoardKind, content: HTMLElement, offset: number, shown: BoardEntry[]) => {
    const request = ++boardRequest;
    const loading = el(doc, 'p', { role: 'status', 'data-testid': 'board-loading' }, 'Chargement…');
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
      const retry = domButton(doc, 'Réessayer', () => void loadBoard(kind, content, offset, shown), 'secondary', 'board-retry');
      content.append(el(doc, 'p', { role: 'alert', 'data-testid': 'board-error' }, SERVICE_MESSAGES[r.error]), retry);
      return;
    }
    const pageData = r.value;
    const entries = [...shown, ...pageData.entries];
    const nodes: HTMLElement[] = [];
    if (pageData.demo) {
      nodes.push(el(doc, 'p', { class: 'notice', 'data-testid': 'board-demo' }, 'Mode démo : ces joueurs sont inventés pour l’essai.'));
    }
    if (pageData.you) {
      nodes.push(el(doc, 'p', { 'data-testid': 'board-you' }, `Ta place : ${ordinal(pageData.you.rank)} sur ${pageData.total}`));
    }
    if (entries.length === 0) {
      nodes.push(el(doc, 'p', { 'data-testid': 'board-empty' }, 'Personne pour l’instant. Sois le premier !'));
    } else {
      const list = el(doc, 'ol', { class: 'board-list', 'aria-label': `Classement ${BOARD_LABELS[kind]}` });
      for (const e of entries) {
        const li = el(doc, 'li', { class: e.you ? 'you' : '' });
        li.append(
          el(doc, 'span', { class: 'board-rank' }, ordinal(e.rank)),
          el(doc, 'span', { class: 'board-name' }, e.you ? `${e.pseudo} (toi)` : e.pseudo),
          el(doc, 'span', { class: 'board-score' }, floors(e.score)),
        );
        list.append(li);
      }
      nodes.push(list);
    }
    if (pageData.nextOffset !== null) {
      const next = pageData.nextOffset;
      nodes.push(domButton(doc, 'Voir plus', () => void loadBoard(kind, content, next, entries), 'ghost', 'board-more'));
    }
    content.replaceChildren(...nodes);
  };

  const stopRun = () => {
    run?.handle?.destroy();
    if (run) run.handle = null;
    pausedByVisibility = false;
  };

  const startRun = (previous: RunState | null, requested?: Mode) => {
    stopRun();
    const mode: Mode = previous?.mode ?? requested ?? (challenge ? 'challenge' : 'free');
    // Défi : même séquence. Tour du jour : seed de la date UTC, figée au lancement de cette partie.
    // Libre : nouvelle seed.
    const day = mode === 'daily' ? utcDateKey(today()) : null;
    const ticket = takeTicket(mode, day);
    const seed = ticket
      ? ticket.seed
      : mode === 'daily' && day ? dailySeed(day) : mode === 'challenge' && challenge ? challenge.seed : options.newSeed();
    const runId = options.newRunId();
    run = {
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
    };

    const runChallenge = run.challenge;
    const heading = el(doc, 'h2', { class: 'sr-only', tabindex: '-1' },
      runChallenge
        ? `Défi en cours : dépasser ${floors(runChallenge.target)}`
        : day
          ? `Tour du jour ${day} en cours`
          : 'Partie en cours');
    const canvas = el(doc, 'canvas', {
      class: 'game-canvas',
      width: '360',
      height: '640',
      tabindex: '0',
      'aria-label': 'Zone de jeu. Touchez ou appuyez sur Espace pour poser le bloc.',
      'data-testid': 'game-canvas',
    });
    const pauseOverlay = el(doc, 'div', { class: 'pause', hidden: '', 'data-testid': 'pause' });
    const resume = button('Reprendre', () => {
      pauseOverlay.hidden = true;
      pausedByVisibility = false;
      run?.handle?.resume();
      canvas.focus();
    }, true);
    pauseOverlay.append(el(doc, 'p', {}, 'Partie en pause.'), resume);
    const stage = el(doc, 'div', { class: 'stage' });
    stage.append(canvas, pauseOverlay);
    const target = runChallenge
      ? el(doc, 'p', { class: 'hint', 'data-testid': 'target' }, `Objectif : plus de ${floors(runChallenge.target)}`)
      : day
        ? el(doc, 'p', { class: 'hint', 'data-testid': 'target' }, `Tour du jour · ${day} (UTC)`)
        : null;

    show('game', [heading, target, stage], canvas);

    const current = run;
    let ended = false;
    let placed = false;
    // Reprise proposée seulement en partie libre, et seulement si un moyen réel existe.
    const allowContinue = mode === 'free' && (reviveAds.kind !== 'none' || reviveLives.count() > 0);
    try {
      current.handle = options.startGame({
        canvas,
        config: mode === 'challenge' && runChallenge?.rulesVersion === RULES_VERSION ? { seed, rulesVersion: RULES_VERSION } : { seed, rulesVersion: PLAY_RULES_VERSION },
        prefs,
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
      const msg = el(doc, 'p', { role: 'alert', class: 'alert', 'data-testid': 'start-error' },
        'Le jeu n’a pas pu démarrer sur cet appareil.');
      const retry = button('Réessayer', () => startRun(null), true);
      const home = button('Accueil', renderHome);
      show('home', [msg, retry, home], retry);
    }
  };

  // --- Reprise (V3-A6) -----------------------------------------------------------------------
  const reviveAds = options.revive?.ads ?? noAds;
  const reviveLives = options.revive?.lives ?? NO_LIVES;
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
    const box = el(doc, 'div', { class: 'pause revive', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'revive-title', 'data-testid': 'revive' });
    const msg = el(doc, 'p', { role: 'status', 'data-testid': 'revive-status' });
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
      canvas.focus();
      return true;
    };
    const finish = () => {
      close();
      handle.declineContinue!();
    };
    const lives = reviveLives.count();
    if (lives > 0) {
      const b = iconButton(doc, '❤️', `Utiliser une vie (${lives})`, () => {
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
      }, 'primary', 'revive-life');
      buttons.push(b);
    }
    if (reviveAds.kind !== 'none') {
      const b = iconButton(doc, '▶', 'Regarder une vidéo', () => {
        busy(true);
        msg.textContent = 'Vidéo en cours…';
        void rewardGate.reward(requestId, 'revive', () => resumeWith('vidéo')).then((outcome) => {
          if (run !== current || !box.isConnected) return;
          if (outcome === 'rewarded' || outcome === 'already-rewarded') return;
          msg.textContent = AD_MESSAGES[outcome];
          busy(false);
        });
      }, lives > 0 ? 'secondary' : 'primary', 'revive-ad');
      buttons.push(b);
    }
    const end = domButton(doc, 'Terminer', finish, 'ghost', 'revive-end');
    buttons.push(end);
    box.append(el(doc, 'p', { id: 'revive-title', class: 'revive-title' }, 'Oups ! Encore une chance ?'));
    if (reviveAds.kind === 'demo') box.append(el(doc, 'p', { class: 'hint small', 'data-testid': 'revive-demo' }, reviveAds.label));
    box.append(...buttons, msg);
    stage.append(box);
    buttons[0]!.focus();
    announce('Oups ! Encore une chance ? Choisis, ou Terminer.');
  };

  /** Événements v2 du moteur (F7) : offre de reprise, compte à rebours, bonus, jauge. */
  const onRunEvent = (current: RunState, event: GameEvent, stage: HTMLElement, canvas: HTMLCanvasElement) => {
    switch (event.type) {
      case 'continue-offer':
        showReviveOffer(current, stage, canvas);
        break;
      case 'continue-start':
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

  const renderResult = (current: RunState, result: AnyRunResult, outcome: Outcome) => {
    const { isRecord } = outcome;
    const height = heightOf(result);
    const points = pointsOf(result);
    const revived = continuesOf(result) > 0;
    const title = el(doc, 'h2', { tabindex: '-1' }, 'Partie terminée');
    const score = el(doc, 'p', { class: 'score', 'data-testid': 'score' }, floors(height));
    const parts: (HTMLElement | null)[] = [title, el(doc, 'p', { class: 'score-label', 'aria-hidden': 'true' }, 'Hauteur'), score];
    let summary = `Partie terminée. Hauteur : ${height}.`;
    if (points !== null) {
      parts.push(el(doc, 'p', { class: 'points', 'data-testid': 'points' }, `${points} point${points > 1 ? 's' : ''}`));
      summary += ` ${points} points.`;
    }
    if (revived) {
      parts.push(el(doc, 'p', { class: 'hint', 'data-testid': 'revived' }, 'Partie avec une reprise : hors classement.'));
      summary += ' Partie avec une reprise.';
    }

    if (isRecord) {
      parts.push(el(doc, 'p', { class: 'record', 'data-testid': 'new-record' }, 'Nouveau record !'));
      summary += ' Nouveau record.';
    }
    if (current.challenge) {
      const t = current.challenge.target;
      const text =
        height > t
          ? `Défi relevé : ${height} contre ${t} annoncés.`
          : height === t
            ? `Égalité avec les ${t} annoncés. Encore un étage !`
            : `Pas encore : ${height} sur ${t} annoncés.`;
      parts.push(el(doc, 'p', { 'data-testid': 'challenge-outcome' }, text));
      summary += ` ${text}`;
    }
    if (current.day) {
      const best = meta.readDailyBest(current.day);
      const text = outcome.isDailyRecord
        ? `Nouveau record du jour (${current.day}) !`
        : `Record du jour (${current.day}) : ${floors(best)}`;
      parts.push(el(doc, 'p', { 'data-testid': 'daily-outcome' }, text));
      summary += ` ${text}`;
    }
    if (outcome.gained.xp > 0 || outcome.gained.coins > 0) {
      const gains = `+${outcome.gained.xp} étoile${outcome.gained.xp > 1 ? 's' : ''} · +${outcome.gained.coins} pièce${outcome.gained.coins > 1 ? 's' : ''}`;
      parts.push(el(doc, 'p', { class: 'gains', 'data-testid': 'gains' }, gains));
      summary += ` ${gains}.`;
    }
    if (outcome.gained.levelUp) {
      const newTitle = LEVEL_TITLES[outcome.gained.levelUp.to];
      // Le titre n'est annoncé que s'il est nouveau (niveaux 2, 5, 10) — revue FLK, m1.
      const text = `Niveau ${outcome.gained.levelUp.to} atteint${newTitle ? ` : ${newTitle}` : ''} !`;
      parts.push(el(doc, 'p', { class: 'record', 'data-testid': 'level-up' }, text));
      summary += ` ${text}`;
    }
    if (outcome.completedNow.length > 0) {
      const list = el(doc, 'ul', { class: 'goals done', 'aria-label': 'Objectifs accomplis', 'data-testid': 'completed-goals' });
      for (const o of outcome.completedNow) {
        list.append(el(doc, 'li', {}, `${o.label} → ${rewardLabel(o.reward)} débloqué`));
      }
      parts.push(list);
      summary += ` ${outcome.completedNow.length} objectif(s) accompli(s).`;
    }
    const rewardShortcut = outcome.completedNow.length > 0;
    const rankStatus = el(doc, 'p', { class: 'hint', role: 'status', 'data-testid': 'rank-status' });
    const rankRetry = domButton(doc, 'Envoyer encore', () => void sendRank(current, result, rankStatus, rankRetry), 'ghost', 'rank-retry');
    rankRetry.hidden = true;
    if (revived) {
      rankStatus.textContent = 'Score local. Une partie avec reprise n’entre pas au classement.';
    } else if (current.ticket && player?.pseudo) {
      rankStatus.textContent = 'Envoi au classement…';
    } else {
      rankStatus.textContent = 'Score local, non vérifié.';
      if (leaderboard.available && current.mode !== 'challenge') {
        rankStatus.textContent += player?.pseudo
          ? ' Partie non classée : pas de connexion au départ.'
          : ' Choisis un pseudo dans Classement pour être classé.';
      }
    }
    parts.push(rankStatus, rankRetry, recordLine());

    const status = el(doc, 'p', { class: 'hint', role: 'status', 'data-testid': 'share-status' });
    const fallback = el(doc, 'div', { class: 'fallback', hidden: '' });
    const readyAt = now() + RESULT_INPUT_GUARD_MS;
    const guarded = (action: () => void) => () => {
      if (now() < readyAt) return;
      action();
    };
    const retry = button('Rejouer', guarded(() => startRun(current)), true);
    const shareButton = button('Défier un ami', guarded(() => void doShare()), false, 'share');
    const home = domButton(doc, 'Accueil', guarded(renderHome), 'ghost');

    let imagePromise: Promise<File | null> | null = null;
    const resultImage = () => {
      if (!options.resultImage) return Promise.resolve(null);
      imagePromise ??= options.resultImage(result, current.mode, current.day, progress.selected).catch(() => null);
      return imagePromise;
    };
    const saveImage = domButton(doc, 'Enregistrer l’image', guarded(() => {
      void resultImage().then((file) => {
        if (destroyed || screen !== 'result') return;
        if (!file) {
          status.textContent = 'Image indisponible sur cet appareil. Le lien du défi reste partageable.';
          return;
        }
        if ((options.saveFile ?? ((f: File) => downloadFile(f, doc)))(file)) {
          status.textContent = 'Image enregistrée.';
          return;
        }
        // Dernier secours : l'image affichée, à garder par un appui long (navigateurs sans téléchargement).
        try {
          const img = el(doc, 'img', { alt: 'Image du résultat', class: 'result-image', 'data-testid': 'result-image' });
          img.setAttribute('src', URL.createObjectURL(file));
          fallback.replaceChildren(img, el(doc, 'p', { class: 'hint small' }, 'Appuie longtemps sur l’image pour l’enregistrer.'));
          fallback.hidden = false;
          status.textContent = 'Téléchargement impossible : image affichée ci-dessous.';
        } catch {
          status.textContent = 'Image indisponible sur cet appareil. Le lien du défi reste partageable.';
        }
      });
    }), 'ghost', 'save-image');
    const doShare = async () => {
      const url = buildChallengeUrl(options.url, current.seed, height, result.rulesVersion);
      shareButton.disabled = true;
      tracker.track('share_attempt', { mode: current.mode, runId: current.runId });
      let outcome: ShareOutcome;
      try {
        const image = await resultImage();
        outcome = await options.share({
          title: 'Pile ou Crash',
          text: `J’ai empilé ${floors(height)}${revived ? ' (avec une reprise)' : ''}. Tu fais mieux sur la même séquence ?`,
          url,
          ...(image ? { files: [image] } : {}),
        });
      } catch {
        outcome = 'unavailable';
      }
      if (destroyed || screen !== 'result') return;
      shareButton.disabled = false;
      if (outcome === 'shared' || outcome === 'copied') {
        tracker.track('share_success', { mode: current.mode, runId: current.runId });
      }
      fallback.hidden = true;
      if (outcome === 'shared') status.textContent = 'Défi envoyé.';
      else if (outcome === 'copied') status.textContent = 'Lien du défi copié.';
      else if (outcome === 'cancelled') status.textContent = 'Partage annulé.';
      else {
        // Ni partage ni presse-papiers : on affiche le lien à copier à la main.
        status.textContent = 'Copie automatique impossible. Copiez le lien ci-dessous.';
        const label = el(doc, 'label', { for: 'challenge-link' }, 'Lien du défi');
        const input = el(doc, 'input', {
          id: 'challenge-link',
          type: 'text',
          readonly: '',
          'data-testid': 'challenge-link',
        });
        input.value = url;
        fallback.replaceChildren(label, input);
        fallback.hidden = false;
        input.focus();
        input.select();
      }
    };

    const actions = el(doc, 'div', { class: 'actions' });
    actions.append(retry, shareButton);
    if (options.resultImage) actions.append(saveImage);
    if (rewardShortcut) actions.append(domButton(doc, 'Voir la collection', guarded(() => renderCollectionScreen()), 'ghost', 'result-collection'));
    actions.append(home);
    const info = el(doc, 'div', { class: 'result-info' });
    info.append(...parts.filter((p): p is HTMLElement => p !== null));
    show('result', [info, actions, status, fallback], retry);
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
      text = r.code === 'unknown_ticket' ? 'Partie non classée : trop ancienne.' : 'Partie non classée : refusée par le serveur.';
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
    if (screen === 'home') renderHome();
  };
  win?.addEventListener('storage', onStorage);
  doc.addEventListener('pointerdown', onPointer, true);
  doc.addEventListener('keydown', onKey, true);

  const onVisibility = () => {
    if (screen !== 'game' || !run?.handle) return;
    if (doc.visibilityState === 'hidden' && !pausedByVisibility) {
      pausedByVisibility = true;
      run.handle.pause();
      const overlay = view.querySelector<HTMLElement>('[data-testid="pause"]');
      if (overlay) overlay.hidden = false;
    } else if (doc.visibilityState === 'visible' && pausedByVisibility) {
      // Reprise explicite : on montre le bouton, sans relancer la simulation.
      view.querySelector<HTMLButtonElement>('[data-testid="pause"] button')?.focus();
    }
  };
  doc.addEventListener('visibilitychange', onVisibility);

  renderHome();

  return {
    get screen() {
      return screen;
    },
    destroy() {
      destroyed = true;
      clearTimeout(guardTimer);
      stopRun();
      doc.removeEventListener('visibilitychange', onVisibility);
      doc.removeEventListener('pointerdown', onPointer, true);
      win?.removeEventListener('storage', onStorage);
      doc.removeEventListener('keydown', onKey, true);
      delete root.dataset.screen;
      delete root.dataset.input;
      root.replaceChildren();
    },
  };
}
