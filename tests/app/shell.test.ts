// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { RunResult } from '../../src/app/game-contract';
import type { StartGame, StartOptions } from '../../src/app/game-loader';
import { createShell, type LivesProvider, PROGRESS_LOCK, RESULT_INPUT_GUARD_MS, type Shell, type ShellOptions } from '../../src/app/shell';
import { createTracker, memorySink } from '../../src/platform/metrics';
import type { ShareOutcome } from '../../src/platform/share';
import { createLocalStore, createMetaStore, DEFAULT_PREFS } from '../../src/platform/storage';
import { dailySeed } from '../../src/platform/daily';
import { AD_MESSAGES, type AdOutcome, type RewardedAdProvider } from '../../src/platform/ads/rewarded';
import type { BoardPage, LeaderboardService, RankTicket, ServiceResult } from '../../src/platform/services/leaderboard';

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
/** Horloges des shells créés dans le test : l'offre de reprise a un délai de garde (V4). */
const clocks: { t: number }[] = [];
const guardElapsed = () => {
  for (const c of clocks) c.t += RESULT_INPUT_GUARD_MS;
};

beforeEach(() => {
  clocks.length = 0;
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
  const meta = overrides.meta ?? createMetaStore(null);
  const day = { now: new Date('2026-11-16T22:30:00Z') };
  const replaced: string[] = [];
  const share = vi.fn(async (): Promise<ShareOutcome> => 'shared');
  let seed = 100;
  let run = 0;
  const clock = { t: 0 };
  clocks.push(clock);
  const root = document.getElementById('app')!;
  shell = createShell({
    root,
    startGame: game.startGame,
    tracker,
    store,
    meta,
    today: () => day.now,
    url: 'https://jeu.test/',
    replaceUrl: (u) => void replaced.push(u),
    share,
    newSeed: () => seed++,
    newRunId: () => `run${++run}`,
    now: () => clock.t,
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
    clock.t += RESULT_INPUT_GUARD_MS; // fin du délai de garde du résultat
  };
  /** Envoie des poses au moteur factice (parfaites ou non), comme le ferait onEvent. */
  const place = (marks: boolean[], index = game.mounts.length - 1) => {
    let streak = 0;
    marks.forEach((perfect, i) => {
      streak = perfect ? streak + 1 : 0;
      game.mounts[index]!.options.onGameEvent?.({ type: 'placement', tick: i + 1, floor: i + 1, perfect, perfectStreak: streak });
    });
  };
  return { game, sink, root, button, text, end, store, meta, day, place, replaced, share, clock, shell: shell! };
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
    expect(mount.options.config).toEqual({ seed: 100, rulesVersion: 3 }); // nouvelles parties : règles v3 (V5)
    expect(document.activeElement).toBe(mount.options.canvas);

    await end(4);
    expect(shell.screen).toBe('result');
    expect(mount.destroyed).toBe(true);
    expect(text('score')).toBe('4 étages');
    expect(text('rank-status')).toBe('Score gardé sur cet appareil.');
    expect(root.textContent).not.toMatch(/non vérifié|serveur|UTC/);
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

describe('délai de garde du résultat', () => {
  it('ignore les activations pendant 500 ms après la fin, puis les accepte', async () => {
    const { game, button, clock, shell, share } = setup();
    button('Jouer').click();
    game.mounts[0]!.options.onEnd(result(2));
    await flush();
    expect(shell.screen).toBe('result');
    button('Rejouer').click();
    button('Défier un ami').click();
    button('Accueil').click();
    clock.t += RESULT_INPUT_GUARD_MS - 1;
    button('Rejouer').click();
    expect(shell.screen).toBe('result');
    expect(game.mounts).toHaveLength(1);
    expect(share).not.toHaveBeenCalled();
    clock.t += 1;
    button('Rejouer').click();
    expect(game.mounts).toHaveLength(2);
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
    expect(text('record')).toMatch(/pas sauvegardé sur cet appareil/);
  });

  it('le réglage du son est mémorisé et transmis au moteur', () => {
    const store = createLocalStore(null);
    const { game, button, root } = setup({ store });
    button('Réglages').click();
    const toggle = root.querySelector<HTMLButtonElement>('[data-testid="sound-toggle"]')!;
    expect(toggle.getAttribute('role')).toBe('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    toggle.click();
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toggle.textContent).toBe('Son');
    expect(store.readPrefs()).toEqual({ ...DEFAULT_PREFS, muted: true });
    button('Retour').click();
    expect(document.activeElement?.getAttribute('data-testid')).toBe('nav-settings');
    button('Jouer').click();
    expect(game.mounts[0]!.options.prefs).toEqual({ muted: true, volume: 0.8, effects: 'full' });
  });
});

describe('défi par URL', () => {
  it('ouvre le défi, joue sa seed, compare au score annoncé et rejoue la même séquence', async () => {
    const { game, sink, button, text, end } = setup({ url: 'https://jeu.test/?v=1&seed=4242&target=6' });
    expect(names(sink)).toEqual(['challenge_open']);
    expect(text('challenge-invite')).toContain('6 étages');
    expect(document.activeElement?.textContent).toBe('Relever le défi');

    button('Relever le défi').click();
    expect(game.mounts[0]!.options.config).toEqual({ seed: 4242, rulesVersion: 1 }); // ancien lien : règles v1
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
    expect(text('share-status')).toBe('Partage annulé. Tu peux aussi copier le lien.');
    expect(names(sink)).not.toContain('share_success');
  });

  it('copié : succès de copie annoncé', async () => {
    const { button, text, end, sink } = setup({ share: async () => 'copied' });
    button('Jouer').click();
    await end(1);
    button('Défier un ami').click();
    await flush();
    expect(text('share-status')).toBe('Lien du défi copié. Colle-le dans un message !');
    expect(names(sink).at(-1)).toBe('share_success');
  });

  it('partage appelé dans le geste : aucune attente avant (image lente ignorée)', async () => {
    const never = new Promise<File | null>(() => {});
    const { share, button, end } = setup({ resultImage: () => never });
    button('Jouer').click();
    await end(5);
    button('Défier un ami').click();
    // Synchrone : aucun microtask n'a encore tourné.
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({
      title: 'Stack or Crash',
      text: 'J’ai empilé 5 étages. Tu fais mieux sur la même partie ?',
      url: 'https://jeu.test/?v=1&seed=100&target=5',
    });
  });

  it('« Copier le lien » : copie le lien du défi et l’annonce', async () => {
    const copy = vi.fn(async () => true);
    const { button, text, end, sink, share } = setup({ copy });
    button('Jouer').click();
    await end(7);
    button('Copier le lien').click();
    await flush();
    expect(copy).toHaveBeenCalledWith('https://jeu.test/?v=1&seed=100&target=7');
    expect(share).not.toHaveBeenCalled();
    expect(text('share-status')).toBe('Lien du défi copié. Colle-le dans un message !');
    expect(names(sink).slice(-2)).toEqual(['share_attempt', 'share_success']);
  });

  it('« Copier le lien » impossible : lien affiché et sélectionné', async () => {
    for (const copy of [async () => false, async (): Promise<boolean> => { throw new Error('x'); }]) {
      document.body.innerHTML = '<main id="app"></main>';
      shell?.destroy();
      const { button, root, end, sink, text } = setup({ copy });
      button('Jouer').click();
      await end(2);
      button('Copier le lien').click();
      await flush();
      const input = root.querySelector<HTMLInputElement>('[data-testid="challenge-link"]')!;
      expect(input.value).toBe('https://jeu.test/?v=1&seed=100&target=2');
      expect(document.activeElement).toBe(input);
      expect(text('share-status')).toBe('Copie automatique impossible. Copie le lien ci-dessous.');
      expect(names(sink)).not.toContain('share_success');
    }
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
    const { button, text, sink } = setup({
      startGame: (o) => {
        if (fail) throw new RangeError('canvas');
        return game.startGame(o);
      },
    });
    button('Jouer').click();
    expect(text('start-error')).toMatch(/pas pu démarrer/);
    button('Réessayer').click();
    expect(names(sink)).toEqual([]); // m1 : aucun run_start sans partie montée
    fail = false;
    button('Réessayer').click();
    expect(game.mounts).toHaveLength(1);
    expect(names(sink)).toEqual(['run_start']);
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

});

describe('Tour du jour (V2)', () => {
  it('joue la seed de la date UTC, figée au lancement, et tient un record du jour', async () => {
    const { game, sink, button, text, end, day, meta } = setup();
    expect(text('daily-hint')).toBe('Le même pour tous · nouveau à 14:00');
    // Tests en UTC+14 (Kiritimati) : minuit UTC = 14:00 locales (ci-dessus).
    button('Défi du jour').click();
    expect(game.mounts[0]!.options.config.seed).toBe(630742688); // vecteur de référence (Python)
    expect(sink.events.at(-1)).toMatchObject({ name: 'run_start', mode: 'daily', day: '2026-11-16' });
    day.now = new Date('2026-11-17T00:00:01Z'); // minuit UTC passe pendant la partie
    await end(6);
    expect(text('daily-outcome')).toBe('Nouveau record du Défi du jour !');
    expect(meta.readDailyBest('2026-11-16')).toBe(6);
    expect(meta.readDailyBest('2026-11-17')).toBe(0);
    button('Rejouer').click(); // nouvelle partie : nouvelle date
    expect(game.mounts[1]!.options.config.seed).toBe(dailySeed('2026-11-17'));
    expect(sink.events.at(-2)).toMatchObject({ name: 'retry', mode: 'daily' });
  });
});

describe('objectifs (V2)', () => {
  it('valide les objectifs actifs au lancement, une seule fois, et persiste la progression', async () => {
    const { button, text, end, place, meta, root } = setup();
    button('Passe').click(); button('Missions et cadeau').click();
    expect([...root.querySelectorAll('[data-testid="goals"] li')].map((li) => li.textContent)).toEqual([
      'Poser au moins 5 étages dans une partie → Apparence Marbré',
      'Faire 2 parfaits consécutifs dans une partie → Apparence Bonbon',
      'Poser au moins 12 étages dans une partie → Univers Orbital',
    ]);
    button('Jouer').click(); // onglet Jouer : retour à l'accueil
    button('Jouer').click();
    place([false, true, true, false, false]);
    await end(5);
    expect(text('completed-goals')).toContain('Apparence Marbré débloqué');
    expect(text('completed-goals')).toContain('Apparence Bonbon débloqué');
    expect(meta.readProgress()).toMatchObject({ completed: ['floors-5', 'streak-2'] });
  });

  it("n'évalue pas d'objectif devenu actif pendant la partie", async () => {
    const meta = createMetaStore(null);
    meta.writeProgress({ completed: ['floors-5', 'streak-2'], selected: { theme: 'confiserie', skin: 'gomme' }, evaluatedRuns: [] });
    const { button, end, meta: m } = setup({ meta });
    button('Jouer').click(); // actifs : floors-12, perfects-5, floors-18
    await end(30); // 30 étages : floors-12 et floors-18 validés ; floors-25 n'était pas actif
    expect(m.readProgress()).toMatchObject({ completed: ['floors-5', 'streak-2', 'floors-12', 'floors-18'] });
  });

  it('une progression corrompue ne bloque pas le jeu', async () => {
    const meta = createMetaStore(null);
    meta.writeProgress('pas un objet');
    const { button, end, text } = setup({ meta });
    button('Jouer').click();
    await end(5);
    expect(text('completed-goals')).toContain('Marbré');
  });
});

describe('accueil V2 et collection', () => {
  it("une seule action principale à l'accueil, focalisée", () => {
    const { root } = setup();
    const primaries = root.querySelectorAll('.btn.primary');
    expect(primaries).toHaveLength(1);
    expect(document.activeElement).toBe(primaries[0]);
    expect(primaries[0]!.textContent).toBe('Jouer');
  });

  it('collection : verrous explicites, choix persistant, onglet actif et focus rendu', async () => {
    const { button, root, text, end, place, meta } = setup();
    button('Collection').click();
    expect(text('collection-count')).toBe('2 / 21 obtenus');
    expect(root.querySelector('[data-testid="nav-collection"]')?.getAttribute('aria-current')).toBe('page');
    // Condition courte à l'écran, « À obtenir » lu par les lecteurs d'écran.
    expect(text('card-skin-marbre')).toContain('À obtenir : Pose 5 étages en une partie');
    expect(text('card-theme-jardin')).toContain('À obtenir : Fais 8 étages au Défi du jour');
    expect(text('card-skin-gomme')).toContain('Équipé');
    expect(root.querySelector('[data-testid="card-skin-marbre"] button')).toBeNull(); // verrouillé : pas de choix
    button('Jouer').click(); // onglet Jouer : retour à l'accueil

    button('Jouer').click();
    place([false, false, false, false, false]);
    await end(5);
    button('Voir la collection').click();
    expect(text('collection-count')).toBe('3 / 21 obtenus');
    const choose = root.querySelector<HTMLButtonElement>('[data-testid="card-skin-marbre"] button')!;
    expect(choose.getAttribute('aria-label')).toBe('Équiper Matière Marbré');
    choose.click();
    await flush();
    expect(text('card-skin-marbre')).toContain('Équipé');
    expect(document.activeElement?.getAttribute('data-testid')).toBe('card-skin-marbre'); // m2 FLK
    expect(meta.readProgress()).toMatchObject({ selected: { theme: 'confiserie', skin: 'marbre' } });
  });

  it("le bouton « Voir la collection » n'apparaît qu'avec une récompense", async () => {
    const { button, root, end } = setup();
    button('Jouer').click();
    await end(2);
    expect(root.querySelector('[data-testid="result-collection"]')).toBeNull();
  });
});

describe('modalité de saisie', () => {
  it('Tab passe en mode clavier ; Espace (touche de jeu) non ; un toucher revient au mode pointeur', () => {
    const { root } = setup();
    const key = (k: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(root.dataset.input).toBe('pointer');
    key(' ');
    expect(root.dataset.input).toBe('pointer');
    key('Tab');
    expect(root.dataset.input).toBe('keyboard');
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(root.dataset.input).toBe('pointer');
  });
});

/** Stockage navigateur simulé : tout passe par JSON, comme un vrai rechargement. */
function memoryStorage(): Storage & { dump(key: string): unknown } {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    dump: (k: string) => JSON.parse(data.get(k) ?? 'null') as unknown,
  };
}

describe('E1 branché : sauvegarde complète et rechargement (revue E1 FLK, M1)', () => {
  it('XP, pièces, calendrier et sélection survivent à chaque chemin d’écriture puis au rechargement', async () => {
    const storage = memoryStorage();
    const first = setup({ meta: createMetaStore(storage), store: createLocalStore(storage) });
    // 1. Fin de partie : 12 étages ; le faux moteur rapporte perfectCount = 1 (série de 2 via
    //    les événements) → 12 + 2 = 14 XP ; 4 + 1 + 3 objectifs × 10 = 35 pièces.
    first.button('Jouer').click();
    first.place([false, true, true, false, true, false, false, false, false, false, false, false]);
    await first.end(12);
    expect(first.text('gains')).toBe('+14 étoiles · +35 pièces');
    // 2. Réclamation du calendrier.
    first.button('Accueil').click();
    expect(first.text('coins')).toBe('35 pièces');
    first.button('Passe').click(); first.button('Missions et cadeau').click();
    first.button('Récupérer +5').click();
    expect(first.text('coins')).toBe('40 pièces');
    expect(first.text('calendar')).toContain('Déjà récupéré');
    // 3. Choix d'apparence.
    first.button('Collection').click();
    first.root.querySelector<HTMLButtonElement>('[data-testid="card-skin-marbre"] button')!.click();
    first.shell.destroy();

    const saved = storage.dump('poc:meta:v1:progress');
    expect(saved).toMatchObject({
      version: 4,
      xp: 14,
      coins: 40,
      selected: { skin: 'marbre' },
      calendar: { lastClaimDate: '2026-11-16', index: 1 },
      completed: ['floors-5', 'streak-2', 'floors-12'],
    });

    // Rechargement : nouveau shell, nouveaux magasins, même stockage.
    document.body.innerHTML = '<main id="app"></main>';
    const second = setup({ meta: createMetaStore(storage), store: createLocalStore(storage) });
    expect(second.text('coins')).toBe('40 pièces');
    second.button('Passe').click(); second.button('Missions et cadeau').click();
    expect(second.text('xp')).toBe('Encore 26 étoiles pour le niveau 2');
    expect(second.text('calendar')).toContain('Déjà récupéré');
    second.button('Collection').click();
    expect(second.text('card-skin-marbre')).toContain('Équipé');
    expect(storage.dump('poc:meta:v1:progress')).toEqual(saved); // la lecture seule ne réécrit rien
  });

  it('une sauvegarde v1 (A3a) est migrée au chargement : prime unique de 10 pièces par objectif', async () => {
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ completed: ['floors-5', 'streak-2'], selected: { theme: 'confiserie', skin: 'gomme' }, evaluatedRuns: [] }));
    const { text, button, end } = setup({ meta: createMetaStore(storage) });
    expect(text('coins')).toBe('20 pièces');
    button('Jouer').click();
    await end(3); // perfectCount 1 : 1 + 1 = 2 pièces, 3 + 2 = 5 XP
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ version: 4, coins: 22, xp: 5, grants: ['v2-objectives-backfill'] });
  });

  it('sauvegarde d’une version future : lue, jamais réécrite', async () => {
    const storage = memoryStorage();
    const future = { version: 5, completed: [], xp: 900, coins: 400, champInconnu: true };
    storage.setItem('poc:meta:v1:progress', JSON.stringify(future));
    const { text, button, end } = setup({ meta: createMetaStore(storage) });
    expect(text('coins')).toBe('400 pièces');
    button('Passe').click(); button('Missions et cadeau').click();
    expect(document.body.textContent).toContain('version plus récente');
    button('Jouer').click(); // onglet
    button('Jouer').click();
    await end(8);
    expect(storage.dump('poc:meta:v1:progress')).toEqual(future);
  });
});

