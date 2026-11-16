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
import { RULES_VERSION, type GameHandle, type RunResult } from './game-contract';
import type { ShellPrefs, StartGame } from './game-loader';
import { renderCollection } from './collection-view';
import { button as domButton, el, floors } from './dom';
import {
  activeObjectives,
  applyRun,
  BADGE_IDS,
  earnedBadges,
  rewardLabel,
  sanitizeProgress,
  selectAppearance,
  SKIN_IDS,
  THEME_IDS,
  unlockedSkins,
  unlockedThemes,
  type Objective,
  type ObjectiveId,
  type ProgressState,
} from './progression';
import { createRunTracker, type RunTracker } from './run-tracker';
import { dailySeed, nextDailyChange, utcDateKey } from '../platform/daily';
import type { Mode, Tracker } from '../platform/metrics';
import type { ShareData, ShareOutcome } from '../platform/share';
import type { LocalStore, MetaStore } from '../platform/storage';

export type Screen = 'home' | 'game' | 'result' | 'collection';

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
};

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
};

/** Date UTC lisible (« 16 novembre ») ; la clé ISO reste en attribut pour les tests. */
const formatDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/** Heure locale du prochain changement de tour (minuit UTC), calculée par le navigateur. */
const formatLocalTime = (at: Date) =>
  at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function createShell(options: ShellOptions): Shell {
  const doc = options.doc ?? document;
  const now = options.now ?? (() => performance.now());
  let guardTimer: ReturnType<typeof setTimeout> | undefined;
  const { root, tracker, store, meta } = options;
  const today = options.today ?? (() => new Date());
  let progress: ProgressState = sanitizeProgress(meta.readProgress());
  let screen: Screen = 'home';
  let run: RunState | null = null;
  let destroyed = false;
  let pausedByVisibility = false;
  let prefs: ShellPrefs = store.readPrefs();

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
    focus.focus();
  };

  const button = (label: string, onClick: () => void, primary = false, testId?: string) =>
    domButton(doc, label, onClick, primary ? 'primary' : 'secondary', testId);

  const recordLine = () => {
    const best = store.readBest();
    const text = store.persistent
      ? `Record sur cet appareil : ${floors(best)}`
      : `Record de cette session : ${floors(best)} (sauvegarde indisponible)`;
    return el(doc, 'p', { class: 'hint', 'data-testid': 'record' }, text);
  };

  const soundToggle = () => {
    const b = el(doc, 'button', {
      type: 'button',
      class: 'btn ghost toggle',
      'aria-pressed': String(!prefs.muted),
      'data-testid': 'sound-toggle',
    }, prefs.muted ? 'Son : coupé' : 'Son : activé');
    b.addEventListener('click', () => {
      prefs = { muted: !prefs.muted };
      store.writePrefs(prefs);
      b.setAttribute('aria-pressed', String(!prefs.muted));
      b.textContent = prefs.muted ? 'Son : coupé' : 'Son : activé';
    });
    return b;
  };

  const collectionButton = () => {
    const owned = unlockedThemes(progress).length + unlockedSkins(progress).length + earnedBadges(progress).length;
    const total = THEME_IDS.length + SKIN_IDS.length + BADGE_IDS.length;
    const b = domButton(doc, `Collection ${owned}/${total}`, () => renderCollectionScreen(), 'ghost', 'open-collection');
    return b;
  };

  const renderCollectionScreen = () => {
    const { nodes, focus } = renderCollection(doc, progress, {
      onSelect: (next) => {
        const updated = selectAppearance(progress, next);
        if (updated.selected.theme === progress.selected.theme && updated.selected.skin === progress.selected.skin) return;
        progress = updated;
        meta.writeProgress(progress);
        renderCollectionScreen();
        announce('Sélection enregistrée.');
      },
      onBack: () => {
        renderHome();
        view.querySelector<HTMLButtonElement>('[data-testid="open-collection"]')?.focus();
      },
    });
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
    brand.append(logo, title, el(doc, 'p', { class: 'tagline' },
      'Touchez pour poser le bloc. Ce qui dépasse tombe.'));
    const play = button('Jouer', () => startRun(null), true);
    play.classList.add('big');

    const now = today();
    const day = utcDateKey(now);
    const dailyBest = meta.readDailyBest(day);
    const dailyPanel = el(doc, 'section', { class: 'panel daily', 'aria-labelledby': 'daily-title', 'data-testid': 'daily-panel' });
    dailyPanel.append(
      el(doc, 'h2', { id: 'daily-title' }, 'Tour du jour'),
      el(doc, 'p', { 'data-testid': 'daily-hint', 'data-day': day },
        `Même tour pour tous · ${formatDay(day)} (UTC)`),
      el(doc, 'p', { class: 'hint', 'data-testid': 'daily-next' },
        `Nouvelle tour à ${formatLocalTime(nextDailyChange(now))} (heure locale)` +
          (dailyBest > 0 ? ` · record du jour : ${floors(dailyBest)}` : '')),
      button('Jouer la tour du jour', () => startRun(null, 'daily'), false, 'daily'),
    );

    const goalsPanel = el(doc, 'section', { class: 'panel', 'aria-labelledby': 'goals-title' });
    const goals = el(doc, 'ul', { class: 'goals', 'data-testid': 'goals' });
    for (const o of activeObjectives(progress)) {
      const li = el(doc, 'li', {}, o.label);
      li.append(el(doc, 'span', { class: 'reward' }, ` → ${rewardLabel(o.reward)}`));
      goals.append(li);
    }
    if (goals.childElementCount === 0) goals.append(el(doc, 'li', {}, 'Tous les objectifs sont accomplis. Bravo !'));
    goalsPanel.append(el(doc, 'h2', { id: 'goals-title' }, 'Objectifs'), goals);

    const footer = el(doc, 'nav', { class: 'footer-row', 'aria-label': 'Options' });
    footer.append(collectionButton(), soundToggle());
    show('home', [brand, play, dailyPanel, goalsPanel, footer, recordLine()], play);
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
    const seed =
      mode === 'daily' && day ? dailySeed(day) : mode === 'challenge' && challenge ? challenge.seed : options.newSeed();
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
    try {
      current.handle = options.startGame({
        canvas,
        config: { seed, rulesVersion: RULES_VERSION },
        prefs,
        onGameEvent: (event) => {
          if (run === current) current.events.onEvent(event);
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

  const finishRun = (current: RunState, result: RunResult) => {
    if (destroyed || run !== current) return;
    tracker.track('run_end', {
      mode: current.mode,
      runId: current.runId,
      score: result.score,
      durationTicks: result.durationTicks,
      perfectCount: result.perfectCount,
    });
    stopRun();
    const isRecord = store.submitScore({
      score: result.score,
      perfectCount: result.perfectCount,
      mode: current.mode,
    });
    const evaluation = applyRun(progress, current.activeAtStart, {
      runId: current.runId,
      mode: current.mode,
      score: result.score,
      perfectCount: result.perfectCount,
      longestStreak: current.events.longestStreak,
    });
    if (evaluation.state !== progress) {
      progress = evaluation.state;
      meta.writeProgress(progress);
    }
    const isDailyRecord = current.day ? meta.submitDaily(current.day, result.score) : false;
    renderResult(current, result, { isRecord, isDailyRecord, completedNow: evaluation.completedNow });
  };

  type Outcome = { isRecord: boolean; isDailyRecord: boolean; completedNow: Objective[] };

  const renderResult = (current: RunState, result: RunResult, outcome: Outcome) => {
    const { isRecord } = outcome;
    const title = el(doc, 'h2', { tabindex: '-1' }, 'Partie terminée');
    const score = el(doc, 'p', { class: 'score', 'data-testid': 'score' }, floors(result.score));
    const parts: (HTMLElement | null)[] = [title, el(doc, 'p', { class: 'score-label', 'aria-hidden': 'true' }, 'Hauteur'), score];
    let summary = `Partie terminée. Score : ${result.score}.`;

    if (isRecord) {
      parts.push(el(doc, 'p', { class: 'record', 'data-testid': 'new-record' }, 'Nouveau record !'));
      summary += ' Nouveau record.';
    }
    if (current.challenge) {
      const t = current.challenge.target;
      const text =
        result.score > t
          ? `Défi relevé : ${result.score} contre ${t} annoncés.`
          : result.score === t
            ? `Égalité avec les ${t} annoncés. Encore un étage !`
            : `Pas encore : ${result.score} sur ${t} annoncés.`;
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
    if (outcome.completedNow.length > 0) {
      const list = el(doc, 'ul', { class: 'goals done', 'aria-label': 'Objectifs accomplis', 'data-testid': 'completed-goals' });
      for (const o of outcome.completedNow) {
        list.append(el(doc, 'li', {}, `${o.label} → ${rewardLabel(o.reward)} débloqué`));
      }
      parts.push(list);
      summary += ` ${outcome.completedNow.length} objectif(s) accompli(s).`;
    }
    const rewardShortcut = outcome.completedNow.length > 0;
    parts.push(el(doc, 'p', { class: 'hint' }, 'Score local, non vérifié.'), recordLine());

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

    const doShare = async () => {
      const url = buildChallengeUrl(options.url, current.seed, result.score);
      shareButton.disabled = true;
      tracker.track('share_attempt', { mode: current.mode, runId: current.runId });
      let outcome: ShareOutcome;
      try {
        outcome = await options.share({
          title: 'Pile ou Crash',
          text: `J’ai empilé ${floors(result.score)}. Tu fais mieux sur la même séquence ?`,
          url,
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
    if (rewardShortcut) actions.append(domButton(doc, 'Voir la collection', guarded(renderCollectionScreen), 'ghost', 'result-collection'));
    actions.append(home);
    const info = el(doc, 'div', { class: 'result-info' });
    info.append(...parts.filter((p): p is HTMLElement => p !== null));
    show('result', [info, actions, status, fallback], retry);
    // Marqueur observable (tests, styles) de la fin du délai de garde.
    guardTimer = setTimeout(() => {
      if (screen === 'result') view.dataset.inputReady = 'true';
    }, RESULT_INPUT_GUARD_MS);
    announce(summary);
  };

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
      root.replaceChildren();
    },
  };
}
