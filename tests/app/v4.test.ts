// @vitest-environment jsdom
/**
 * V4 : réglages (thème, son et volume, vibrations, animations, effets), pause et sortie de
 * partie, bouton retour du téléphone, fenêtres accessibles, vibrations et fêtes mesurées.
 * Auto-vérification d'Alexis (pas une revue indépendante).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunResult } from '../../src/app/game-contract';
import type { StartGame, StartOptions } from '../../src/app/game-loader';
import { createShell, RESULT_INPUT_GUARD_MS, type Shell, type ShellOptions } from '../../src/app/shell';
import type { Haptics, UiSound, UiSoundKind } from '../../src/app/feedback';
import { createTracker, memorySink } from '../../src/platform/metrics';
import { createLocalStore, createMetaStore, DEFAULT_PREFS } from '../../src/platform/storage';

type Handle = {
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  setAudio: ReturnType<typeof vi.fn>;
};

function engine() {
  const mounts: { options: StartOptions; handle: Handle }[] = [];
  const startGame: StartGame = (options) => {
    const handle = { pause: vi.fn(), resume: vi.fn(), destroy: vi.fn(), setAudio: vi.fn() };
    mounts.push({ options, handle });
    return handle;
  };
  return { startGame, mounts };
}

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

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise<void>((resolve) => queueMicrotask(resolve));
};

const result = (score: number): RunResult => ({ seed: 7, rulesVersion: 1, score, perfectCount: 0, durationTicks: 500, inputTicks: [1] });

let visibility: DocumentVisibilityState = 'visible';
let shell: Shell | null = null;

beforeEach(() => {
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  document.body.innerHTML = '<main id="app"></main>';
  document.head.innerHTML = '';
  for (const k of ['theme', 'motion', 'effects']) delete document.documentElement.dataset[k];
});
afterEach(() => {
  shell?.destroy();
  shell = null;
  vi.restoreAllMocks();
});

function setup(overrides: Partial<ShellOptions> = {}) {
  const game = engine();
  const sink = memorySink();
  const tracker = createTracker({ buildId: 'b', rulesVersion: 1, sessionId: 's', sink });
  const vibrations: (number | readonly number[])[] = [];
  const haptics: Haptics = { available: true, vibrate: (p) => void vibrations.push(p) };
  const sounds: UiSoundKind[] = [];
  const uiSound: UiSound = { play: (k) => void sounds.push(k), close: vi.fn() };
  const clock = { t: 0 };
  let run = 0;
  const root = document.getElementById('app')!;
  const store = overrides.store ?? createLocalStore(null);
  const meta = overrides.meta ?? createMetaStore(null);
  shell = createShell({
    root,
    startGame: game.startGame,
    tracker,
    store,
    meta,
    today: () => new Date('2026-11-16T10:00:00Z'),
    url: 'https://jeu.test/',
    replaceUrl: () => undefined,
    share: async () => 'shared',
    newSeed: () => 100,
    newRunId: () => `run${++run}`,
    now: () => clock.t,
    haptics,
    uiSound,
    ...overrides,
  });
  const button = (label: string) => {
    const found = [...root.querySelectorAll('button')].find((b) => b.textContent === label);
    if (!found) throw new Error(`bouton « ${label} » absent : ${root.textContent}`);
    return found;
  };
  const byTestId = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`[data-testid="${id}"]`);
  const end = async (score: number) => {
    game.mounts.at(-1)!.options.onEnd(result(score));
    await flush();
    clock.t += RESULT_INPUT_GUARD_MS;
  };
  return { game, sink, root, button, byTestId, end, store, meta, vibrations, sounds, uiSound, shell: shell! };
}

const names = (sink: ReturnType<typeof memorySink>) => sink.events.map((e) => e.name);
const html = () => document.documentElement;

describe('V4 — réglages', () => {
  it('thème, animations et effets : appliqués tout de suite, mémorisés, transmis au moteur, relus au rechargement', () => {
    const storage = memoryStorage();
    const store = createLocalStore(storage);
    const { button, byTestId, game } = setup({ store });
    expect(html().dataset.theme).toBe('system');
    expect(html().dataset.effects).toBe('full');
    button('Réglages').click();
    byTestId('theme-dark')!.click();
    expect(html().dataset.theme).toBe('dark');
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content).toBe('#16163a');
    expect(byTestId('theme-dark')!.getAttribute('aria-pressed')).toBe('true');
    expect(byTestId('theme-system')!.getAttribute('aria-pressed')).toBe('false');
    byTestId('motion-reduce')!.click();
    expect(html().dataset.motion).toBe('reduce');
    byTestId('effects-light')!.click();
    expect(html().dataset.effects).toBe('light');
    expect(store.readPrefs()).toEqual({ ...DEFAULT_PREFS, theme: 'dark', motion: 'reduce', effects: 'light' });

    button('Retour').click();
    button('Jouer').click();
    expect(game.mounts[0]!.options.prefs).toEqual({ muted: false, volume: 0.8, effects: 'light', reducedMotion: true });

    // Rechargement : mêmes réglages, appliqués avant tout affichage.
    shell!.destroy();
    for (const k of ['theme', 'motion', 'effects']) delete html().dataset[k];
    document.body.innerHTML = '<main id="app"></main>';
    setup({ store: createLocalStore(storage) });
    expect(html().dataset.theme).toBe('dark');
    expect(html().dataset.motion).toBe('reduce');
    expect(html().dataset.effects).toBe('light');
  });

  it('Animations « Auto » : le moteur suit l’appareil (aucune valeur imposée)', () => {
    const { button, byTestId, game } = setup();
    button('Réglages').click();
    byTestId('motion-full')!.click();
    expect(html().dataset.motion).toBe('full');
    byTestId('motion-system')!.click();
    button('Retour').click();
    button('Jouer').click();
    expect(game.mounts[0]!.options.prefs).not.toHaveProperty('reducedMotion');
  });

  it('volume : curseur mémorisé, grisé quand le son est coupé, son de contrôle seulement si le son est actif', () => {
    const store = createLocalStore(null);
    const { button, byTestId, sounds } = setup({ store });
    button('Réglages').click();
    const volume = byTestId<HTMLInputElement>('volume')!;
    expect(volume.value).toBe('80');
    volume.value = '40';
    volume.dispatchEvent(new Event('change'));
    expect(store.readPrefs().volume).toBe(0.4);
    expect(sounds).toEqual(['tap']);
    byTestId('sound-toggle')!.click();
    expect(store.readPrefs().muted).toBe(true);
    expect(volume.disabled).toBe(true);
    volume.value = '60';
    volume.dispatchEvent(new Event('change'));
    expect(sounds).toEqual(['tap']); // son coupé : aucun son d'interface
  });

  it('vibrations disponibles : interrupteur, motifs courts en jeu, coupées si désactivées', () => {
    const { button, byTestId, game, vibrations, store } = setup({ store: createLocalStore(null) });
    button('Réglages').click();
    const toggle = byTestId('haptics-toggle')!;
    expect(toggle.getAttribute('role')).toBe('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(byTestId('haptics-unavailable')).toBeNull();
    button('Retour').click();
    button('Jouer').click();
    const emit = game.mounts[0]!.options.onGameEvent!;
    emit({ type: 'placement', tick: 1, floor: 1, perfect: false, perfectStreak: 0 });
    emit({ type: 'placement', tick: 2, floor: 2, perfect: true, perfectStreak: 1 });
    emit({ type: 'miss', tick: 3, floor: 3 });
    expect(vibrations).toEqual([8, [10, 30, 14], [35, 30, 50]]);
    // Chaque motif reste bref (moins de 0,15 s) : le rythme de jeu n'est pas gêné.
    for (const p of vibrations) expect((Array.isArray(p) ? p : [p]).reduce((a: number, b: number) => a + b, 0)).toBeLessThanOrEqual(150);

    vibrations.length = 0;
    shell!.destroy();
    document.body.innerHTML = '<main id="app"></main>';
    const again = setup({ store });
    again.button('Réglages').click();
    again.byTestId('haptics-toggle')!.click();
    expect(store.readPrefs().haptics).toBe(false);
    again.vibrations.length = 0;
    again.button('Retour').click();
    again.button('Jouer').click();
    again.game.mounts[0]!.options.onGameEvent!({ type: 'placement', tick: 1, floor: 1, perfect: true, perfectStreak: 1 });
    expect(again.vibrations).toEqual([]);
  });

  it('vibrations absentes de l’appareil : une phrase claire, aucun bouton trompeur', () => {
    const { button, byTestId } = setup({ haptics: { available: false, vibrate: () => undefined } });
    button('Réglages').click();
    expect(byTestId('haptics-toggle')).toBeNull();
    expect(byTestId('haptics-unavailable')!.textContent).toBe('Ton appareil ne propose pas les vibrations.');
  });

  it('un réglage changé dans un autre onglet est appliqué ici', () => {
    const storage = memoryStorage();
    setup({ store: createLocalStore(storage) });
    expect(html().dataset.theme).toBe('system');
    storage.setItem('poc:v1:prefs', JSON.stringify({ ...DEFAULT_PREFS, theme: 'light' }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'poc:v1:prefs' }));
    expect(html().dataset.theme).toBe('light');
  });
});

describe('V4 — pause et sortie de partie', () => {
  it('bouton Pause : moteur en pause, Reprendre, puis Quitter sans rien compter', async () => {
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 3, coins: 7, grants: ['v2-objectives-backfill'] }));
    const meta = createMetaStore(storage);
    const store = createLocalStore(storage);
    const { button, byTestId, game, sink, shell: s } = setup({ meta, store });
    button('Jouer').click();
    const { handle, options } = game.mounts[0]!;
    expect(byTestId('pause')!.hidden).toBe(true);
    button('Pause').click();
    expect(handle.pause).toHaveBeenCalledTimes(1);
    expect(byTestId('pause')!.hidden).toBe(false);
    expect(byTestId('pause')!.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.activeElement?.textContent).toBe('Reprendre');
    expect(byTestId('pause-button')!.closest('.game-hud')!.hasAttribute('hidden')).toBe(true);

    button('Reprendre').click();
    expect(handle.resume).toHaveBeenCalledTimes(1);
    expect(byTestId('pause')!.hidden).toBe(true);
    expect(document.activeElement).toBe(options.canvas);

    button('Pause').click();
    button('Quitter la partie').click();
    expect(s.screen).toBe('home');
    expect(handle.destroy).toHaveBeenCalled();
    expect(names(sink)).toEqual(['run_start']); // ni run_end, ni gains
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ coins: 7 });
    expect(store.readBest()).toBe(0);
    // Un onEnd tardif du moteur détruit n'a aucun effet.
    options.onEnd(result(9));
    await flush();
    expect(s.screen).toBe('home');
    expect(store.readBest()).toBe(0);
  });

  it('son coupé depuis la pause : appliqué tout de suite au moteur et mémorisé', () => {
    const store = createLocalStore(null);
    const { button, byTestId, game } = setup({ store });
    button('Jouer').click();
    button('Pause').click();
    byTestId('sound-toggle')!.click();
    expect(game.mounts[0]!.handle.setAudio).toHaveBeenCalledWith(false, 0.8);
    expect(store.readPrefs().muted).toBe(true);
  });

  it('après le raté, plus de bouton Pause (le moteur attend la fin ou la reprise)', () => {
    const { button, byTestId, game } = setup();
    button('Jouer').click();
    game.mounts[0]!.options.onGameEvent!({ type: 'miss', tick: 9, floor: 3 });
    expect(byTestId('pause-button')!.closest('.game-hud')!.hasAttribute('hidden')).toBe(true);
    game.mounts[0]!.options.onGameEvent!({ type: 'continue-start', countdownTicks: 360 });
    expect(byTestId('pause-button')!.closest('.game-hud')!.hasAttribute('hidden')).toBe(false);
  });

  it('onglet caché : pause ; retour : focus sur Reprendre, la partie ne repart pas seule', () => {
    const { byTestId, game, button } = setup();
    button('Jouer').click();
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(game.mounts[0]!.handle.pause).toHaveBeenCalledTimes(1);
    expect(byTestId('pause')!.hidden).toBe(false);
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(game.mounts[0]!.handle.resume).not.toHaveBeenCalled();
    expect(document.activeElement?.textContent).toBe('Reprendre');
  });

  it('Défi du jour : bandeau lisible, sans fuseau ni date technique', () => {
    const { button, byTestId, root } = setup();
    button('Défi du jour').click();
    expect(byTestId('target')!.textContent).toBe('Défi du jour · 16 novembre');
    expect(root.textContent).not.toMatch(/UTC|2026-11-16/);
  });
});

describe('V4 — offre de reprise protégée des appuis en rafale', () => {
  it('un appui juste après la chute ne dépense pas la vie ; après le délai, une seule vie est utilisée', async () => {
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 3, coins: 0, lives: 1, grants: ['v2-objectives-backfill'] }));
    const clock = { t: 0 };
    const continueRun = vi.fn(() => true);
    const declineContinue = vi.fn();
    const mounts: StartOptions[] = [];
    const startGame: StartGame = (options) => {
      mounts.push(options);
      return { pause: vi.fn(), resume: vi.fn(), destroy: vi.fn(), continueRun, declineContinue };
    };
    const { byTestId } = setup({ startGame, meta: createMetaStore(storage), now: () => clock.t });
    byTestId('play')!.click();
    mounts[0]!.onGameEvent!({ type: 'miss', tick: 40, floor: 4 });
    mounts[0]!.onGameEvent!({ type: 'continue-offer', tick: 40 });
    const offer = byTestId('revive')!;
    expect(offer.dataset.inputReady).toBeUndefined();
    byTestId('revive-life')!.click(); // appui en rafale, 0 ms après la chute
    byTestId('revive-end')!.click();
    await flush();
    expect(continueRun).not.toHaveBeenCalled();
    expect(declineContinue).not.toHaveBeenCalled();
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ lives: 1 });
    clock.t += RESULT_INPUT_GUARD_MS;
    byTestId('revive-life')!.click();
    await flush();
    expect(continueRun).toHaveBeenCalledTimes(1);
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ livesSpent: ['run1:revive'] });
    expect((storage.dump('poc:meta:v1:progress') as { lives?: number }).lives ?? 0).toBe(0);
  });
});

describe('V4 — bouton retour du téléphone', () => {
  function fakeHistory() {
    const calls: string[] = [];
    return {
      calls,
      pushState: vi.fn(() => void calls.push('push')),
      back: vi.fn(() => {
        calls.push('back');
        queueMicrotask(() => window.dispatchEvent(new PopStateEvent('popstate')));
      }),
    };
  }
  const phoneBack = async () => {
    window.dispatchEvent(new PopStateEvent('popstate'));
    await flush();
  };

  it('écran secondaire → accueil ; retour par le bouton de l’écran sans double effet', async () => {
    const history = fakeHistory();
    const { button, shell: s } = setup({ history });
    expect(history.calls).toEqual([]); // l'accueil n'ajoute rien : le retour y quitte le jeu
    button('Boutique').click();
    expect(history.calls).toEqual(['push']);
    await phoneBack();
    expect(s.screen).toBe('home');
    button('Récompenses').click();
    button('Retour').click(); // bouton de l'écran : le shell retire lui-même son entrée
    await flush();
    expect(s.screen).toBe('home');
    expect(history.calls).toEqual(['push', 'push', 'back']);
  });

  it('pendant une partie : pause, jamais de sortie ; au résultat : accueil', async () => {
    const history = fakeHistory();
    const { button, byTestId, game, end, shell: s } = setup({ history });
    button('Jouer').click();
    await phoneBack();
    expect(s.screen).toBe('game');
    expect(game.mounts[0]!.handle.pause).toHaveBeenCalledTimes(1);
    expect(byTestId('pause')!.hidden).toBe(false);
    expect(history.calls).toEqual(['push', 'push']); // entrée remise : un 2e retour reste dans le jeu
    await phoneBack();
    expect(s.screen).toBe('game');
    button('Reprendre').click();
    await end(2);
    expect(s.screen).toBe('result');
    await phoneBack();
    expect(s.screen).toBe('home');
  });

  it('fenêtre ouverte à l’accueil : le retour la ferme sans quitter le jeu', async () => {
    const history = fakeHistory();
    const { button, root, shell: s } = setup({ history });
    button('Comment jouer').click();
    expect(root.querySelector('[data-testid="howto"]')).not.toBeNull();
    expect(history.calls).toEqual(['push']);
    await phoneBack();
    expect(root.querySelector('[data-testid="howto"]')).toBeNull();
    expect(s.screen).toBe('home');
    // Fermée par son bouton : l'entrée ajoutée est retirée.
    button('Comment jouer').click();
    button('C’est compris !').click();
    await flush();
    expect(history.calls).toEqual(['push', 'push', 'back']);
  });
});

describe('V4 — fenêtres accessibles', () => {
  it('Comment jouer : dialogue modal, Échap, ✕ et fond ferment, le focus revient au bouton', () => {
    const { button, root, byTestId } = setup();
    const help = button('Comment jouer');
    help.focus();
    help.click();
    const dialog = byTestId('howto')!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(byTestId('howto')).toBeNull();
    expect(document.activeElement).toBe(help);

    help.click();
    button('Fermer').click();
    expect(byTestId('howto')).toBeNull();
    help.click();
    root.querySelector<HTMLElement>('[data-testid="howto-backdrop"]')!.click();
    expect(byTestId('howto')).toBeNull();
  });

  it('Tab reste dans la fenêtre (focus piégé)', () => {
    const { button, byTestId } = setup();
    button('Comment jouer').click();
    const dialog = byTestId('howto')!;
    const focusables = [...dialog.querySelectorAll<HTMLElement>('button')];
    const last = focusables.at(-1)!;
    last.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(focusables[0]);
  });

  it('achat : « Non » ferme la fenêtre sans rien débiter', async () => {
    const storage = memoryStorage();
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 3, coins: 500, grants: ['v2-objectives-backfill'] }));
    const { button, byTestId } = setup({ meta: createMetaStore(storage) });
    button('Boutique').click();
    button('Acheter 1 vie').click();
    expect(byTestId('confirm')).not.toBeNull();
    button('Non').click();
    await flush();
    expect(byTestId('confirm')).toBeNull();
    expect(storage.dump('poc:meta:v1:progress')).toMatchObject({ coins: 500 });
  });
});

describe('V4 — résultat et fêtes mesurées', () => {
  it('nouveau record : ruban, son de récompense, confettis seulement avec les effets complets', async () => {
    const first = setup();
    first.button('Jouer').click();
    await first.end(4);
    expect(first.byTestId('new-record')!.textContent).toBe('Nouveau record !');
    expect(first.sounds).toContain('reward');
    expect(document.querySelector('.confetti')).not.toBeNull();
    expect(first.byTestId('score')!.textContent).toBe('4 étages');

    shell!.destroy();
    document.body.innerHTML = '<main id="app"></main>';
    const store = createLocalStore(null);
    store.writePrefs({ ...DEFAULT_PREFS, effects: 'light' });
    const second = setup({ store });
    second.button('Jouer').click();
    await second.end(4);
    expect(second.byTestId('new-record')).not.toBeNull();
    expect(document.querySelector('.confetti')).toBeNull();
  });

  it('niveau gagné : ruban violet et son de niveau ; gains lisibles', async () => {
    const storage = memoryStorage();
    // 35 XP : niveau 2 tout proche (seuil 40 = 20 × 1 × 2).
    storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 3, xp: 35, grants: ['v2-objectives-backfill'] }));
    const { button, byTestId, sounds, end } = setup({ meta: createMetaStore(storage) });
    button('Jouer').click();
    await end(12);
    expect(byTestId('level-up')!.textContent).toMatch(/^Niveau 2 atteint/);
    expect(sounds).toContain('levelup');
    expect(byTestId('gains')!.textContent).toMatch(/^\+\d+ étoiles · \+\d+ pièces$/);
  });

  it('Quitter puis rejouer : une nouvelle partie normale, comptée une seule fois', async () => {
    const storage = memoryStorage();
    const meta = createMetaStore(storage);
    const { button, end, sink } = setup({ meta });
    button('Jouer').click();
    button('Pause').click();
    button('Quitter la partie').click();
    button('Jouer').click();
    await end(3);
    expect(names(sink)).toEqual(['run_start', 'run_start', 'run_end']);
    const doc = storage.dump('poc:meta:v1:progress') as { runs?: string[] };
    expect(JSON.stringify(doc)).not.toContain('run1');
  });
});