describe('E1 branché : deux onglets sur le même stockage (revue FLK, M2)', () => {
  function tab(storage: Storage, id: string) {
    const root = document.createElement('main');
    root.id = id;
    document.body.append(root);
    const game = fakeGame();
    const tracker = createTracker({ buildId: 'b', rulesVersion: 1, sessionId: id, sink: memorySink() });
    let run = 0;
    const shellTab = createShell({
      root,
      startGame: game.startGame,
      tracker,
      store: createLocalStore(storage),
      meta: createMetaStore(storage),
      today: () => new Date('2026-11-16T22:30:00Z'),
      url: 'https://jeu.test/',
      replaceUrl: () => {},
      share: async () => 'shared',
      newSeed: () => 7,
      newRunId: () => `${id}-run${++run}`,
      now: (() => {
        let t = 0;
        return () => (t += 1000); // chaque lecture avance d'1 s : le délai de garde s'écoule
      })(),
    });
    const button = (label: string) => [...root.querySelectorAll('button')].find((b) => b.textContent === label)!;
    const text = (t: string) => root.querySelector(`[data-testid="${t}"]`)?.textContent ?? null;
    return { root, game, shell: shellTab, button, text };
  }

  it('une réclamation dans A et une partie dans B se cumulent ; pas de seconde réclamation le même jour', async () => {
    document.body.innerHTML = '';
    const storage = memoryStorage();
    const a = tab(storage, 'a');
    const b = tab(storage, 'b'); // ouvert avant la réclamation : son écran propose encore « Prendre »
    a.button('Passe').click(); a.button('Missions et cadeau').click();
    a.button('Récupérer +5').click();
    expect(a.text('coins')).toBe('5 pièces');
    a.button('Jouer').click(); // onglet Jouer : retour à l'accueil

    b.button('Jouer').click();
    b.game.mounts[0]!.options.onEnd(result(3)); // 3 étages, 1 parfait → 2 pièces, 5 XP
    await flush();
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ coins: 7, xp: 5, calendar: { lastClaimDate: '2026-11-16' } });

    b.button('Accueil').click();
    expect(b.text('coins')).toBe('7 pièces');
    b.button('Passe').click(); b.button('Missions et cadeau').click();
    expect(b.text('calendar')).toContain('Déjà récupéré');

    // A affiche encore un état ancien : sa partie relit d'abord le stockage.
    a.button('Jouer').click();
    a.game.mounts[0]!.options.onEnd(result(6)); // 2 + 1 = 3 pièces + 10 (objectif 5 étages), 6 + 2 = 8 XP
    await flush();
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ coins: 20, xp: 13, completed: ['floors-5'] });
    a.shell.destroy();
    b.shell.destroy();
  });

  it('un bouton « Récupérer » resté affiché dans un onglet ne permet pas de réclamer deux fois', () => {
    document.body.innerHTML = '';
    const storage = memoryStorage();
    const a = tab(storage, 'a');
    const b = tab(storage, 'b');
    b.button('Passe').click(); b.button('Missions et cadeau').click(); // B affiche « Prendre +5 »
    a.button('Passe').click(); a.button('Missions et cadeau').click();
    a.button('Récupérer +5').click();
    b.button('Récupérer +5').click(); // écran de B périmé
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ coins: 5, calendar: { index: 1 } });
    expect(b.text('calendar')).toContain('Déjà récupéré');
    a.shell.destroy();
    b.shell.destroy();
  });

  it("l'événement storage d'un autre onglet rafraîchit l'accueil", () => {
    document.body.innerHTML = '';
    const storage = memoryStorage();
    const a = tab(storage, 'a');
    const b = tab(storage, 'b');
    a.button('Passe').click(); a.button('Missions et cadeau').click();
    a.button('Récupérer +5').click();
    expect(b.text('coins')).toBe('0 pièce');
    window.dispatchEvent(new StorageEvent('storage', { key: 'poc:meta:v1:progress' }));
    expect(b.text('coins')).toBe('5 pièces');
    a.shell.destroy();
    b.shell.destroy();
  });
});

