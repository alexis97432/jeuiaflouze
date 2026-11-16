/**
 * Shell A0 : accueil → jeu → résultat → rejouer, en DOM accessible.
 * Le shell ne connaît pas les règles : il monte le jeu via `mountGame` et lit `RunResult`.
 */
import { RULES_VERSION, type GameHandle, type MountGame, type RunResult } from './game-contract';
import type { Mode, Tracker } from '../platform/metrics';

export type Screen = 'home' | 'game' | 'result';

export type ShellOptions = {
  root: HTMLElement;
  mountGame: MountGame;
  tracker: Tracker;
  newSeed: () => number;
  newRunId: () => string;
  isMockGame: boolean;
  doc?: Document;
};

export type Shell = {
  readonly screen: Screen;
  destroy(): void;
};

type RunState = { runId: string; seed: number; mode: Mode; handle: GameHandle | null };

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

export function createShell(options: ShellOptions): Shell {
  const doc = options.doc ?? document;
  const { root, tracker } = options;
  let screen: Screen = 'home';
  let run: RunState | null = null;
  let lastRunId: string | null = null;
  let destroyed = false;
  let pausedByVisibility = false;

  const live = el(doc, 'p', { class: 'sr-only', 'aria-live': 'polite', 'data-testid': 'live' });
  const view = el(doc, 'div', { class: 'view' });
  root.replaceChildren(view, live);

  const announce = (message: string) => {
    live.textContent = message;
  };

  const mockBanner = () =>
    options.isMockGame
      ? el(
          doc,
          'p',
          { class: 'mock-banner', role: 'note', 'data-testid': 'mock-banner' },
          'Version de développement : moteur simulé, pas le vrai jeu.',
        )
      : null;

  const show = (next: Screen, children: (HTMLElement | null)[], focus: HTMLElement) => {
    screen = next;
    view.replaceChildren(...children.filter((c): c is HTMLElement => c !== null));
    view.dataset.screen = next;
    focus.focus();
  };

  const stopRun = () => {
    run?.handle?.destroy();
    if (run) run.handle = null;
    pausedByVisibility = false;
  };

  const renderHome = () => {
    const title = el(doc, 'h1', { tabindex: '-1' }, 'Pile ou Crash');
    const rules = el(
      doc,
      'p',
      {},
      'Touchez l’écran ou appuyez sur Espace pour poser le bloc. Ce qui dépasse tombe.',
    );
    const play = el(doc, 'button', { type: 'button', class: 'primary' }, 'Jouer');
    play.addEventListener('click', () => startRun(null));
    show('home', [mockBanner(), title, rules, play], play);
  };

  const startRun = (previousRunId: string | null) => {
    stopRun();
    const seed = options.newSeed();
    const mode: Mode = 'free';
    const runId = options.newRunId();
    run = { runId, seed, mode, handle: null };

    const heading = el(doc, 'h2', { class: 'sr-only', tabindex: '-1' }, 'Partie en cours');
    const canvas = el(doc, 'canvas', {
      class: 'game-canvas',
      width: '360',
      height: '640',
      tabindex: '0',
      'aria-label': 'Zone de jeu. Touchez ou appuyez sur Espace pour poser le bloc.',
      'data-testid': 'game-canvas',
    });
    const pauseOverlay = el(doc, 'div', { class: 'pause', hidden: '', 'data-testid': 'pause' });
    const resume = el(doc, 'button', { type: 'button', class: 'primary' }, 'Reprendre');
    pauseOverlay.append(el(doc, 'p', {}, 'Partie en pause.'), resume);
    resume.addEventListener('click', () => {
      pauseOverlay.hidden = true;
      pausedByVisibility = false;
      run?.handle?.resume();
      canvas.focus();
    });
    const stage = el(doc, 'div', { class: 'stage' });
    stage.append(canvas, pauseOverlay);

    show('game', [mockBanner(), heading, stage], canvas);
    if (previousRunId) tracker.track('retry', { mode, runId, previousRunId });
    tracker.track('run_start', { mode, runId });
    announce('Partie commencée.');

    const current = run;
    let ended = false;
    current.handle = options.mountGame({
      canvas,
      config: { seed, rulesVersion: RULES_VERSION },
      onEnd: (result) => {
        if (ended || destroyed || run !== current) return; // onEnd unique et non périmé
        ended = true;
        // Différé : le moteur peut appeler onEnd depuis son propre gestionnaire.
        queueMicrotask(() => finishRun(current, result));
      },
    });
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
    lastRunId = current.runId;
    renderResult(result);
  };

  const renderResult = (result: RunResult) => {
    const title = el(doc, 'h2', { tabindex: '-1' }, 'Partie terminée');
    const score = el(
      doc,
      'p',
      { class: 'score', 'data-testid': 'score' },
      `${result.score} étage${result.score > 1 ? 's' : ''}`,
    );
    const note = el(doc, 'p', { class: 'hint' }, 'Score local, non vérifié.');
    const retry = el(doc, 'button', { type: 'button', class: 'primary' }, 'Rejouer');
    retry.addEventListener('click', () => startRun(lastRunId));
    const home = el(doc, 'button', { type: 'button' }, 'Accueil');
    home.addEventListener('click', renderHome);
    show('result', [mockBanner(), title, score, note, retry, home], retry);
    announce(`Partie terminée. Score : ${result.score}.`);
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
      stopRun();
      doc.removeEventListener('visibilitychange', onVisibility);
      root.replaceChildren();
    },
  };
}
