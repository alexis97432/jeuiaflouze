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

/**
 * Préférences du joueur (V4). Format rétrocompatible : l'ancien `{ muted }` est lu tel quel et
 * complété par les valeurs par défaut ; toute valeur inconnue ou abîmée est remplacée par défaut.
 */
export type ThemePref = 'system' | 'light' | 'dark';
export type MotionPref = 'system' | 'reduce' | 'full';
export type EffectsPref = 'full' | 'light';
export type Prefs = {
  muted: boolean;
  /** Volume des sons, de 0 à 1. */
  volume: number;
  /** Thème de l'interface (pas l'univers des blocs). */
  theme: ThemePref;
  /** Animations : selon l'appareil, réduites ou normales. */
  motion: MotionPref;
  /** Effets visuels : complets, ou fluides (moins d'effets, pour les téléphones modestes). */
  effects: EffectsPref;
  /** Vibrations, quand l'appareil en propose. */
  haptics: boolean;
  /** V7 : musique de fond activée (indépendante des effets sonores). */
  music: boolean;
  /** V7 : volume de la musique, de 0 à 1. */
  musicVolume: number;
  /** V7 : musique de l'univers choisi, ou musique équipée. */
  musicSource: MusicSourcePref;
};
export type MusicSourcePref = 'univers' | 'equipee';
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

export const DEFAULT_PREFS: Prefs = {
  muted: false, volume: 0.8, theme: 'system', motion: 'system', effects: 'full', haptics: true,
  music: true, musicVolume: 0.6, musicSource: 'univers',
};

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

/** Préférences valides à partir de n'importe quelle valeur stockée (ancienne, partielle ou abîmée). */
export function sanitizePrefs(raw: unknown): Prefs {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const volume = typeof r.volume === 'number' && Number.isFinite(r.volume) ? Math.min(1, Math.max(0, r.volume)) : DEFAULT_PREFS.volume;
  const musicVolume = typeof r.musicVolume === 'number' && Number.isFinite(r.musicVolume) ? Math.min(1, Math.max(0, r.musicVolume)) : DEFAULT_PREFS.musicVolume;
  // V7 : préférences d'avant la musique. Un joueur qui avait coupé le son la retrouve coupée.
  const music = typeof r.music === 'boolean' ? r.music : r.muted === true ? false : DEFAULT_PREFS.music;
  return {
    muted: typeof r.muted === 'boolean' ? r.muted : DEFAULT_PREFS.muted,
    volume: Math.round(volume * 100) / 100,
    theme: pick(r.theme, ['system', 'light', 'dark'] as const, DEFAULT_PREFS.theme),
    motion: pick(r.motion, ['system', 'reduce', 'full'] as const, DEFAULT_PREFS.motion),
    effects: pick(r.effects, ['full', 'light'] as const, DEFAULT_PREFS.effects),
    haptics: typeof r.haptics === 'boolean' ? r.haptics : DEFAULT_PREFS.haptics,
    music,
    musicVolume: Math.round(musicVolume * 100) / 100,
    musicSource: pick(r.musicSource, ['univers', 'equipee'] as const, DEFAULT_PREFS.musicSource),
  };
}

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
  /** Clés dont la dernière écriture n'a pas atteint le stockage : la mémoire fait foi. */
  const memoryOnly = new Set<string>();
  let persistent = storage !== null;

  // Le stockage est relu à chaque lecture (un autre onglet a pu écrire, revue E1 FLK M2) ;
  // la mémoire ne sert que si le stockage est absent, illisible ou n'a pas reçu notre écriture.
  const read = (key: string): string | null => {
    const full = prefix + key;
    if (storage && !memoryOnly.has(full)) {
      try {
        const value = storage.getItem(full);
        if (value !== null || !memory.has(full)) return value;
      } catch {
        persistent = false;
      }
    }
    return memory.get(full) ?? null;
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
        memoryOnly.delete(full);
      } catch {
        persistent = false; // quota dépassé ou stockage bloqué
        memoryOnly.add(full);
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
    readPrefs: () => sanitizePrefs(kv.readRaw('prefs')),
    writePrefs: (prefs) => kv.writeJson('prefs', sanitizePrefs(prefs)),
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
  /** Identité de classement brute ; à valider par `isPlayerIdentity` (services/leaderboard.ts). */
  readPlayer(): unknown;
  writePlayer(player: unknown): void;
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
    readPlayer: () => kv.readRaw('player'),
    writePlayer: (player) => kv.writeJson('player', player),
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