describe('passage de niveau (revue FLK, m1)', () => {
  it("n'annonce un titre que s'il est nouveau", async () => {
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 2, xp: 100, grants: ['v2-objectives-backfill'] })); // niveau 2
    const { button, end, text } = setup({ meta: createMetaStore(storage) });
    button('Jouer').click();
    await end(30); // +32 XP → 132 : niveau 3, sans titre propre
    expect(text('level-up')).toBe('Niveau 3 atteint !');
  });
});

/**
 * Gestionnaire Web Locks fidèle : un seul détenteur par nom, file d'attente FIFO, et le verrou
 * reste tenu tant que la promesse renvoyée par le détenteur n'est pas résolue.
 */
function fakeLocks() {
  const tails = new Map<string, Promise<unknown>>();
  const requested: string[] = [];
  return {
    requested,
    request(name: string, callback: () => unknown): Promise<unknown> {
      requested.push(name);
      const previous = tails.get(name) ?? Promise.resolve();
      const run = previous.then(() => callback());
      tails.set(name, run.catch(() => undefined));
      return run;
    },
  } as unknown as Pick<LockManager, 'request'> & { requested: string[] };
}

describe('E1 branché : onglets réellement concurrents sous verrou Web Locks (revue C6 Codex)', () => {
  it("un onglet qui tient le verrou pendant sa lecture-écriture ne perd pas la réclamation de l'autre", async () => {
    document.body.innerHTML = '<main id="app"></main>';
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 2, coins: 0, xp: 0, grants: ['v2-objectives-backfill'] }));
    const locks = fakeLocks();
    const { button, text } = setup({ meta: createMetaStore(storage), store: createLocalStore(storage), locks });

    // Onglet B (simulé) : lit, attend (traitement en cours), puis écrit +100 — tout sous le verrou.
    let releaseB!: () => void;
    const bDone = locks.request(PROGRESS_LOCK, async () => {
      const docB = storage.dump('poc:meta:v1:progress') as { coins: number };
      await new Promise<void>((r) => (releaseB = r));
      storage.setItem('poc:meta:v1:progress', JSON.stringify({ ...docB, coins: docB.coins + 100 }));
    });

    // Onglet A réclame PENDANT que B tient le verrou : sa section attend.
    button('Passe').click(); button('Missions et cadeau').click();
    button('Récupérer +5').click();
    await flush();
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ coins: 0 }); // A n'a pas écrit
    releaseB();
    await bDone;
    await flush();
    // A a relu APRÈS l'écriture de B : 100 + 5, réclamation conservée.
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ coins: 105, calendar: { lastClaimDate: '2026-11-16' } });
    expect(text('coins')).toBe('105 pièces');
    expect(locks.requested.filter((n) => n === PROGRESS_LOCK)).toHaveLength(2);
  });

  it('la fin de partie (record, progression, record du jour) passe sous le même verrou', async () => {
    const locks = fakeLocks();
    const storage = memoryStorage();
    const { button, end, text } = setup({ meta: createMetaStore(storage), store: createLocalStore(storage), locks });
    button('Défi du jour').click();
    await end(6);
    await flush();
    expect(locks.requested).toEqual([PROGRESS_LOCK]);
    expect(text('gains')).toContain('étoile');
    expect(storage.dump('poc:meta:v1:daily')).toEqual({ '2026-11-16': 6 });
  });
});

describe('apparences branchées (A4)', () => {
  it('la partie suivante est montée avec la sélection, y compris après rechargement', async () => {
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 2, completed: ['floors-5', 'floors-12'], grants: ['v2-objectives-backfill'] }));
    const first = setup({ meta: createMetaStore(storage) });
    first.button('Jouer').click();
    expect(first.game.mounts[0]!.options.appearance).toEqual({ theme: 'confiserie', skin: 'gomme' });
    await first.end(1);
    first.button('Accueil').click();
    first.button('Collection').click();
    first.root.querySelector<HTMLButtonElement>('[data-testid="card-skin-marbre"] button')!.click();
    first.root.querySelector<HTMLButtonElement>('[data-testid="card-theme-orbital"] button')!.click();
    first.button('Jouer').click(); // onglet Jouer : retour à l'accueil
    first.button('Jouer').click();
    expect(first.game.mounts[1]!.options.appearance).toEqual({ theme: 'orbital', skin: 'marbre' });
    first.shell.destroy();

    document.body.innerHTML = '<main id="app"></main>';
    const second = setup({ meta: createMetaStore(storage) });
    second.button('Jouer').click();
    expect(second.game.mounts[0]!.options.appearance).toEqual({ theme: 'orbital', skin: 'marbre' });
  });
});

