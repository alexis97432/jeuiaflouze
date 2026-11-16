// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountGame, MountGameOptions, RunResult } from '../../src/app/game-contract';
import { createShell, type Shell } from '../../src/app/shell';
import { createTracker, memorySink } from '../../src/platform/metrics';

/** Faux moteur pilotable : expose les options reçues et les appels au handle. */
function fakeGame() {
  const mounts: { options: MountGameOptions; pause: number; resume: number; destroyed: boolean }[] = [];
  const mountGame: MountGame = (options) => {
    const record = { options, pause: 0, resume: 0, destroyed: false };
    mounts.push(record);
    return {
      pause: () => void record.pause++,
      resume: () => void record.resume++,
      destroy: () => void (record.destroyed = true),
    };
  };
  return { mountGame, mounts };
}

const result = (score: number): RunResult => ({
  seed: 7,
  rulesVersion: 1,
  score,
  perfectCount: 1,
  durationTicks: 500,
  inputTicks: [1, 2],
});

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

let visibility: DocumentVisibilityState = 'visible';
let shell: Shell | null = null;

beforeEach(() => {
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  document.body.innerHTML = '<main id="app"></main>';
});
afterEach(() => {
  shell?.destroy();
  shell = null;
});

function setup() {
  const game = fakeGame();
  const sink = memorySink();
  const tracker = createTracker({ buildId: 'b', rulesVersion: 1, sessionId: 's', sink });
  let seed = 100;
  let run = 0;
  const root = document.getElementById('app')!;
  shell = createShell({
    root,
    mountGame: game.mountGame,
    tracker,
    newSeed: () => seed++,
    newRunId: () => `run${++run}`,
    isMockGame: false,
  });
  const button = (label: string) =>
    [...root.querySelectorAll('button')].find((b) => b.textContent === label)!;
  return { game, sink, root, button, shell };
}

describe('shell', () => {
  it("parcourt accueil → jeu → résultat avec le focus sur l'action principale", async () => {
    const { game, sink, root, button, shell } = setup();
    expect(shell.screen).toBe('home');
    expect(document.activeElement?.textContent).toBe('Jouer');
    expect(root.querySelector('[data-testid="mock-banner"]')).toBeNull();

    button('Jouer').click();
    expect(shell.screen).toBe('game');
    expect(game.mounts).toHaveLength(1);
    const mount = game.mounts[0]!;
    expect(mount.options.config).toEqual({ seed: 100, rulesVersion: 1 });
    expect(document.activeElement).toBe(mount.options.canvas);

    mount.options.onEnd(result(4));
    await flush();
    expect(shell.screen).toBe('result');
    expect(mount.destroyed).toBe(true);
    expect(root.querySelector('[data-testid="score"]')?.textContent).toBe('4 étages');
    expect(root.textContent).toContain('non vérifié');
    expect(document.activeElement?.textContent).toBe('Rejouer');
    expect(sink.events.map((e) => e.name)).toEqual(['run_start', 'run_end']);
  });

  it('rejouer émet retry avec previousRunId et une nouvelle seed', async () => {
    const { game, sink, button } = setup();
    button('Jouer').click();
    game.mounts[0]!.options.onEnd(result(1));
    await flush();
    button('Rejouer').click();
    expect(game.mounts).toHaveLength(2);
    expect(game.mounts[1]!.options.config.seed).toBe(101);
    expect(sink.events.slice(2)).toMatchObject([
      { name: 'retry', runId: 'run2', previousRunId: 'run1' },
      { name: 'run_start', runId: 'run2' },
    ]);
  });

  it('ignore un onEnd répété ou provenant d’une partie détruite', async () => {
    const { game, sink, button, shell } = setup();
    button('Jouer').click();
    const first = game.mounts[0]!;
    first.options.onEnd(result(2));
    first.options.onEnd(result(9));
    await flush();
    expect(sink.events.filter((e) => e.name === 'run_end')).toHaveLength(1);

    button('Rejouer').click();
    first.options.onEnd(result(50)); // partie périmée
    await flush();
    expect(shell.screen).toBe('game');
    expect(sink.events.filter((e) => e.name === 'run_end')).toHaveLength(1);
  });

  it("met en pause quand l'onglet est caché et attend une reprise explicite", () => {
    const { game, root, button } = setup();
    button('Jouer').click();
    const mount = game.mounts[0]!;
    const overlay = root.querySelector<HTMLElement>('[data-testid="pause"]')!;

    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(mount.pause).toBe(1);
    expect(overlay.hidden).toBe(false);

    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(mount.resume).toBe(0); // pas de reprise automatique
    expect(document.activeElement?.textContent).toBe('Reprendre');

    button('Reprendre').click();
    expect(mount.resume).toBe(1);
    expect(overlay.hidden).toBe(true);
  });

  it('destroy libère la partie en cours et les écouteurs', () => {
    const { game, root, button, shell } = setup();
    button('Jouer').click();
    shell.destroy();
    expect(game.mounts[0]!.destroyed).toBe(true);
    expect(root.childElementCount).toBe(0);
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(game.mounts[0]!.pause).toBe(0);
  });

  it('affiche le bandeau quand le moteur est simulé', () => {
    const root = document.getElementById('app')!;
    const tracker = createTracker({ buildId: 'b', rulesVersion: 1, sessionId: 's', sink: vi.fn() });
    shell = createShell({
      root,
      mountGame: fakeGame().mountGame,
      tracker,
      newSeed: () => 1,
      newRunId: () => 'r',
      isMockGame: true,
    });
    expect(root.querySelector('[data-testid="mock-banner"]')?.textContent).toMatch(/simulé/);
  });
});
