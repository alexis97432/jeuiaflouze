import { describe, expect, it } from 'vitest';
import {
  createLocalStore,
  getBrowserStorage,
  MAX_RECENT_RESULTS,
  STORAGE_PREFIX,
} from '../../src/platform/storage';

/** Storage en mémoire, avec pannes injectables. */
function fakeStorage(opts: { failGet?: boolean; failSet?: boolean } = {}) {
  const data = new Map<string, string>();
  const storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    removeItem: (k: string) => void data.delete(k),
    getItem(k: string) {
      if (opts.failGet) throw new DOMException('bloqué', 'SecurityError');
      return data.get(k) ?? null;
    },
    setItem(k: string, v: string) {
      if (opts.failSet) throw new DOMException('plein', 'QuotaExceededError');
      data.set(k, v);
    },
  } satisfies Storage;
  return { storage, data };
}

const free = (score: number) => ({ score, perfectCount: 0, mode: 'free' as const });

describe('createLocalStore', () => {
  it('persiste record, préférences et résultats sous le préfixe poc:v1:', () => {
    const { storage, data } = fakeStorage();
    const store = createLocalStore(storage);
    expect(store.submitScore(free(5))).toBe(true);
    expect(store.submitScore(free(3))).toBe(false);
    expect(store.submitScore(free(5))).toBe(false); // égalité : pas un nouveau record
    store.writePrefs({ muted: true });
    expect([...data.keys()].every((k) => k.startsWith(STORAGE_PREFIX))).toBe(true);

    const reopened = createLocalStore(storage);
    expect(reopened.readBest()).toBe(5);
    expect(reopened.readPrefs()).toEqual({ muted: true });
    expect(reopened.readRecent().map((r) => r.score)).toEqual([5, 3, 5]);
    expect(reopened.persistent).toBe(true);
  });

  it('borne les derniers résultats', () => {
    const store = createLocalStore(fakeStorage().storage);
    for (let i = 0; i < 25; i++) store.submitScore(free(i));
    const recent = store.readRecent();
    expect(recent).toHaveLength(MAX_RECENT_RESULTS);
    expect(recent.at(-1)?.score).toBe(24);
  });

  it.each([
    ['JSON invalide', '{pas du json'],
    ['négatif', '-3'],
    ['décimal', '2.5'],
    ['chaîne', '"12"'],
    ['énorme', '1e300'],
    ['objet', '{"best":9}'],
  ])('record corrompu (%s) : valeur par défaut, le jeu continue', (_, raw) => {
    const { storage, data } = fakeStorage();
    data.set(`${STORAGE_PREFIX}best`, raw);
    data.set(`${STORAGE_PREFIX}prefs`, raw);
    data.set(`${STORAGE_PREFIX}recent`, raw);
    const store = createLocalStore(storage);
    expect(store.readBest()).toBe(0);
    expect(store.readPrefs()).toEqual({ muted: false });
    expect(store.readRecent()).toEqual([]);
    expect(store.submitScore(free(1))).toBe(true);
    expect(store.readBest()).toBe(1);
  });

  it('filtre les entrées invalides de la liste de résultats', () => {
    const { storage, data } = fakeStorage();
    data.set(
      `${STORAGE_PREFIX}recent`,
      JSON.stringify([free(2), { score: 'x' }, null, { score: 1, perfectCount: 0, mode: 'hack' }, free(4)]),
    );
    expect(createLocalStore(storage).readRecent().map((r) => r.score)).toEqual([2, 4]);
  });

  it('stockage absent : mémoire de session, persistent = false', () => {
    const store = createLocalStore(null);
    expect(store.persistent).toBe(false);
    expect(store.submitScore(free(4))).toBe(true);
    store.writePrefs({ muted: true });
    expect(store.readBest()).toBe(4);
    expect(store.readPrefs()).toEqual({ muted: true });
  });

  it('lecture bloquée ou quota plein : aucune exception, repli mémoire', () => {
    for (const opts of [{ failGet: true }, { failSet: true }, { failGet: true, failSet: true }]) {
      const store = createLocalStore(fakeStorage(opts).storage);
      expect(() => store.submitScore(free(6))).not.toThrow();
      expect(store.readBest()).toBe(6);
      expect(store.persistent).toBe(false);
    }
  });
});

describe('getBrowserStorage', () => {
  it("renvoie null si l'accès à localStorage lève", () => {
    const win = {
      get localStorage(): Storage {
        throw new DOMException('refusé', 'SecurityError');
      },
    } as unknown as Window;
    expect(getBrowserStorage(win)).toBeNull();
    expect(getBrowserStorage(undefined)).toBeNull();
  });
});