describe('menu V3 (lisible par un enfant de 8 ans)', () => {
  it("accueil : Jouer, Défi du jour, record, ton look, et la barre d'onglets — rien d'autre", () => {
    const { root } = setup();
    const buttons = [...root.querySelectorAll('button')].map((b) => b.textContent);
    // V6 : barre du haut (aide, réglages), Jouer, Défi du jour, « Ton look », puis les cinq onglets.
    expect(buttons).toEqual(['Comment jouer', 'Réglages', 'Jouer', 'Défi du jour', 'Changer', 'Jouer', 'Boutique', 'Collection', 'Passe', 'Classement']);
    expect(root.querySelector('[data-testid="nav-home"]')?.getAttribute('aria-current')).toBe('page');
    expect(root.querySelectorAll('.btn.primary')).toHaveLength(1);
    expect(root.querySelector('[data-testid="play"] svg.ic.play')).not.toBeNull();
    // Aucun panneau empilé ni explication technique sur l'accueil.
    expect(root.querySelectorAll('.panel')).toHaveLength(0);
    expect(root.textContent).not.toMatch(/UTC|XP|progression locale/i);
  });

  it('signale un cadeau du jour à récupérer sur l’onglet Passe, puis plus après l’avoir récupéré', () => {
    const { root, button } = setup();
    const tab = () => root.querySelector('[data-testid="nav-season"]')!;
    expect(tab().classList.contains('has-dot')).toBe(true);
    expect(tab().getAttribute('aria-label')).toBe('Passe, une récompense t’attend');
    button('Passe').click(); button('Missions et cadeau').click();
    button('Récupérer +5').click();
    expect(tab().classList.contains('has-dot')).toBe(false);
  });

  it('V6 : chaque onglet a son écran, un titre focalisé et l’onglet marqué ; Réglages revient au dernier onglet', () => {
    const { button, root } = setup();
    for (const [tab, title, testId] of [['Boutique', 'Boutique', 'nav-shop'], ['Collection', 'Collection', 'nav-collection'], ['Passe', 'Passe · Saison 1', 'nav-season'], ['Classement', 'Classement', 'nav-leaderboard']] as const) {
      button(tab).click();
      expect(document.activeElement?.textContent).toBe(title);
      expect(root.querySelector(`[data-testid="${testId}"]`)?.getAttribute('aria-current')).toBe('page');
      expect(root.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    }
    button('Boutique').click();
    button('Réglages').click();
    expect(document.activeElement?.textContent).toBe('Réglages');
    button('Retour').click();
    expect(root.querySelector('[data-testid="nav-shop"]')?.getAttribute('aria-current')).toBe('page');
    expect(document.activeElement?.getAttribute('data-testid')).toBe('nav-settings');
  });
});

describe('boutique en pièces (V3-A2)', () => {
  const shop = {
    catalog: [{ id: 'ceramique', kind: 'skin' as const, price: 50, name: 'Céramique' }],
    isAvailable: () => true,
    preview: () => true,
  };

  it('aperçu, prix dans le bouton, confirmation, achat, révélation, « Équiper » appliqué à la partie suivante et au rechargement', async () => {
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 2, coins: 70, grants: ['v2-objectives-backfill'] }));
    const { button, text, root, game } = setup({ meta: createMetaStore(storage), shop });
    button('Boutique').click();
    expect(root.querySelector('[data-testid="shop-ceramique"] canvas.swatch.preview')).not.toBeNull();
    expect(text('wallet')).toContain('70 pièces du jeu');
    const buy = root.querySelector<HTMLButtonElement>('[data-testid="buy-ceramique"]')!;
    expect(buy.textContent).toBe('Acheter · 50');
    expect(buy.getAttribute('aria-label')).toBe('Acheter Céramique pour 50 pièces du jeu');
    expect(buy.querySelector('svg.ic.coin')).not.toBeNull();
    buy.click();
    expect(text('confirm-text')).toBe('Prix : 50 pièces du jeu. Il t’en restera 20.');
    expect(document.activeElement?.getAttribute('data-testid')).toBe('confirm-buy');
    button('Oui, acheter · 50').click();
    expect(text('shop-success')).toContain('C’est à toi');
    expect(text('coins')).toBe('20 pièces');
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ coins: 20, inventory: ['ceramique'] });
    // Révélation : l'objet obtenu, sa rareté, Équiper ou plus tard.
    expect(text('reveal-name')).toBe('Céramique');
    button('Plus tard').click();
    expect(text('shop-ceramique')).toContain('Possédé');
    button('Équiper').click();
    expect(text('shop-ceramique')).toContain('Équipé');
    button('Jouer').click(); // onglet
    button('Jouer').click();
    expect(game.mounts[0]!.options.appearance).toEqual({ theme: 'confiserie', skin: 'ceramique' });

    document.body.innerHTML = '<main id="app"></main>';
    const again = setup({ meta: createMetaStore(storage), shop });
    again.button('Jouer').click();
    expect(again.game.mounts[0]!.options.appearance?.skin).toBe('ceramique');
  });

  it('« Non » annule sans rien débiter ; solde insuffisant affiché sans bouton d’achat', () => {
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 2, coins: 50, grants: ['v2-objectives-backfill'] }));
    const first = setup({ meta: createMetaStore(storage), shop });
    first.button('Boutique').click();
    first.button('Acheter · 50').click();
    first.button('Annuler').click();
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ coins: 50 });
    first.shell.destroy();

    document.body.innerHTML = '<main id="app"></main>';
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 2, coins: 30, grants: ['v2-objectives-backfill'] }));
    const poor = setup({ meta: createMetaStore(storage), shop });
    poor.button('Boutique').click();
    const short = poor.root.querySelector<HTMLButtonElement>('[data-testid="buy-ceramique"]')!;
    expect(short.textContent).toBe('Il manque 20');
    expect(short.disabled).toBe(true);
    expect(short.getAttribute('aria-label')).toBe('Solde insuffisant : il manque 20 pièces du jeu pour Céramique');
  });

  it('deux onglets : un achat confirmé dans un onglet périmé ne débite pas deux fois', () => {
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 2, coins: 120, grants: ['v2-objectives-backfill'] }));
    document.body.innerHTML = '<main id="a"></main><main id="b"></main>';
    const make = (id: string) => {
      const root = document.getElementById(id)!;
      const sh = createShell({
        root, startGame: fakeGame().startGame,
        tracker: createTracker({ buildId: 'b', rulesVersion: 1, sessionId: id, sink: memorySink() }),
        store: createLocalStore(storage), meta: createMetaStore(storage), today: () => new Date('2026-11-16T22:30:00Z'),
        url: 'https://jeu.test/', replaceUrl: () => {}, share: async () => 'shared', newSeed: () => 1, newRunId: () => `${id}-r`, shop,
      });
      const btn = (label: string) => [...root.querySelectorAll('button')].find((b) => b.textContent === label)!;
      return { sh, btn, root };
    };
    const a = make('a');
    const b = make('b');
    for (const t of [a, b]) {
      t.btn('Boutique').click();
      t.btn('Acheter · 50').click();
    }
    a.btn('Oui, acheter · 50').click();
    b.btn('Oui, acheter · 50').click(); // écran de B périmé : relu sous verrou, déjà possédé
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ coins: 70, inventory: ['ceramique'] });
    expect(b.root.querySelector('[data-testid="shop-owned"]')?.textContent).toBe('Tu as déjà Céramique.');
    a.sh.destroy();
    b.sh.destroy();
  });

  it('catalogue réel : rien n’est vendu tant que le moteur ne sait pas dessiner les objets', () => {
    const { button, text } = setup({ shop: { catalog: [{ id: 'graphite', kind: 'skin', price: 60, name: 'Graphite' }], isAvailable: () => false } });
    button('Boutique').click();
    expect(text('shop-empty')).toBe('Rien à vendre pour l’instant. Reviens bientôt !');
  });
});

describe('classement (V3-A3)', () => {
  const T = (mode: 'free' | 'daily', n = 1, seed = 4242, day?: string): RankTicket => ({
    ticket: n.toString(16).padStart(32, '0'),
    seed,
    rulesVersion: 3,
    mode,
    ...(day ? { day } : {}),
    expiresAt: Date.parse('2026-11-17T02:00:00Z'),
  });
  const page = (over: Partial<BoardPage> = {}): BoardPage => ({
    kind: 'global', demo: false, total: 2, nextOffset: null,
    entries: [
      { rank: 1, pseudo: 'Lune', score: 12, height: 12, perfectCount: 2 },
      { rank: 2, pseudo: 'Alex', score: 9, height: 9, perfectCount: 1, you: true },
    ],
    you: { rank: 2, score: 9 },
    ...over,
  });
  type Fn<K extends keyof LeaderboardService> = Exclude<LeaderboardService[K], boolean>;
  function fakeService(over: { issueTicket?: Mock<Fn<'issueTicket'>>; read?: Mock<Fn<'read'>> } = {}) {
    let n = 0;
    return {
      available: true,
      issueTicket: over.issueTicket ?? vi.fn<Fn<'issueTicket'>>(async (mode) => ({ ok: true, value: T(mode, ++n, mode === 'daily' ? dailySeed('2026-11-16') : 4242, mode === 'daily' ? '2026-11-16' : undefined) })),
      submit: vi.fn<Fn<'submit'>>(async () => ({ ok: true, value: { ranked: true, score: 9, placements: { global: { rank: 2, total: 7, improved: true } } } })),
      read: over.read ?? vi.fn<Fn<'read'>>(async () => ({ ok: true, value: page() })),
    };
  }
  const withPseudo = () => {
    const meta = createMetaStore(null);
    meta.writePlayer({ id: 'c'.repeat(32), pseudo: 'Alex' });
    return meta;
  };

  it('sans serveur : écran « Indisponible », aucune requête, la partie reste libre et locale', async () => {
    const { button, text, root, end } = setup();
    button('Classement').click();
    expect(text('board-unavailable')).toContain('indisponible');
    button('Jouer').click(); // onglet
    button('Jouer').click();
    await end(3);
    expect(text('rank-status')).toBe('Score gardé sur cet appareil.');
    expect(root.querySelector('[data-testid="rank-retry"]')?.hasAttribute('hidden')).toBe(true);
  });

  it('pseudo : refuse un pseudo invalide, enregistre un pseudo valide, puis précharge les tickets', async () => {
    const svc = fakeService();
    const meta = createMetaStore(null);
    const { button, text, root } = setup({ leaderboard: svc, meta, newPlayerId: () => 'd'.repeat(32) });
    expect(svc.issueTicket).not.toHaveBeenCalled(); // pas de pseudo : pas de requête
    button('Classement').click();
    await flush();
    const input = root.querySelector<HTMLInputElement>('[data-testid="pseudo-input"]')!;
    input.value = '<b>';
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(text('pseudo-error')).toContain('ne va pas');
    root.querySelector<HTMLInputElement>('[data-testid="pseudo-input"]')!.value = '  Super   Kiwi ';
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(text('pseudo')).toBe('Ton pseudo : Super Kiwi');
    expect(meta.readPlayer()).toEqual({ id: 'd'.repeat(32), pseudo: 'Super Kiwi' });
    expect(svc.issueTicket.mock.calls.map((c) => c[0]).sort()).toEqual(['daily', 'free']);
    await flush();
    expect(text('board-you')).toBe('Ta place : 2e sur 2');
  });

  it('partie avec ticket : seed du serveur, envoi des entrées (pas du score), rang affiché', async () => {
    const svc = fakeService();
    const { button, text, game, end } = setup({ leaderboard: svc, meta: withPseudo() });
    await flush();
    button('Jouer').click();
    expect(game.mounts[0]!.options.config.seed).toBe(4242);
    await end(9);
    await flush();
    expect(svc.submit).toHaveBeenCalledTimes(1);
    const sent = svc.submit.mock.calls[0]![0] as unknown as Record<string, unknown>;
    expect(sent).toEqual({ ticket: '1'.padStart(32, '0'), playerId: 'c'.repeat(32), pseudo: 'Alex', inputTicks: [1, 2] });
    expect(text('rank-status')).toBe('Classement Monde : 2e sur 7.');
  });

  it('hors ligne à l’envoi : message honnête et « Envoyer encore » rejoue la même soumission', async () => {
    const svc = fakeService();
    svc.submit.mockResolvedValueOnce({ ok: false, error: 'offline' });
    const { button, text, end, root } = setup({ leaderboard: svc, meta: withPseudo() });
    await flush();
    button('Jouer').click();
    await end(9);
    await flush();
    expect(text('rank-status')).toBe('Pas envoyé. Pas de connexion. Vérifie Internet, puis réessaie.');
    const retry = root.querySelector<HTMLButtonElement>('[data-testid="rank-retry"]')!;
    expect(retry.hidden).toBe(false);
    retry.click();
    await flush();
    expect(svc.submit).toHaveBeenCalledTimes(2);
    expect(svc.submit.mock.calls[1]![0]).toEqual(svc.submit.mock.calls[0]![0]);
    expect(text('rank-status')).toBe('Classement Monde : 2e sur 7.');
  });

  it('pas de ticket (serveur injoignable au départ) : partie jouable, non classée, rien envoyé', async () => {
    const svc = fakeService({ issueTicket: vi.fn<Fn<'issueTicket'>>(async () => ({ ok: false, error: 'offline' })) });
    const { button, text, game, end } = setup({ leaderboard: svc, meta: withPseudo() });
    await flush();
    button('Jouer').click();
    expect(game.mounts[0]!.options.config.seed).toBe(100); // seed locale
    await end(5);
    expect(svc.submit).not.toHaveBeenCalled();
    expect(text('rank-status')).toContain('non classée');
  });

  it('défi du jour : ticket du jour seulement si sa seed est celle du jour ; défi d’un ami jamais classé', async () => {
    const svc = fakeService();
    const { button, game, end } = setup({ leaderboard: svc, meta: withPseudo() });
    await flush();
    button('Défi du jour').click();
    expect(game.mounts[0]!.options.config.seed).toBe(dailySeed('2026-11-16'));
    await end(4);
    await flush();
    expect(svc.submit).toHaveBeenCalledTimes(1);
    expect((svc.submit.mock.calls[0]![0] as { ticket: string }).ticket).toBe('2'.padStart(32, '0'));
  });

  it('ticket du jour incohérent (autre seed ou autre jour) : ignoré, partie du jour locale non classée', async () => {
    for (const bad of [T('daily', 9, 777, '2026-11-16'), T('daily', 9, dailySeed('2026-11-15'), '2026-11-15')]) {
      const svc = fakeService({ issueTicket: vi.fn<Fn<'issueTicket'>>(async (mode) => ({ ok: true, value: mode === 'daily' ? bad : T('free') })) });
      const { button, game, end } = setup({ leaderboard: svc, meta: withPseudo() });
      await flush();
      button('Défi du jour').click();
      expect(game.mounts[0]!.options.config.seed).toBe(dailySeed('2026-11-16'));
      await end(4);
      await flush();
      expect(svc.submit).not.toHaveBeenCalled();
      shell?.destroy();
    }
  });

  it('tableaux : chargement, démo signalée, erreur avec Réessayer, pagination, réponse périmée ignorée', async () => {
    let resolveSlow: (v: ServiceResult<BoardPage>) => void = () => undefined;
    const read = vi.fn<LeaderboardService['read']>();
    const svc = fakeService({ read });
    read
      .mockImplementationOnce(() => new Promise((r) => (resolveSlow = r)))
      .mockResolvedValueOnce({ ok: true, value: page({ demo: true, nextOffset: 2, total: 3 }) })
      .mockResolvedValueOnce({ ok: true, value: page({ entries: [{ rank: 3, pseudo: 'Kiwi', score: 1, height: 1, perfectCount: 0 }], total: 3 }) })
      .mockResolvedValueOnce({ ok: false, error: 'busy' })
      .mockResolvedValueOnce({ ok: true, value: page({ entries: [], total: 0 }) });
    const { button, text, root } = setup({ leaderboard: svc, meta: withPseudo() });
    button('Classement').click();
    expect(text('board-loading')).toBe('Chargement…');
    button('Semaine').click(); // la réponse lente du tableau Monde ne doit plus s'afficher
    await flush();
    resolveSlow({ ok: true, value: page({ entries: [{ rank: 1, pseudo: 'Périmé', score: 99, height: 99, perfectCount: 0 }] }) });
    await flush();
    expect(root.textContent).not.toContain('Périmé');
    expect(text('board-demo')).toContain('Mode démo');
    expect(root.querySelector('[data-testid="board-weekly"]')!.getAttribute('aria-pressed')).toBe('true');
    button('Voir plus').click();
    await flush();
    // Règles v2 : le classement compte des points (corrigé en V4, l'écran disait « étages »).
    expect([...root.querySelectorAll('.board-list li')].map((li) => li.textContent)).toEqual(['1erLune12 points', '2eAlex (toi)9 points', '3eKiwi1 point']);
    button('Aujourd’hui').click();
    await flush();
    expect(text('board-error')).toBe('Beaucoup de monde en ce moment. Réessaie dans une minute.');
    button('Réessayer').click();
    await flush();
    expect(text('board-empty')).toBe('Personne pour l’instant. Sois le premier !');
    expect(read.mock.calls.map((c) => c[0])).toEqual(['global', 'weekly', 'weekly', 'daily', 'daily']);
  });
});

