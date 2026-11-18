// @vitest-environment jsdom
/**
 * V7 — parcours dans le shell : sélection du jour, achat et équipement d'une musique, offre
 * ouverte au changement de jour, renouvellement sans récompense, écoute arrêtée en quittant
 * l'écran, réglages audio appliqués et gardés, son et journal en partie.
 * Auto-vérification d'Alexis (pas une revue indépendante).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StartGame, StartOptions } from '../../src/app/game-loader';
import { createShell, type Shell, type ShellOptions } from '../../src/app/shell';
import type { UiSound } from '../../src/app/feedback';
import { createTracker, memorySink } from '../../src/platform/metrics';
import { createLocalStore, createMetaStore, DEFAULT_PREFS } from '../../src/platform/storage';
import { dailySelection, DAY_MS, rotationDay } from '../../src/app/rotation';
import { createDiagnostics } from '../../src/app/diagnostics';
import type { MusicPlayer, PlayerState } from '../../src/app/music/player';
import type { AudioHub } from '../../src/platform/audio-hub';

function memoryStorage(): Storage & { dump(key: string): unknown } {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    dump: (k: string) => JSON.parse(data.get(k) ?? 'null') as unknown,
  };
}

function fakeMusic() {
  let state: PlayerState = { current: null, previewing: null, loading: null };
  const listeners = new Set<(s: PlayerState) => void>();
  const wants: (string | null)[] = [];
  const music: MusicPlayer & { wants: (string | null)[]; gameActive: boolean[] } = {
    wants,
    gameActive: [],
    want: (id) => void wants.push(id),
    setIntensity: () => undefined,
    setGameActive(active) { this.gameActive.push(active); },
    preview(id) { state = { ...state, previewing: id }; listeners.forEach((l) => l(state)); },
    stopPreview() { state = { ...state, previewing: null }; listeners.forEach((l) => l(state)); },
    get state() { return state; },
    subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
    stats: () => ({ sources: 0, cached: 0, voices: 0, rendering: 0 }),
    dispose: () => undefined,
  };
  return music;
}

function fakeHub() {
  const calls: string[] = [];
  const hub: AudioHub & { calls: string[] } = {
    calls,
    state: 'running',
    context: null,
    unlock: () => void calls.push('unlock'),
    running: () => true,
    musicInput: () => null,
    sfxOutput: () => null,
    uiInput: () => null,
    setMusic: (on, v) => void calls.push(`music:${on}:${v}`),
    setSfx: (on, v) => void calls.push(`sfx:${on}:${v}`),
    duck: () => void calls.push('duck'),
    background: (hidden) => void calls.push(`background:${hidden}`),
    subscribe: () => () => undefined,
    close: () => undefined,
  };
  return hub;
}

let shell: Shell | null = null;
let visibility: DocumentVisibilityState = 'visible';

beforeEach(() => {
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  document.body.innerHTML = '<main id="app"></main>';
});
afterEach(() => {
  shell?.destroy();
  shell = null;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function setup(overrides: Partial<ShellOptions> & { at?: { t: number } } = {}) {
  const mounts: StartOptions[] = [];
  const startGame: StartGame = (options) => {
    mounts.push(options);
    return { pause: vi.fn(), resume: vi.fn(), destroy: vi.fn(), setAudio: vi.fn() };
  };
  const sink = memorySink();
  const uiSound: UiSound = { play: () => undefined, close: () => undefined };
  const at = overrides.at ?? { t: Date.UTC(2026, 10, 20, 12) };
  const root = document.getElementById('app')!;
  const music = fakeMusic();
  const hub = fakeHub();
  shell = createShell({
    root,
    startGame,
    tracker: createTracker({ buildId: 'b', rulesVersion: 1, sessionId: 's', sink }),
    store: overrides.store ?? createLocalStore(null),
    meta: overrides.meta ?? createMetaStore(null),
    today: () => new Date(at.t),
    url: 'https://jeu.test/',
    replaceUrl: () => undefined,
    share: async () => 'shared',
    newSeed: () => 100,
    newRunId: () => 'run1',
    now: () => 0,
    locks: null,
    uiSound,
    music,
    audio: hub,
    ...overrides,
  });
  const byTestId = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`[data-testid="${id}"]`);
  return { root, byTestId, mounts, music, hub, at };
}

const richMeta = (coins: number, extra: Record<string, unknown> = {}) => {
  const storage = memoryStorage();
  storage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 5, coins, grants: ['v2-objectives-backfill'], ...extra }));
  return { storage, meta: createMetaStore(storage) };
};

describe('V7 — boutique : sélection du jour', () => {
  it('affiche les offres du jour (UTC) avec l’heure du renouvellement ; le lendemain, d’autres offres', () => {
    const { byTestId, root, at } = setup();
    byTestId('nav-shop')!.click();
    const day = rotationDay(at.t);
    const ids = (d: number) => dailySelection(d).map((o) => `shop-${o.id}`).sort();
    const shown = () => [...root.querySelectorAll('[data-testid^="shop-"]')].map((e) => e.getAttribute('data-testid')!).filter((id) => ids(day).includes(id) || ids(day + 1).includes(id)).sort();
    expect(shown()).toEqual(ids(day));
    expect(byTestId('shop-renewal')!.textContent).toMatch(/^Nouvelle sélection dans 12 h 00, à \d\d:\d\d \(heure de ton appareil\)\.$/);
    expect(byTestId('shop-section-music')).not.toBeNull();
  });

  it('acheter une musique : prix dans le bouton, débit unique, « Possédée », révélation, puis « Équipée » et musique choisie', () => {
    const { storage, meta } = richMeta(500);
    const at = { t: Date.UTC(2026, 10, 20, 12) };
    const day = rotationDay(at.t);
    const offer = dailySelection(day).find((o) => o.kind === 'music')!;
    const { byTestId, music, root } = setup({ meta, at });
    byTestId('nav-shop')!.click();
    const buy = byTestId<HTMLButtonElement>(`buy-${offer.id}`)!;
    expect(buy.textContent).toBe(`Acheter · ${offer.price}`);
    expect(byTestId(`listen-${offer.id}`)!.textContent).toBe('Écouter');
    buy.click();
    byTestId('confirm-buy')!.click();
    expect((storage.dump('poc:meta:v1:progress') as { coins: number }).coins).toBe(500 - offer.price);
    expect(byTestId('reveal')!.textContent).toContain('Nouvelle musique !');
    byTestId('reveal-equip')!.click();
    expect((storage.dump('poc:meta:v1:progress') as { music: string }).music).toBe(offer.id);
    expect(music.wants.at(-1)).toBe(offer.id);
    expect(byTestId(`shop-${offer.id}`)!.textContent).toContain('Équipée');
    // Pas de second débit possible : le bouton d'achat a disparu.
    expect(byTestId(`buy-${offer.id}`)).toBeNull();
    void root;
  });

  it('offre ouverte à minuit : refusée sans débit après le délai de grâce ; honorée au prix confirmé dans le délai', () => {
    const day = rotationDay(Date.UTC(2026, 10, 20, 12));
    const next = new Set(dailySelection(day + 1).map((o) => o.id));
    const offer = dailySelection(day).find((o) => !next.has(o.id))!;
    for (const [delay, expectOk] of [[10 * 60_000, false], [2 * 60_000, true]] as const) {
      document.body.innerHTML = '<main id="app"></main>';
      shell?.destroy();
      const { storage, meta } = richMeta(1000);
      const at = { t: (day + 1) * DAY_MS - 60_000 }; // 23:59 UTC
      const { byTestId } = setup({ meta, at });
      byTestId('nav-shop')!.click();
      byTestId(`buy-${offer.id}`)!.click();
      at.t = (day + 1) * DAY_MS + delay; // minuit passé pendant la confirmation
      byTestId('confirm-buy')!.click();
      const coins = (storage.dump('poc:meta:v1:progress') as { coins: number }).coins;
      if (expectOk) {
        expect(coins).toBe(1000 - offer.price);
      } else {
        expect(coins).toBe(1000);
        expect(byTestId('shop-expired')!.textContent).toContain('Rien n’a été débité');
      }
    }
  });

  it('renouvellement automatique, écran ouvert : nouvelles offres, aucune pièce ni objet donnés', () => {
    vi.useFakeTimers();
    const { storage, meta } = richMeta(42, { inventory: ['graphite'] });
    const at = { t: Date.UTC(2026, 10, 20, 23, 59) };
    const { byTestId } = setup({ meta, at });
    byTestId('nav-shop')!.click();
    const before = storage.dump('poc:meta:v1:progress');
    at.t = Date.UTC(2026, 10, 21, 0, 0, 30);
    vi.advanceTimersByTime(30_000);
    expect(byTestId('shop-renewed')!.textContent).toBe('Nouvelle sélection du jour !');
    expect(storage.dump('poc:meta:v1:progress')).toEqual(before);
    // Horloge reculée puis avancée : toujours rien de distribué.
    at.t = Date.UTC(2026, 10, 10, 9);
    vi.advanceTimersByTime(30_000);
    at.t = Date.UTC(2026, 11, 25, 9);
    vi.advanceTimersByTime(30_000);
    expect(storage.dump('poc:meta:v1:progress')).toEqual(before);
  });
});

describe('V7 — écoute et musique', () => {
  it('« Écouter » lance l’écoute (une seule), « Arrêter » l’arrête ; quitter l’écran l’arrête', () => {
    const { byTestId, music, at } = setup();
    byTestId('nav-shop')!.click();
    const [a, b] = dailySelection(rotationDay(at.t)).filter((o) => o.kind === 'music');
    byTestId(`listen-${a!.id}`)!.click();
    expect(music.state.previewing).toBe(a!.id);
    expect(byTestId(`listen-${a!.id}`)!.textContent).toBe('Arrêter');
    byTestId(`listen-${b!.id}`)!.click();
    expect(music.state.previewing).toBe(b!.id);
    expect(byTestId(`listen-${a!.id}`)!.textContent).toBe('Écouter');
    byTestId('nav-collection')!.click();
    expect(music.state.previewing).toBeNull();
  });

  it('collection : toutes les musiques, provenance des absentes, musiques possédées équipables', () => {
    const { byTestId } = setup();
    byTestId('nav-collection')!.click();
    expect(byTestId('collection-music')).not.toBeNull();
    expect(byTestId('card-music-premier-etage')!.textContent).toContain('Possédée');
    expect(byTestId('card-music-gouter-lofi')!.textContent).toContain('Boutique');
    expect(byTestId('equip-music-gouter-lofi')).toBeNull();
    byTestId('equip-music-sucre-glace')!.click();
    expect(byTestId('card-music-sucre-glace')!.textContent).toContain('Équipée');
  });

  it('réglages : musique et effets indépendants, appliqués tout de suite et gardés', () => {
    const storage = memoryStorage();
    const store = createLocalStore(storage);
    const { byTestId, music, hub } = setup({ store });
    expect(music.wants.at(-1)).toBe('sucre-glace'); // musique de l'univers par défaut
    byTestId('nav-settings')!.click();
    byTestId('music-toggle')!.click();
    expect(store.readPrefs()).toEqual({ ...DEFAULT_PREFS, music: false });
    expect(music.wants.at(-1)).toBeNull();
    expect(hub.calls).toContain('music:false:0.6');
    expect(byTestId<HTMLInputElement>('music-volume')!.disabled).toBe(true);
    byTestId('music-toggle')!.click();
    byTestId('music-source-equipee')!.click();
    expect(store.readPrefs().musicSource).toBe('equipee');
    expect(music.wants.at(-1)).toBe('premier-etage');
    byTestId('sound-toggle')!.click();
    expect(store.readPrefs()).toMatchObject({ muted: true, music: true });
    expect(hub.calls.at(-1)).toBe('sfx:false:0.8');
  });
});

describe('V7 — partie : son partagé, arrière-plan, journal', () => {
  it('la partie reçoit la sortie audio et le relais des incidents ; arrière-plan suspendu ; incident journalisé', () => {
    const storage = memoryStorage();
    const diagnostics = createDiagnostics(storage);
    const { byTestId, mounts, hub, music } = setup({ diagnostics });
    byTestId('play')!.click();
    expect(mounts).toHaveLength(1);
    expect('audio' in mounts[0]!).toBe(true);
    expect(music.gameActive).toEqual([true]);
    mounts[0]!.onIncident!({ kind: 'effet', layer: 'ondes', message: 'IndexSizeError: rayon négatif' });
    expect(diagnostics.entries().at(-1)).toMatchObject({ kind: 'effet', where: 'ondes', run: { mode: 'free' } });
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(hub.calls).toContain('background:true');
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(hub.calls).toContain('background:false');
  });

  it('Réglages → Diagnostic : résumé, rapport copié, journal effacé', async () => {
    const storage = memoryStorage();
    const diagnostics = createDiagnostics(storage);
    diagnostics.record('blocage', 'image-1', { ms: 2400 });
    const copied: string[] = [];
    const { byTestId } = setup({ diagnostics, copy: async (t) => { copied.push(t); return true; }, deviceInfo: () => ({ densite: 3 }) });
    byTestId('nav-settings')!.click();
    expect(byTestId('diag-summary')!.textContent).toContain('1 incident enregistré');
    byTestId('diag-copy')!.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(copied[0]).toContain('blocage');
    expect(copied[0]).toContain('densite : 3');
    expect(byTestId('diag-status')!.textContent).toContain('Rapport copié');
    byTestId('diag-clear')!.click();
    expect(byTestId('diag-summary')!.textContent).toContain('Aucun incident');
  });
});
