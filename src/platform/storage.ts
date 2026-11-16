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
export type StoredResult = { score: number; perfectCount: number; mode: 'free' | 'challenge' };

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
  ((v as StoredResult).mode === 'free' || (v as StoredResult).mode === 'challenge');

/** Accès à localStorage sans exception (la simple lecture de la propriété peut lever). */
export function getBrowserStorage(win: Window | undefined = globalThis.window): Storage | null {
  try {
    return win?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createLocalStore(storage: Storage | null): LocalStore {
  const memory = new Map<string, string>();
  let persistent = storage !== null;

  const read = (key: string): string | null => {
    const full = STORAGE_PREFIX + key;
    if (memory.has(full)) return memory.get(full) ?? null;
    if (!storage) return null;
    try {
      return storage.getItem(full);
    } catch {
      persistent = false;
      return null;
    }
  };

  const write = (key: string, value: string) => {
    const full = STORAGE_PREFIX + key;
    // Miroir mémoire systématique : la session relit toujours sa dernière écriture, même si
    // la lecture du stockage est bloquée ou que l'écriture a échoué.
    memory.set(full, value);
    if (!storage) return;
    try {
      storage.setItem(full, value);
    } catch {
      persistent = false; // quota dépassé ou stockage bloqué
    }
  };

  const readJson = <T>(key: string, guard: (v: unknown) => v is T, fallback: T): T => {
    const raw = read(key);
    if (raw === null) return fallback;
    try {
      const parsed: unknown = JSON.parse(raw);
      return guard(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  const readRecent = () =>
    readJson('recent', (v): v is unknown[] => Array.isArray(v), [])
      .filter(isResult)
      .slice(-MAX_RECENT_RESULTS);

  return {
    get persistent() {
      return persistent;
    },
    readBest: () => readJson('best', isScore, 0),
    submitScore(result) {
      const clean: StoredResult = {
        score: result.score,
        perfectCount: result.perfectCount,
        mode: result.mode,
      };
      if (!isResult(clean)) return false;
      write('recent', JSON.stringify([...readRecent(), clean].slice(-MAX_RECENT_RESULTS)));
      const best = readJson('best', isScore, 0);
      if (clean.score <= best) return false;
      write('best', JSON.stringify(clean.score));
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
    writePrefs: (prefs) => write('prefs', JSON.stringify({ muted: prefs.muted })),
  };
}