describe('passe de saison (V3-A5)', () => {
  it('avant la saison : étoiles non comptées, date de début affichée', async () => {
    const storage = memoryStorage();
    const { button, text, end, root, place } = setup({ meta: createMetaStore(storage) });
    button('Jouer').click();
    place([true, true, true]);
    await end(15); // date du test : 16/11, la saison commence le 17/11
    button('Accueil').click();
    button('Passe').click();
    expect(text('season-summary')).toBe('Commence le 17 novembre.');
    expect(storage.dump('poc:meta:v1:progress')).not.toHaveProperty('season');
    expect(root.querySelector('[data-testid="nav-rewards"]')).toBeNull();
    expect(root.querySelector('[data-testid="claim-all"]')).toBeNull();
  });

  it('pendant la saison : une partie ajoute ses étoiles une seule fois', async () => {
    const storage = memoryStorage();
    const { button, end, game, day } = setup({ meta: createMetaStore(storage) });
    day.now = new Date('2026-12-01T10:00:00Z');
    button('Jouer').click();
    await end(15);
    game.mounts[0]!.options.onEnd({ seed: 1, rulesVersion: 1, score: 15, perfectCount: 1, durationTicks: 500, inputTicks: [1, 2] }); // rappel répété
    await flush();
    const xp = (storage.dump('poc:meta:v1:progress') as { xp: number }).xp;
    expect(xp).toBeGreaterThan(0);
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ season: { id: 's1', stars: xp } });
  });

  it('pendant la saison : jauge, réclamation, aucune double prise entre deux onglets', async () => {
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 3, coins: 0, grants: ['v2-objectives-backfill'], season: { id: 's1', stars: 25, claimed: [] } }));
    const a = setup({ meta: createMetaStore(storage) });
    a.day.now = new Date('2026-12-01T10:00:00Z');
    a.button('Passe').click();
    expect(a.text('season-level')).toBe('Niveau1/ 30');
    expect(a.text('season-summary')).toBe('15 étoiles avant le niveau 2 · jusqu’au 28 février');
    expect(a.text('premium-note')).toContain('Argent réel');
    expect(a.text('premium-note')).toContain('rien n’est en vente');
    expect(a.root.querySelector<HTMLButtonElement>('[data-testid="premium-soon"]')!.disabled).toBe(true);
    expect(a.text('tier-1-premium')).toContain('Premium');
    expect(a.text('tier-2-free')).toContain('Verrouillé · 15 ★');
    expect(a.root.querySelector('[data-testid="tier-2-free"] svg.ic.lock')).not.toBeNull();
    const stale = a.root.querySelector<HTMLButtonElement>('[data-testid="claim-tier-1"]')!;
    expect(stale.textContent).toBe('Récupérer');
    stale.click();
    await flush();
    expect(a.text('season-notice')).toBe('Récupéré : +10 pièces.');
    stale.click(); // bouton périmé (double appui) : déjà récupéré
    await flush();
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ coins: 10, season: { claimed: ['free:1'] } });
    expect(a.text('tier-1-free')).toContain('Récupéré');
    expect(a.root.querySelector('[data-testid="tier-1-free"] svg.ic.check')).not.toBeNull();
  });
});

