/**
 * Sauvegarde locale robuste (docs/CONTRACTS.md § Shell) : préfixe `poc:v1:`.
 * - Stockage absent, bloqué (navigation privée, politique), plein ou corrompu : le jeu continue
 *   avec une mémoire de session et `persistent` passe à false.
 * - Lecture défensive : toute valeur invalide est ignorée et remplacée par la valeur par défaut.
 * Le préfixe porte la version du format ; un format v2 utilisera un autre préfixe et migrera.
 */

export const STORAGE_PREFIX = 'poc:v1:';
export const MAX_RECENT_RESULTS = 10;
export const MAX_SCORE = 1_000_000;

export type Prefs = { muted: boolean };
export type StoredResult = { score: number; perfectCount: number; mode: 'free' | 'challenge' | 'daily' };

export type LocalStore = {
  /** false si au moins une lecture/écriture a échoué : les données ne survivront pas à l'onglet. */
  readonly persistent: boolean;
  readBest(): number;
  /** Enregistre un score ; renvoie true s'il bat le record précédent. */
  submitScore(result: StoredResult): boolean;
  readRecent(): StoredResult[];
  readPrefs(): Prefs;
  writePrefs(prefs: Prefs): void;
};

const DEFAULT_PREFS: Prefs = { muted: false };

const isScore = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_SCORE;

const isResult = (v: unknown): v is StoredResult =>
  typeof v === 'object' &&
  v !== null &&
  isScore((v as StoredResult).score) &&
  isScore((v as StoredResult).perfectCount) &&
  ['free', 'challenge', 'daily'].includes((v as StoredResult).mode);

/** Accès à localStorage sans exception (la simple lecture de la propriété peut lever). */
export function getBrowserStorage(win: Window | undefined = globalThis.window): Storage | null {
  try {
    return win?.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Magasin clé/valeur JSON tolérant aux pannes, sous un préfixe donné. */
export type JsonStore = {
  readonly persistent: boolean;
  readJson<T>(key: string, guard: (v: unknown) => v is T, fallback: T): T;
  readRaw(key: string): unknown;
  writeJson(key: string, value: unknown): void;
};

export function createJsonStore(storage: Storage | null, prefix: string): JsonStore {
  const memory = new Map<string, string>();
  let persistent = storage !== null;

  const read = (key: string): string | null => {
    const full = prefix + key;
    if (memory.has(full)) return memory.get(full) ?? null;
    if (!storage) return null;
    try {
      return storage.getItem(full);
    } catch {
      persistent = false;
      return null;
    }
  };

  const readRaw = (key: string): unknown => {
    const raw = read(key);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  };

  return {
    get persistent() {
      return persistent;
    },
    readRaw,
    readJson<T>(key: string, guard: (v: unknown) => v is T, fallback: T): T {
      const value = readRaw(key);
      return guard(value) ? value : fallback;
    },
    writeJson(key, value) {
      const full = prefix + key;
      const text = JSON.stringify(value);
      // Miroir mémoire systématique : la session relit toujours sa dernière écriture, même si
      // la lecture du stockage est bloquée ou que l'écriture a échoué.
      memory.set(full, text);
      if (!storage) return;
      try {
        storage.setItem(full, text);
      } catch {
        persistent = false; // quota dépassé ou stockage bloqué
      }
    },
  };
}

export function createLocalStore(storage: Storage | null): LocalStore {
  const kv = createJsonStore(storage, STORAGE_PREFIX);
  const readJson = <T>(key: string, guard: (v: unknown) => v is T, fallback: T): T =>
    kv.readJson(key, guard, fallback);

  const readRecent = () =>
    readJson('recent', (v): v is unknown[] => Array.isArray(v), [])
      .filter(isResult)
      .slice(-MAX_RECENT_RESULTS);

  return {
    get persistent() {
      return kv.persistent;
    },
    readBest: () => readJson('best', isScore, 0),
    submitScore(result) {
      const clean: StoredResult = {
        score: result.score,
        perfectCount: result.perfectCount,
        mode: result.mode,
      };
      if (!isResult(clean)) return false;
      kv.writeJson('recent', [...readRecent(), clean].slice(-MAX_RECENT_RESULTS));
      const best = readJson('best', isScore, 0);
      if (clean.score <= best) return false;
      kv.writeJson('best', clean.score);
      return true;
    },
    readRecent,
    readPrefs: () =>
      readJson(
        'prefs',
        (v): v is Prefs =>
          typeof v === 'object' && v !== null && typeof (v as Prefs).muted === 'boolean',
        DEFAULT_PREFS,
      ),
    writePrefs: (prefs) => kv.writeJson('prefs', { muted: prefs.muted }),
  };
}

// --- Méta V2 (coordination/V2.md) ---------------------------------------------------------

/**
 * Préfixe de la méta V2. `poc:v1:` (record, préférences, derniers résultats) est conservé tel quel :
 * aucune donnée n'est déplacée, la « migration » consiste à continuer de le lire.
 */
export const META_PREFIX = 'poc:meta:v1:';
/** Records du jour conservés (les plus récents). */
export const MAX_DAILY_RECORDS = 14;

export type MetaStore = {
  readonly persistent: boolean;
  /** Progression brute ; à valider par `sanitizeProgress` (src/app/progression.ts). */
  readProgress(): unknown;
  writeProgress(progress: unknown): void;
  readDailyBest(dateKey: string): number;
  /** Enregistre un score du jour ; renvoie true s'il bat le record de cette date. */
  submitDaily(dateKey: string, score: number): boolean;
};

type DailyRecords = Record<string, number>;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const isDailyRecords = (v: unknown): v is DailyRecords =>
  typeof v === 'object' &&
  v !== null &&
  !Array.isArray(v) &&
  Object.entries(v).every(([k, n]) => DATE_KEY.test(k) && isScore(n));

export function createMetaStore(storage: Storage | null): MetaStore {
  const kv = createJsonStore(storage, META_PREFIX);
  const readDaily = () => kv.readJson('daily', isDailyRecords, {});
  return {
    get persistent() {
      return kv.persistent;
    },
    readProgress: () => kv.readRaw('progress'),
    writeProgress: (progress) => kv.writeJson('progress', progress),
    readDailyBest: (dateKey) => readDaily()[dateKey] ?? 0,
    submitDaily(dateKey, score) {
      if (!DATE_KEY.test(dateKey) || !isScore(score)) return false;
      const records = readDaily();
      const previous = records[dateKey];
      if (previous !== undefined && score <= previous) return false;
      const kept = Object.entries({ ...records, [dateKey]: score })
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-MAX_DAILY_RECORDS);
      kv.writeJson('daily', Object.fromEntries(kept));
      return previous === undefined ? score > 0 : true;
    },
  };
}
