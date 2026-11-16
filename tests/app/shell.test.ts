// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunResult } from '../../src/app/game-contract';
import type { StartGame, StartOptions } from '../../src/app/game-loader';
import { createShell, type Shell, type ShellOptions } from '../../src/app/shell';
import { createTracker, memorySink } from '../../src/platform/metrics';
import type { ShareOutcome } from '../../src/platform/share';
import { createLocalStore } from '../../src/platform/storage';

type Mount = { options: StartOptions; pause: number; resume: number; destroyed: boolean };

/** Faux moteur pilotable : expose les options reçues et les appels au handle. */
function fakeGame() {
  const mounts: Mount[] = [];
  const startGame: StartGame = (options) => {
    const record: Mount = { options, pause: 0, resume: 0, destroyed: false };
    mounts.push(record);
    return {
      pause: () => void record.pause++,
      resume: () => void record.resume++,
      destroy: () => void (record.destroyed = true),
    };
  };
  return { startGame, mounts };
}

const result = (score: number, seed = 7): RunResult => ({
  seed,
  rulesVersion: 1,
  score,
  perfectCount: 1,
  durationTicks: 500,
  inputTicks: [1, 2],
});

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise<void>((resolve) => queueMicrotask(resolve));
};

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
  vi.restoreAllMocks();
});

function setup(overrides: Partial<ShellOptions> = {}) {
  const game = fakeGame();
  const sink = memorySink();
  const tracker = createTracker({ buildId: 'b', rulesVersion: 1, sessionId: 's', sink });
  const store = overrides.store ?? createLocalStore(null);
  const replaced: string[] = [];
  const share = vi.fn(async (): Promise<ShareOutcome> => 'shared');
  let seed = 100;
  let run = 0;
  const root = document.getElementById('app')!;
  shell = createShell({
    root,
    startGame: game.startGame,
    tracker,
    store,
    url: 'https://jeu.test/',
    replaceUrl: (u) => void replaced.push(u),
    share,
    newSeed: () => seed++,
    newRunId: () => `run${++run}`,
    isMockGame: false,
    ...overrides,
  });
  const button = (label: string) => {
    const found = [...root.querySelectorAll('button')].find((b) => b.textContent === label);
    if (!found) throw new Error(`bouton « ${label} » absent : ${root.textContent}`);
    return found;
  };
  const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent ?? null;
  const end = async (score: number, index = game.mounts.length - 1) => {
    game.mounts[index]!.options.onEnd(result(score));
    await flush();
  };
  return { game, sink, root, button, text, end, store, replaced, share, shell: shell! };
}

const names = (sink: ReturnType<typeof memorySink>) => sink.events.map((e) => e.name);

describe('parcours libre', () => {
  it("accueil → jeu → résultat avec le focus sur l'action principale", async () => {
    const { game, sink, root, button, text, end, shell } = setup();
    expect(shell.screen).toBe('home');
    expect(document.activeElement?.textContent).toBe('Jouer');
    expect(root.querySelector('[data-testid="mock-banner"]')).toBeNull();

    button('Jouer').click();
    expect(shell.screen).toBe('game');
    const mount = game.mounts[0]!;
    expect(mount.options.config).toEqual({ seed: 100, rulesVersion: 1 });
    expect(document.activeElement).toBe(mount.options.canvas);

    await end(4);
    expect(shell.screen).toBe('result');
    expect(mount.destroyed).toBe(true);
    expect(text('score')).toBe('4 étages');
    expect(root.textContent).toContain('non vérifié');
    expect(document.activeElement?.textContent).toBe('Rejouer');
    expect(names(sink)).toEqual(['run_start', 'run_end']);
  });

  it('rejouer en libre émet retry et tire une nouvelle seed', async () => {
    const { game, sink, button, end } = setup();
    button('Jouer').click();
    await end(1);
    button('Rejouer').click();
    expect(game.mounts[1]!.options.config.seed).toBe(101);
    expect(sink.events.slice(2)).toMatchObject([
      { name: 'retry', runId: 'run2', previousRunId: 'run1', mode: 'free' },
      { name: 'run_start', runId: 'run2' },
    ]);
  });

  it('ignore un onEnd répété ou provenant d’une partie détruite', async () => {
    const { game, sink, button, end, shell } = setup();
    button('Jouer').click();
    game.mounts[0]!.options.onEnd(result(9));
    await end(2, 0);
    expect(sink.events.filter((e) => e.name === 'run_end')).toHaveLength(1);
    button('Rejouer').click();
    await end(50, 0); // partie périmée
    expect(shell.screen).toBe('game');
    expect(sink.events.filter((e) => e.name === 'run_end')).toHaveLength(1);
  });
});