describe('reprise, bonus et résultats v2 (V3-A6)', () => {
  type Handle = { continueRun: ReturnType<typeof vi.fn>; declineContinue: ReturnType<typeof vi.fn> };
  function reviveGame() {
    const mounts: { options: StartOptions; handle: Handle }[] = [];
    const startGame: StartGame = (options) => {
      const handle = { pause: vi.fn(), resume: vi.fn(), destroy: vi.fn(), continueRun: vi.fn(() => true), declineContinue: vi.fn() };
      mounts.push({ options, handle });
      return handle;
    };
    return { startGame, mounts };
  }
  const v2 = (height: number, score: number, continues: 0 | 1 = 0) => ({
    seed: 7, rulesVersion: 2 as const, score, height, perfectCount: 1, bestPerfectStreak: 1, bonusCount: 1,
    continues, durationTicks: 900, inputTicks: [1, 2, 3], continueTicks: continues ? [2] : [],
  });
  const manualAds = () => {
    const calls: ((o: AdOutcome) => void)[] = [];
    const ads: RewardedAdProvider = { kind: 'demo', label: 'Mode démo : pas de vraie vidéo', show: () => new Promise((r) => calls.push(r)) };
    return { ads, calls };
  };

  it('sans régie ni vie : pas d’allowContinue ; une offre éventuelle se termine aussitôt', () => {
    const g = reviveGame();
    const { button, root } = setup({ startGame: g.startGame });
    button('Jouer').click();
    expect(g.mounts[0]!.options.allowContinue).toBeUndefined();
    g.mounts[0]!.options.onGameEvent!({ type: 'continue-offer', tick: 50 });
    guardElapsed(); // délai de garde de l'offre (V4)
    expect(root.querySelector('[data-testid="revive"]')).toBeNull();
    expect(g.mounts[0]!.handle.declineContinue).toHaveBeenCalledTimes(1);
  });

  it('vidéo (démo libellée) : double appui et rappel répété → une seule reprise', async () => {
    const g = reviveGame();
    const { ads, calls } = manualAds();
    const { button, root, text } = setup({ startGame: g.startGame, revive: { ads } });
    button('Jouer').click();
    const m = g.mounts[0]!;
    expect(m.options.allowContinue).toBe(true);
    m.options.onGameEvent!({ type: 'continue-offer', tick: 50 });
    guardElapsed(); // délai de garde de l'offre (V4)
    expect(text('revive-demo')).toContain('Mode démo');
    expect(document.activeElement?.textContent).toBe('Regarder une vidéo');
    const video = root.querySelector<HTMLButtonElement>('[data-testid="revive-ad"]')!;
    video.click();
    video.click();
    expect(calls).toHaveLength(1);
    calls[0]!('rewarded');
    await flush();
    expect(m.handle.continueRun).toHaveBeenCalledTimes(1);
    expect(root.querySelector('[data-testid="revive"]')).toBeNull();
    m.options.onGameEvent!({ type: 'continue-offer', tick: 90 }); // second raté : déjà récompensé
    guardElapsed(); // délai de garde de l'offre (V4)
    expect(root.querySelector('[data-testid="revive"]')).not.toBeNull();
  });

  it.each(['dismissed', 'no-fill', 'error'] as const)('vidéo « %s » : pas de reprise, message, Terminer finit la partie', async (outcome) => {
    const g = reviveGame();
    const { ads, calls } = manualAds();
    const { button, text } = setup({ startGame: g.startGame, revive: { ads } });
    button('Jouer').click();
    const m = g.mounts[0]!;
    m.options.onGameEvent!({ type: 'continue-offer', tick: 50 });
    guardElapsed(); // délai de garde de l'offre (V4)
    button('Regarder une vidéo').click();
    calls[0]!(outcome);
    await flush();
    expect(m.handle.continueRun).not.toHaveBeenCalled();
    expect(text('revive-status')).toBe(AD_MESSAGES[outcome]);
    button('Terminer').click();
    expect(m.handle.declineContinue).toHaveBeenCalledTimes(1);
  });

  it('vie possédée : consommée une fois, reprise ; échec : rien retiré, message', async () => {
    const g = reviveGame();
    const consume = vi.fn<LivesProvider['consume']>().mockResolvedValueOnce('error').mockResolvedValueOnce('ok');
    const { button, text } = setup({ startGame: g.startGame, revive: { lives: { count: () => 2, consume, refund: vi.fn(async () => undefined) } } });
    button('Jouer').click();
    const m = g.mounts[0]!;
    m.options.onGameEvent!({ type: 'continue-offer', tick: 50 });
    guardElapsed(); // délai de garde de l'offre (V4)
    button('Utiliser une vie (2)').click();
    await flush();
    expect(text('revive-status')).toContain('Rien n’a été retiré');
    expect(m.handle.continueRun).not.toHaveBeenCalled();
    button('Utiliser une vie (2)').click();
    await flush();
    expect(consume.mock.calls).toEqual([['run1:revive'], ['run1:revive']]); // même demande : idempotente côté serveur
    expect(m.handle.continueRun).toHaveBeenCalledTimes(1);
  });

  it('Tour du jour et défi : jamais de reprise', () => {
    const g = reviveGame();
    const { ads } = manualAds();
    const { button } = setup({ startGame: g.startGame, revive: { ads } });
    button('Défi du jour').click();
    expect(g.mounts[0]!.options.allowContinue).toBeUndefined();
  });

  it('boosts annoncés pour les lecteurs d’écran : nom, durée et ce qu’ils font (v2 et v3)', () => {
    const g = reviveGame();
    const { button, text } = setup({ startGame: g.startGame });
    button('Jouer').click();
    const emit = g.mounts[0]!.options.onGameEvent!;
    emit({ type: 'bonus-start', bonus: 'double', floors: 5 });
    expect(text('live')).toBe('×2 pour 5 étages : les points comptent double !');
    emit({ type: 'bonus-end', bonus: 'double' });
    expect(text('live')).toBe('Fin du ×2.');
    emit({ type: 'bonus-start', bonus: 'aimant', floors: 5 });
    expect(text('live')).toBe('Aimant pour 5 étages : les blocs presque bien placés se collent !');
    emit({ type: 'bonus-start', bonus: 'bouclier', floors: 6 });
    expect(text('live')).toBe('Bouclier pour 6 étages : un raté sera rattrapé !');
    emit({ type: 'saved', tick: 300, floor: 9, recoverTicks: 90 });
    expect(text('live')).toBe('Sauvé par le Bouclier ! Le bloc repart.');
    emit({ type: 'fever-start' });
    expect(text('live')).toBe('Fièvre ! Points doublés tant que tu enchaînes les parfaits.');
    emit({ type: 'fever-end' });
    expect(text('live')).toBe('Fin de la Fièvre.');
  });

  it('résultat v2 : points affichés, gains et record sur la hauteur ; reprise hors classement', async () => {
    const g = reviveGame();
    const storage = memoryStorage();
    const svc = { available: true, issueTicket: vi.fn(async (mode: 'free' | 'daily') => ({ ok: true as const, value: { ticket: '1'.padStart(32, '0'), seed: 5, rulesVersion: 3, mode, expiresAt: Date.parse('2026-11-17T02:00:00Z'), ...(mode === 'daily' ? { day: '2026-11-16' } : {}) } })), submit: vi.fn(), read: vi.fn() };
    const meta = createMetaStore(storage);
    meta.writePlayer({ id: 'c'.repeat(32), pseudo: 'Alex' });
    const { button, text, store } = setup({ startGame: g.startGame, meta, leaderboard: svc as unknown as LeaderboardService });
    await flush();
    button('Jouer').click();
    g.mounts[0]!.options.onEnd(v2(6, 40, 1));
    await flush();
    expect(text('score')).toBe('6 étages');
    expect(text('points')).toBe('40 points');
    expect(text('revived')).toContain('hors classement');
    expect(store.readBest()).toBe(6);
    expect((storage.dump('poc:meta:v1:progress') as { xp: number }).xp).toBe(6 + 2); // hauteur + 2×parfait, pas les points
    expect(svc.submit).not.toHaveBeenCalled();
    // V4 : « hors classement » est dit une fois (ligne revived), sans phrase en double.
    expect(text('rank-status')).toBe('Score gardé sur cet appareil.');
  });
});

describe('carte de résultat (V3-A6, F9 injectée)', () => {
  it('défi partagé sans image (le lien n’est jamais perdu) ; image enregistrable ; sans F9 : aucun bouton d’image', async () => {
    const file = new File(['png'], 'pile-ou-crash.png', { type: 'image/png' });
    const resultImage = vi.fn(async () => file);
    const saveFile = vi.fn(() => true);
    const { button, end, share, text } = setup({ resultImage, saveFile });
    button('Jouer').click();
    await end(4);
    button('Défier un ami').click();
    await flush();
    expect(share).toHaveBeenCalledWith(expect.not.objectContaining({ files: expect.anything() }));
    button('Enregistrer l’image').click();
    await flush();
    expect(saveFile).toHaveBeenCalledWith(file);
    expect(text('share-status')).toBe('Image enregistrée.');
    expect(resultImage).toHaveBeenCalledTimes(1); // image calculée une seule fois
    shell?.destroy();
    const plain = setup();
    plain.button('Jouer').click();
    await plain.end(4);
    expect([...plain.root.querySelectorAll('button')].some((b) => b.textContent === 'Enregistrer l’image')).toBe(false);
  });
});

describe('V3-A6b : secours du partage d’image, annonces, sauvegarde et récompense unique', () => {
  const file = new File(['png'], 'pile-ou-crash.png', { type: 'image/png' });
  const v2r = (height: number, score: number, continues: 0 | 1 = 0) => ({
    seed: 7, rulesVersion: 2 as const, score, height, perfectCount: 1, bestPerfectStreak: 1, bonusCount: 1,
    continues, durationTicks: 900, inputTicks: [1, 2, 3], continueTicks: continues ? [2] : [],
  });

  it('téléchargement impossible : image affichée avec consigne d’appui long', async () => {
    const createObjectURL = vi.fn(() => 'blob:image');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    const { button, end, text, root } = setup({ resultImage: async () => file, saveFile: () => false });
    button('Jouer').click();
    await end(4);
    button('Enregistrer l’image').click();
    await flush();
    expect(text('share-status')).toBe('Téléchargement impossible : l’image est affichée ci-dessous.');
    expect(root.querySelector('[data-testid="result-image"]')?.getAttribute('src')).toBe('blob:image');
    expect(createObjectURL).toHaveBeenCalledWith(file);
  });

  it.each([
    ['carte absente', async () => null],
    ['carte en échec', async () => { throw new Error('canvas'); }],
  ])('%s : message honnête, le lien reste partageable sans image', async (_name, resultImage) => {
    const { button, end, text, share } = setup({ resultImage: resultImage as () => Promise<File | null> });
    button('Jouer').click();
    await end(4);
    button('Enregistrer l’image').click();
    await flush();
    expect(text('share-status')).toContain('Image indisponible');
    button('Défier un ami').click();
    await flush();
    expect(share).toHaveBeenCalledWith(expect.not.objectContaining({ files: expect.anything() }));
  });

  it('partage avec image annulé : pas de succès compté', async () => {
    const { button, end, share, sink, text } = setup({ resultImage: async () => file });
    share.mockResolvedValueOnce('cancelled');
    button('Jouer').click();
    await end(4);
    button('Défier un ami').click();
    await flush();
    expect(text('share-status')).toBe('Partage annulé. Tu peux aussi copier le lien.');
    expect(sink.events.map((e) => e.name)).not.toContain('share_success');
  });

  it('jauge Super pleine et compte à rebours annoncés', () => {
    const { button, text, game } = setup();
    button('Jouer').click();
    const emit = game.mounts[0]!.options.onGameEvent!;
    emit({ type: 'gauge', value: 4, max: 10, next: 'ralenti' });
    expect(text('live')).toBe('Partie commencée.');
    emit({ type: 'gauge', value: 10, max: 10, next: 'ralenti' });
    expect(text('live')).toBe('Jauge Super pleine !');
    emit({ type: 'continue-start', countdownTicks: 360 });
    expect(text('live')).toBe('C’est reparti ! Prêt dans 3 secondes.');
  });

  it('partie reprise puis rappels onEnd répétés : étoiles, pièces et saison comptées une seule fois', async () => {
    const storage = memoryStorage();
    const { button, game, day } = setup({ meta: createMetaStore(storage) });
    day.now = new Date('2026-12-01T10:00:00Z');
    button('Jouer').click();
    const onEnd = game.mounts[0]!.options.onEnd;
    onEnd(v2r(9, 30, 1));
    onEnd(v2r(9, 30, 1));
    await flush();
    onEnd(v2r(9, 30, 1));
    await flush();
    const saved = storage.dump('poc:meta:v1:progress') as { xp: number; coins: number; season: { stars: number } };
    expect(saved.xp).toBe(9 + 2); // hauteur 9 + 2×1 parfait, une seule fois, jamais les 30 points
    expect(saved.season.stars).toBe(saved.xp);
  });

  it('rechargement : inventaire, saison, pseudo et sélection survivent ensemble ; identité corrompue ignorée', async () => {
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({
      version: 3, coins: 50, xp: 30, inventory: ['graphite'], grants: ['v2-objectives-backfill'],
      season: { id: 's1', stars: 25, claimed: [] }, selected: { theme: 'confiserie', skin: 'gomme' },
    }));
    const meta = createMetaStore(storage);
    meta.writePlayer({ id: 'c'.repeat(32), pseudo: 'Alex' });
    const first = setup({ meta });
    first.day.now = new Date('2026-12-01T10:00:00Z');
    first.button('Passe').click();
    first.button('Récupérer').click();
    await flush();
    first.shell.destroy();

    const again = setup({ meta: createMetaStore(storage) });
    again.day.now = new Date('2026-12-01T10:00:00Z');
    const doc = storage.dump('poc:meta:v1:progress') as Record<string, unknown>;
    expect(doc).toMatchObject({ version: 4, coins: 60, inventory: ['graphite'], season: { id: 's1', stars: 25, claimed: ['free:1'] } });
    expect(again.text('coins')).toBe('60 pièces');
    expect(storage.dump('poc:meta:v1:player')).toEqual({ id: 'c'.repeat(32), pseudo: 'Alex' });
    again.shell.destroy();

    storage.setItem('poc:meta:v1:player', JSON.stringify({ id: 'pirate', pseudo: '<script>' }));
    const svc = { available: true, issueTicket: vi.fn(), submit: vi.fn(), read: vi.fn(async () => ({ ok: true as const, value: { kind: 'global' as const, demo: false, total: 0, nextOffset: null, entries: [] } })) };
    const third = setup({ meta: createMetaStore(storage), leaderboard: svc as unknown as LeaderboardService });
    await flush();
    expect(svc.issueTicket).not.toHaveBeenCalled(); // identité invalide : aucun envoi au nom d'un autre
    third.button('Classement').click();
    expect(third.root.querySelector('[data-testid="pseudo-input"]')).not.toBeNull();
  });
});

