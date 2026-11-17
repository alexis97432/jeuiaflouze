// @vitest-environment jsdom
/** V4 : application des préférences à l'interface et retours sensoriels optionnels. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPrefs, effectiveReducedMotion, effectiveTheme, THEME_COLOR, watchSystemPrefs } from '../../src/app/prefs';
import { browserHaptics, createUiSound, HAPTIC_PATTERNS } from '../../src/app/feedback';
import { DEFAULT_PREFS } from '../../src/platform/storage';

/** matchMedia factice : on choisit ce que « l'appareil » répond, et on peut le changer. */
function fakeMedia(initial: { dark?: boolean; reduce?: boolean }) {
  const state = { dark: initial.dark ?? false, reduce: initial.reduce ?? false };
  const listeners = new Map<string, Set<() => void>>();
  const matchMedia = (query: string) => {
    const key = query.includes('color-scheme') ? 'dark' : 'reduce';
    return {
      get matches() {
        return state[key];
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => {
        if (!listeners.has(key)) listeners.set(key, new Set());
        listeners.get(key)!.add(fn);
      },
      removeEventListener: (_: string, fn: () => void) => listeners.get(key)?.delete(fn),
    } as unknown as MediaQueryList;
  };
  const change = (key: 'dark' | 'reduce', value: boolean) => {
    state[key] = value;
    for (const fn of listeners.get(key) ?? []) fn();
  };
  return { matchMedia, change, listeners };
}

beforeEach(() => {
  document.head.innerHTML = '';
  for (const k of ['theme', 'motion', 'effects']) delete document.documentElement.dataset[k];
});

describe('effectiveTheme / effectiveReducedMotion', () => {
  it('choix explicite prioritaire ; « Auto » suit l’appareil ; sans matchMedia : clair et animations normales', () => {
    const dark = fakeMedia({ dark: true, reduce: true });
    expect(effectiveTheme('light', dark)).toBe('light');
    expect(effectiveTheme('system', dark)).toBe('dark');
    expect(effectiveTheme('system', fakeMedia({}))).toBe('light');
    expect(effectiveTheme('system', null)).toBe('light');
    expect(effectiveReducedMotion('full', dark)).toBe(false);
    expect(effectiveReducedMotion('system', dark)).toBe(true);
    expect(effectiveReducedMotion('system', {} as never)).toBe(false);
  });
});

describe('applyPrefs', () => {
  it('pose les attributs data-*, la couleur de barre et le schéma de couleurs', () => {
    applyPrefs(document, { ...DEFAULT_PREFS, theme: 'dark', motion: 'reduce', effects: 'light' });
    const root = document.documentElement;
    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.motion).toBe('reduce');
    expect(root.dataset.effects).toBe('light');
    expect(root.style.colorScheme).toBe('dark');
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content).toBe(THEME_COLOR.dark);
    applyPrefs(document, DEFAULT_PREFS);
    expect(root.dataset.theme).toBe('system');
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1); // réutilisée, jamais dupliquée
  });

  it('« Auto » réagit en direct au changement de l’appareil, et l’écoute se retire', () => {
    const media = fakeMedia({ dark: false, reduce: false });
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: media.matchMedia });
    const prefs = { ...DEFAULT_PREFS };
    applyPrefs(document, prefs);
    const unwatch = watchSystemPrefs(document, () => prefs);
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content).toBe(THEME_COLOR.light);
    media.change('dark', true);
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content).toBe(THEME_COLOR.dark);
    media.change('reduce', true);
    expect(document.documentElement.dataset.motion).toBe('reduce');
    unwatch();
    expect([...media.listeners.values()].every((set) => set.size === 0)).toBe(true);
    Reflect.deleteProperty(window, 'matchMedia');
  });
});

describe('vibrations', () => {
  it('sans navigator.vibrate : indisponibles, et vibrate ne fait rien', () => {
    const h = browserHaptics({} as Navigator);
    expect(h.available).toBe(false);
    expect(() => h.vibrate(10)).not.toThrow();
  });

  it('avec navigator.vibrate : motifs transmis ; un refus du navigateur ne casse rien', () => {
    const vibrate = vi.fn(() => true);
    const h = browserHaptics({ vibrate } as unknown as Navigator);
    expect(h.available).toBe(true);
    h.vibrate(HAPTIC_PATTERNS.perfect);
    expect(vibrate).toHaveBeenCalledWith([10, 30, 14]);
    const refusing = browserHaptics({ vibrate: () => { throw new Error('refus'); } } as unknown as Navigator);
    expect(() => refusing.vibrate(5)).not.toThrow();
  });
});

describe('sons d’interface', () => {
  it('sans Web Audio : silence, sans erreur', () => {
    const sound = createUiSound(null);
    expect(() => sound.play('coin', 1)).not.toThrow();
    expect(() => sound.close()).not.toThrow();
  });

  it('contexte créé au premier son seulement, jamais à volume nul ; notes courtes et douces', () => {
    const created: { gains: number[]; oscillators: number }[] = [];
    class FakeCtx {
      state = 'running';
      currentTime = 0;
      destination = {};
      record = { gains: [] as number[], oscillators: 0 };
      constructor() {
        created.push(this.record);
      }
      createOscillator() {
        this.record.oscillators++;
        return { type: 'sine', frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(() => ({ connect: vi.fn() })), start: vi.fn(), stop: vi.fn() };
      }
      createGain() {
        const rec = this.record;
        return {
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn((v: number) => void rec.gains.push(v)),
          },
          connect: vi.fn(),
        };
      }
      resume = vi.fn(async () => undefined);
      close = vi.fn(async () => undefined);
    }
    const sound = createUiSound({ AudioContext: FakeCtx as unknown as typeof AudioContext });
    sound.play('tap', 0);
    expect(created).toHaveLength(0);
    sound.play('levelup', 0.5);
    expect(created).toHaveLength(1);
    expect(created[0]!.oscillators).toBe(5);
    expect(created[0]!.gains.length).toBeGreaterThan(0);
    expect(Math.max(...created[0]!.gains)).toBeCloseTo(0.16 * 0.5, 9); // pic doux, proportionnel au volume
    sound.play('coin', 1);
    expect(created).toHaveLength(1); // un seul contexte
  });
});