describe('first_placement', () => {
  it('une seule fois par partie, jamais pour une partie périmée', async () => {
    const { game, sink, button, end } = setup();
    button('Jouer').click();
    const first = game.mounts[0]!.options;
    first.onFirstPlacement?.();
    first.onFirstPlacement?.();
    await end(3);
    button('Rejouer').click();
    first.onFirstPlacement?.(); // partie précédente
    game.mounts[1]!.options.onFirstPlacement?.();
    const events = sink.events.filter((e) => e.name === 'first_placement');
    expect(events.map((e) => ('runId' in e ? e.runId : null))).toEqual(['run1', 'run2']);
    expect(names(sink)).toEqual(['run_start', 'first_placement', 'run_end', 'retry', 'run_start', 'first_placement']);
  });
});

describe('record et préférences', () => {
  it('annonce un nouveau record seulement quand il est battu, et le persiste', async () => {
    const store = createLocalStore(null);
    store.submitScore({ score: 5, perfectCount: 0, mode: 'free' });
    const { button, text, end, root } = setup({ store });
    expect(text('record')).toContain('5 étages');
    button('Jouer').click();
    await end(3);
    expect(root.querySelector('[data-testid="new-record"]')).toBeNull();
    button('Rejouer').click();
    await end(8);
    expect(text('new-record')).toBe('Nouveau record !');
    expect(store.readBest()).toBe(8);
    expect(text('record')).toContain('8 étages');
  });

  it('signale une sauvegarde indisponible sans bloquer', () => {
    const { text } = setup();
    expect(text('record')).toMatch(/sauvegarde indisponible/);
  });

  it('le réglage du son est mémorisé et transmis au moteur', () => {
    const store = createLocalStore(null);
    const { game, button, root } = setup({ store });
    const toggle = root.querySelector<HTMLButtonElement>('[data-testid="sound-toggle"]')!;
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.click();
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.textContent).toBe('Son : coupé');
    expect(store.readPrefs()).toEqual({ muted: true });
    button('Jouer').click();
    expect(game.mounts[0]!.options.prefs).toEqual({ muted: true });
  });
});

describe('défi par URL', () => {
  it('ouvre le défi, joue sa seed, compare au score annoncé et rejoue la même séquence', async () => {
    const { game, sink, button, text, end } = setup({ url: 'https://jeu.test/?v=1&seed=4242&target=6' });
    expect(names(sink)).toEqual(['challenge_open']);
    expect(text('challenge-invite')).toContain('6 étages');
    expect(document.activeElement?.textContent).toBe('Relever le défi');

    button('Relever le défi').click();
    expect(game.mounts[0]!.options.config.seed).toBe(4242);
    expect(text('target')).toContain('6 étages');
    await end(6);
    expect(text('challenge-outcome')).toMatch(/Égalité/);
    button('Rejouer').click();
    expect(game.mounts[1]!.options.config.seed).toBe(4242);
    await end(7);
    expect(text('challenge-outcome')).toMatch(/Défi relevé : 7 contre 6/);
    expect(sink.events.filter((e) => e.name === 'run_end').every((e) => 'mode' in e && e.mode === 'challenge')).toBe(true);
  });

  it('partie libre depuis un défi : nouvelle seed et URL nettoyée', () => {
    const { game, button, replaced } = setup({ url: 'https://jeu.test/p/?v=1&seed=4242&target=6#x' });
    button('Partie libre').click();
    expect(game.mounts[0]!.options.config.seed).toBe(100);
    expect(replaced).toEqual(['https://jeu.test/p/']);
  });

  it('lien invalide : explication, aucun HTML injecté, nouvelle partie possible', () => {
    const evil = encodeURIComponent('<img src=x onerror="window.__pwned=1">');
    const { game, sink, root, button, text, replaced } = setup({
      url: `https://jeu.test/?v=1&seed=${evil}&target=3`,
    });
    expect(text('invalid-link')).toMatch(/abîmé/);
    expect(root.querySelector('img')).toBeNull();
    expect(names(sink)).toEqual([]);
    expect(document.activeElement?.textContent).toBe('Nouvelle partie');
    button('Nouvelle partie').click();
    expect(game.mounts).toHaveLength(1);
    expect(replaced).toEqual(['https://jeu.test/']);
  });

  it("version inconnue : message dédié", () => {
    const { text } = setup({ url: 'https://jeu.test/?v=9&seed=1&target=3' });
    expect(text('invalid-link')).toMatch(/autre version/);
  });

  it("un replaceState qui échoue n'empêche pas de jouer", () => {
    const { game, button } = setup({
      url: 'https://jeu.test/?v=1&seed=1&target=3',
      replaceUrl: () => {
        throw new DOMException('sandbox', 'SecurityError');
      },
    });
    button('Partie libre').click();
    expect(game.mounts).toHaveLength(1);
  });
});