describe('défis v1 et v2 (A6b, revue FLK M1)', () => {
  it('lien ?v=2 : partie en règles v2 ; lien partagé après une partie v2 : ?v=2 et cible en étages', async () => {
    const { game, button } = setup({ url: 'https://jeu.test/?v=2&seed=4242&target=6' });
    button('Relever le défi').click();
    expect(game.mounts[0]!.options.config).toEqual({ seed: 4242, rulesVersion: 2 });
    game.mounts[0]!.options.onEnd({ seed: 4242, rulesVersion: 2, score: 30, height: 8, perfectCount: 1, bestPerfectStreak: 1, bonusCount: 1, continues: 0, durationTicks: 900, inputTicks: [1, 2], continueTicks: [] });
    await flush();
    await new Promise((r) => setTimeout(r, 0));
    const shell = document.getElementById('app')!;
    expect(shell.textContent).toContain('Défi relevé : 8 contre 6');
  });
});

describe('vie rendue si la reprise n’a pas lieu (revue FLK A6, m4)', () => {
  it('vie consommée puis continueRun refusé : vie rendue une fois, message honnête', async () => {
    const mounts: { options: StartOptions; handle: { continueRun: ReturnType<typeof vi.fn>; declineContinue: ReturnType<typeof vi.fn> } }[] = [];
    const startGame: StartGame = (options) => {
      const handle = { pause: vi.fn(), resume: vi.fn(), destroy: vi.fn(), continueRun: vi.fn(() => false), declineContinue: vi.fn() };
      mounts.push({ options, handle });
      return handle;
    };
    const consume = vi.fn<LivesProvider['consume']>(async () => 'ok');
    const refund = vi.fn<LivesProvider['refund']>(async () => undefined);
    const { button, text } = setup({ startGame, revive: { lives: { count: () => 1, consume, refund } } });
    button('Jouer').click();
    mounts[0]!.options.onGameEvent!({ type: 'continue-offer', tick: 50 });
    guardElapsed(); // délai de garde de l'offre (V4)
    button('Utiliser une vie (1)').click();
    await flush();
    expect(refund).toHaveBeenCalledTimes(1);
    expect(refund).toHaveBeenCalledWith('run1:revive');
    expect(text('revive-status')).toBe('Reprise impossible. Ta vie t’a été rendue.');
  });

  it('partie quittée pendant la consommation : vie rendue', async () => {
    let resolve: (v: 'ok') => void = () => undefined;
    const consume = vi.fn<LivesProvider['consume']>(() => new Promise((r) => (resolve = r)));
    const refund = vi.fn<LivesProvider['refund']>(async () => undefined);
    const mounts: StartOptions[] = [];
    const startGame: StartGame = (options) => {
      mounts.push(options);
      return { pause: vi.fn(), resume: vi.fn(), destroy: vi.fn(), continueRun: vi.fn(() => true), declineContinue: vi.fn() };
    };
    const { button } = setup({ startGame, revive: { lives: { count: () => 1, consume, refund } } });
    button('Jouer').click();
    mounts[0]!.onGameEvent!({ type: 'continue-offer', tick: 50 });
    guardElapsed(); // délai de garde de l'offre (V4)
    button('Utiliser une vie (1)').click();
    shell?.destroy();
    resolve('ok');
    await flush();
    expect(refund).toHaveBeenCalledWith('run1:revive');
  });
});

describe('apparences V3 branchées (F8b, revue FLK A5 m1/m2, A6 m5)', () => {
  it('Graphite acheté en pièces, mis, monté en partie et gardé au rechargement ; Pixel pris au passe puis choisi', async () => {
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 3, coins: 100, grants: ['v2-objectives-backfill'], season: { id: 's1', stars: 70, claimed: [] } }));
    const a = setup({ meta: createMetaStore(storage) });
    a.day.now = new Date('2026-12-01T10:00:00Z');
    a.button('Boutique').click();
    expect(a.text('shop-graphite')).toContain('Acheter · 60');
    expect(a.root.querySelector('[data-testid="shop-empty"]')).toBeNull();
    a.root.querySelector<HTMLButtonElement>('[data-testid="buy-graphite"]')!.click();
    a.button('Oui, acheter · 60').click();
    await flush();
    a.button('Équiper maintenant').click(); // fenêtre de révélation
    await flush();
    a.button('Jouer').click(); // onglet
    a.button('Jouer').click();
    expect(a.game.mounts[0]!.options.appearance).toEqual({ theme: 'confiserie', skin: 'graphite' });
    a.shell.destroy();

    const b = setup({ meta: createMetaStore(storage) });
    b.day.now = new Date('2026-12-01T10:00:00Z');
    b.button('Jouer').click();
    expect(b.game.mounts[0]!.options.appearance).toEqual({ theme: 'confiserie', skin: 'graphite' });
    b.shell.destroy();

    const c = setup({ meta: createMetaStore(storage) });
    c.day.now = new Date('2026-12-01T10:00:00Z');
    c.button('Passe').click();
    expect(c.text('tier-3-free')).not.toContain('Bientôt'); // Pixel dessinable : récupérable
    c.root.querySelector<HTMLButtonElement>('[data-testid="claim-tier-3"]')!.click();
    await flush();
    expect(c.text('season-notice')).toBe('Récupéré : Matière Pixel.');
    expect(c.text('reveal-name')).toBe('Pixel');
    c.button('Plus tard').click();
    c.button('Collection').click();
    c.root.querySelector<HTMLButtonElement>('[aria-label="Équiper Matière Pixel"]')!.click();
    await flush();
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ coins: 40, inventory: ['graphite', 'pixel'], selected: { skin: 'pixel' } });
  });

  it('Or et Cristal (premium) : jamais sélectionnables même injectés dans une sauvegarde (y compris l’inventaire)', () => {
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 3, grants: ['v2-objectives-backfill'], inventory: ['or', 'cristal'], selected: { theme: 'confiserie', skin: 'or' } }));
    const { button, game } = setup({ meta: createMetaStore(storage) });
    button('Jouer').click();
    expect(game.mounts[0]!.options.appearance).toEqual({ theme: 'confiserie', skin: 'gomme' });
  });
});

describe('carte : apparence choisie transmise (revue FLK A6b R1)', () => {
  it('la carte reçoit l’apparence V3 sélectionnée, pas Gomme', async () => {
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 3, grants: ['v2-objectives-backfill'], inventory: ['graphite'], selected: { theme: 'confiserie', skin: 'graphite' } }));
    const resultImage = vi.fn(async () => null);
    const { button, end } = setup({ meta: createMetaStore(storage), resultImage });
    button('Jouer').click();
    await end(4);
    button('Enregistrer l’image').click();
    await flush();
    expect(resultImage).toHaveBeenCalledWith(expect.anything(), 'free', null, { theme: 'confiserie', skin: 'graphite' });
  });
});

