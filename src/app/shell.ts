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
import {
  activeObjectives,
  applyRun,
  rewardLabel,
  sanitizeProgress,
  type Objective,
  type ObjectiveId,
  type ProgressState,
} from './progression';
import { createRunTracker, type RunTracker } from './run-tracker';
import { dailySeed, utcDateKey } from '../platform/daily';
import type { Mode, Tracker } from '../platform/metrics';
import type { ShareData, ShareOutcome } from '../platform/share';
import type { LocalStore, MetaStore } from '../platform/storage';

export type Screen = 'home' | 'game' | 'result';

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

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  props: Partial<Record<string, string>> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) node.setAttribute(key, value);
  }
  if (text !== undefined) node.textContent = text; // jamais innerHTML
  return node;
}

const floors = (n: number) => `${n} étage${n > 1 ? 's' : ''}`;

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

  const button = (label: string, onClick: () => void, primary = false, testId?: string) => {
    const b = el(doc, 'button', {
      type: 'button',
      class: primary ? 'primary' : undefined,
      'data-testid': testId,
    }, label);
    b.addEventListener('click', onClick);
    return b;
  };

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
      class: 'toggle',
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
    const rules = el(doc, 'p', {},
      'Touchez l’écran ou appuyez sur Espace pour poser le bloc. Ce qui dépasse tombe.');
    const play = button('Jouer', () => startRun(null), true);
    const day = utcDateKey(today());
    const daily = button('Tour du jour', () => startRun(null, 'daily'), false, 'daily');
    const dailyBest = meta.readDailyBest(day);
    const dailyHint = el(doc, 'p', { class: 'hint', 'data-testid': 'daily-hint' },
      `Même tour pour tous aujourd’hui (${day}, UTC)${dailyBest > 0 ? ` · votre record du jour : ${floors(dailyBest)}` : ''}`);
    const goals = el(doc, 'ul', { class: 'goals', 'aria-label': 'Objectifs en cours', 'data-testid': 'goals' });
    for (const o of activeObjectives(progress)) goals.append(el(doc, 'li', {}, o.label));
    show('home', [title, rules, play, daily, dailyHint, goals, recordLine(), soundToggle()], play);
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
    const parts: (HTMLElement | null)[] = [title, score];
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
    const home = button('Accueil', guarded(renderHome));

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

    parts.push(retry, shareButton, home, status, fallback);
    show('result', parts, retry);
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