describe('partage', () => {
  it('construit le lien de la partie jouée et compte un succès', async () => {
    const { share, button, text, end, sink } = setup({ url: 'https://jeu.test/?utm=a' });
    button('Jouer').click();
    await end(12);
    button('Défier un ami').click();
    await flush();
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://jeu.test/?v=1&seed=100&target=12' }),
    );
    expect(text('share-status')).toBe('Défi envoyé.');
    expect(names(sink).slice(-2)).toEqual(['share_attempt', 'share_success']);
  });

  it('annulé : pas de share_success', async () => {
    const share = vi.fn(async (): Promise<ShareOutcome> => 'cancelled');
    const { button, text, end, sink } = setup({ share });
    button('Jouer').click();
    await end(1);
    button('Défier un ami').click();
    await flush();
    expect(text('share-status')).toBe('Partage annulé.');
    expect(names(sink)).not.toContain('share_success');
  });

  it('copié : succès de copie annoncé', async () => {
    const { button, text, end, sink } = setup({ share: async () => 'copied' });
    button('Jouer').click();
    await end(1);
    button('Défier un ami').click();
    await flush();
    expect(text('share-status')).toBe('Lien du défi copié.');
    expect(names(sink).at(-1)).toBe('share_success');
  });

  it('indisponible ou en erreur : lien affiché et sélectionné pour copie manuelle', async () => {
    for (const share of [async (): Promise<ShareOutcome> => 'unavailable', async (): Promise<ShareOutcome> => { throw new Error('x'); }]) {
      document.body.innerHTML = '<main id="app"></main>';
      shell?.destroy();
      const { button, root, end, sink } = setup({ share });
      button('Jouer').click();
      await end(3);
      button('Défier un ami').click();
      await flush();
      const input = root.querySelector<HTMLInputElement>('[data-testid="challenge-link"]')!;
      expect(input.value).toBe('https://jeu.test/?v=1&seed=100&target=3');
      expect(document.activeElement).toBe(input);
      expect(names(sink)).not.toContain('share_success');
    }
  });
});

describe('robustesse', () => {
  it("met en pause quand l'onglet est caché et attend une reprise explicite", () => {
    const { game, root, button } = setup();
    button('Jouer').click();
    const mount = game.mounts[0]!;
    const overlay = root.querySelector<HTMLElement>('[data-testid="pause"]')!;
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(mount.pause).toBe(1);
    expect(overlay.hidden).toBe(false);
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(mount.resume).toBe(0);
    expect(document.activeElement?.textContent).toBe('Reprendre');
    button('Reprendre').click();
    expect(mount.resume).toBe(1);
    expect(overlay.hidden).toBe(true);
  });

  it('un moteur qui ne démarre pas affiche une erreur récupérable', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail = true;
    const game = fakeGame();
    const { button, text } = setup({
      startGame: (o) => {
        if (fail) throw new RangeError('canvas');
        return game.startGame(o);
      },
    });
    button('Jouer').click();
    expect(text('start-error')).toMatch(/pas pu démarrer/);
    fail = false;
    button('Réessayer').click();
    expect(game.mounts).toHaveLength(1);
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
    const { text } = setup({ isMockGame: true });
    expect(text('mock-banner')).toMatch(/simulé/);
  });
});