describe('vies de reprise en partie libre (correction après publication)', () => {
  type H = { continueRun: ReturnType<typeof vi.fn>; declineContinue: ReturnType<typeof vi.fn> };
  function engine(accept = true) {
    const mounts: { options: StartOptions; handle: H }[] = [];
    const startGame: StartGame = (options) => {
      const handle = { pause: vi.fn(), resume: vi.fn(), destroy: vi.fn(), continueRun: vi.fn(() => accept), declineContinue: vi.fn() };
      mounts.push({ options, handle });
      return handle;
    };
    return { startGame, mounts };
  }
  const seeded = (coins: number, lives = 0) => {
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 3, coins, lives, grants: ['v2-objectives-backfill'] }));
    return storage;
  };

  it('achat d’une vie en pièces, compteur à l’accueil, offre « Utiliser une vie (1) », vidéo indisponible, vie décomptée une fois', async () => {
    const storage = seeded(40);
    const g = engine();
    const { button, text, root } = setup({ startGame: g.startGame, meta: createMetaStore(storage) });
    expect(text('lives')).toBe('0 vie');
    button('Boutique').click();
    expect(text('lives-count')).toBe('Tu as 0 vie (maximum 5).');
    button('Acheter · 30').click();
    button('Oui, acheter · 30').click();
    await flush();
    expect(text('life-success')).toBe('C’est à toi ! Tu as maintenant 1 vie.');
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ coins: 10, lives: 1 });
    button('Jouer').click(); // onglet Jouer : retour à l'accueil
    expect(text('lives')).toBe('1 vie');
    expect(root.querySelector('[data-testid="lives"]')!.getAttribute('title')).toBe('1 vie');

    button('Jouer').click();
    const m = g.mounts[0]!;
    expect(m.options.allowContinue).toBe(true);
    m.options.onGameEvent!({ type: 'continue-offer', tick: 50 });
    guardElapsed(); // délai de garde de l'offre (V4)
    const life = root.querySelector<HTMLButtonElement>('[data-testid="revive-life"]')!;
    expect(life.textContent).toBe('Utiliser une vie (1)');
    expect(document.activeElement).toBe(life);
    const video = root.querySelector<HTMLButtonElement>('[data-testid="revive-ad-unavailable"]')!;
    expect(video.textContent).toBe('Vidéo indisponible');
    expect(video.disabled).toBe(true);
    expect(root.querySelector('[data-testid="revive-demo"]')).toBeNull();
    life.click();
    life.click(); // double appui
    await flush();
    expect(m.handle.continueRun).toHaveBeenCalledTimes(1);
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ lives: 0, livesSpent: ['run1:revive'] });
  });

  it('sans vie et sans régie : pas d’offre (fin normale) et astuce affichée au résultat', async () => {
    const g = engine();
    const { button, text } = setup({ startGame: g.startGame, meta: createMetaStore(seeded(0)) });
    button('Jouer').click();
    expect(g.mounts[0]!.options.allowContinue).toBeUndefined();
    g.mounts[0]!.options.onEnd({ seed: 1, rulesVersion: 2, score: 3, height: 3, perfectCount: 0, bestPerfectStreak: 0, bonusCount: 0, continues: 0, durationTicks: 300, inputTicks: [1, 2], continueTicks: [] });
    await flush();
    expect(text('lives-tip')).toContain('Boutique');
  });

  it('reprise refusée par le moteur : la vie est rendue', async () => {
    const storage = seeded(0, 1);
    const g = engine(false);
    const { button, text } = setup({ startGame: g.startGame, meta: createMetaStore(storage) });
    button('Jouer').click();
    g.mounts[0]!.options.onGameEvent!({ type: 'continue-offer', tick: 50 });
    guardElapsed(); // délai de garde de l'offre (V4)
    button('Utiliser une vie (1)').click();
    await flush();
    await flush();
    expect(text('revive-status')).toBe('Reprise impossible. Ta vie t’a été rendue.');
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ lives: 1 });
  });

  it('deux onglets avec la même dernière vie : une seule reprise payée, l’autre refusée sans débit', async () => {
    const storage = seeded(0, 1);
    const g1 = engine();
    const a = setup({ startGame: g1.startGame, meta: createMetaStore(storage) });
    a.button('Jouer').click();
    g1.mounts[0]!.options.onGameEvent!({ type: 'continue-offer', tick: 50 });
    guardElapsed(); // délai de garde de l'offre (V4)
    const lifeA = a.root.querySelector<HTMLButtonElement>('[data-testid="revive-life"]')!;
    // Second onglet : même stockage, autre partie.
    const root2 = document.createElement('main');
    document.body.append(root2);
    const g2 = engine();
    const tracker = createTracker({ buildId: 'b', rulesVersion: 1, sessionId: 's2', sink: memorySink() });
    const clockB = { t: 0 };
    clocks.push(clockB);
    const b = createShell({
      root: root2, startGame: g2.startGame, tracker, store: createLocalStore(null), meta: createMetaStore(storage),
      url: 'https://jeu.test/', replaceUrl: () => undefined, share: async () => 'shared', newSeed: () => 9, newRunId: () => 'runB', now: () => clockB.t,
    });
    root2.querySelector<HTMLButtonElement>('[data-testid="play"]')!.click();
    g2.mounts[0]!.options.onGameEvent!({ type: 'continue-offer', tick: 50 });
    guardElapsed(); // délai de garde de l'offre (V4)
    lifeA.click();
    await flush();
    root2.querySelector<HTMLButtonElement>('[data-testid="revive-life"]')!.click();
    await flush();
    expect(g1.mounts[0]!.handle.continueRun).toHaveBeenCalledTimes(1);
    expect(g2.mounts[0]!.handle.continueRun).not.toHaveBeenCalled();
    expect(root2.querySelector('[data-testid="revive-status"]')!.textContent).toBe('Plus de vie.');
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ lives: 0 });
    b.destroy();
  });
});

describe('V6 : Stack or Crash, boutique, passe, raretés et aperçus', () => {
  const shop = {
    catalog: [{ id: 'ceramique', kind: 'skin' as const, price: 50, name: 'Céramique' }],
    isAvailable: () => true,
    preview: () => true,
  };

  it('nom anglais à l’accueil (titre lu), interface en français', () => {
    const { root } = setup();
    const title = root.querySelector('.brand-title')!;
    expect(title.getAttribute('aria-label')).toBe('Stack or Crash');
    expect(title.textContent).toBe('Stack or Crash');
    expect(title.getAttribute('lang')).toBe('en');
    expect(root.textContent).toContain('Touche pour poser le bloc !');
  });

  it('achat en cours : bouton « Achat… » désactivé, aucun second débit même en appuyant encore', async () => {
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 4, coins: 120, grants: ['v2-objectives-backfill'] }));
    const locks = fakeLocks();
    let release!: () => void;
    void locks.request(PROGRESS_LOCK, () => new Promise<void>((r) => (release = r))); // un autre onglet tient le verrou
    const { button, root, text } = setup({ meta: createMetaStore(storage), shop, locks });
    const byTestId = (id: string) => root.querySelector(`[data-testid="${id}"]`);
    button('Boutique').click();
    button('Acheter · 50').click();
    button('Oui, acheter · 50').click();
    const pending = byTestId('buy-ceramique') as HTMLButtonElement;
    expect(pending.textContent).toBe('Achat…');
    expect(pending.disabled).toBe(true);
    expect(pending.getAttribute('aria-busy')).toBe('true');
    pending.click();
    await flush(); // le verrou de l'autre onglet est bien tenu
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ coins: 120 });
    release();
    await flush();
    await flush();
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ coins: 70, inventory: ['ceramique'] });
    expect(text('shop-success')).toContain('C’est à toi');
  });

  it('passe : migration v3 visible (anciens paliers « Récupéré »), « Tout récupérer » une seule fois, révélation de l’objet', async () => {
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({
      version: 3, coins: 0, inventory: ['pixel'], grants: ['v2-objectives-backfill'],
      season: { id: 's1', stars: 320, claimed: ['free:1', 'free:2'] },
    }));
    const { button, text, root, day } = setup({ meta: createMetaStore(storage) });
    day.now = new Date('2026-12-01T10:00:00Z');
    button('Passe').click();
    expect(text('season-level')).toBe('Niveau9/ 30');
    // Anciens paliers 1 et 2 (Pixel) = niveaux 1 et 3 : déjà récupérés, jamais une seconde fois.
    expect(text('tier-1-free')).toContain('Récupéré');
    expect(text('tier-3-free')).toContain('Récupéré');
    expect(root.querySelector('[data-testid="claim-tier-3"]')).toBeNull();
    expect(text('claim-all')).toBe('Tout récupérer (7)');
    button('Tout récupérer (7)').click();
    await flush();
    // 10 + 15 + 15 + 20 + 20 + 25 = 105 pièces, et Galaxie (niveau 9) révélée.
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ version: 4, coins: 105, inventory: ['pixel', 'galaxie'] });
    expect(text('reveal-name')).toBe('Galaxie');
    expect(root.querySelector('[data-testid="reveal"] .rarity')?.textContent).toBe('Légendaire');
    button('Équiper maintenant').click();
    await flush();
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ selected: { skin: 'galaxie' } });
    expect(root.querySelector('[data-testid="claim-all"]')).toBeNull();
    // Le premium reste visible, détaillé, et jamais achetable.
    expect(text('premium-offer')).toContain('5 cosmétiques exclusifs, dont 3 légendaires');
    expect(root.querySelectorAll('[data-testid^="claim-tier-"]')).toHaveLength(0);
  });

  it('collection : aide des raretés en mots, filtres, et équiper depuis la collection', async () => {
    const { button, text, root } = setup();
    const byTestId = (id: string) => root.querySelector(`[data-testid="${id}"]`);
    button('Collection').click();
    button('Raretés').click();
    const sheet = byTestId('rarity-sheet')!;
    expect([...sheet.querySelectorAll('.rarity')].map((r) => r.textContent)).toEqual(['Commun', 'Rare', 'Épique', 'Légendaire']);
    expect(sheet.textContent).toContain('ne change jamais le score');
    button('Compris').click();
    button('À obtenir').click();
    expect(root.querySelector('[data-testid="card-skin-gomme"]')).toBeNull();
    expect(text('card-skin-abysse')).toContain('Passe premium · niveau 30');
    button('Tout').click();
    expect(text('card-skin-gomme')).toContain('Équipé');
  });

  it('aperçus vivants : suivis sur l’écran, oubliés en changeant d’écran ; image fixe en animations réduites', () => {
    const { button, shell: s } = setup({ shop });
    button('Boutique').click();
    expect(s.previews.watched).toBe(1);
    button('Jouer').click(); // onglet
    expect(s.previews.watched).toBe(0);
    expect(s.previews.running).toBe(false);
  });
});
