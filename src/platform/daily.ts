/**
 * Tour du jour (coordination/V2.md) : même seed pour tous à une même date UTC.
 * Seed = FNV-1a 32 bits de la clé ASCII `poc:daily:v1:YYYY-MM-DD` (0 → 1).
 * Distinct du PRNG du moteur. Changer d'algorithme impose de versionner la clé.
 */

export const DAILY_KEY_PREFIX = 'poc:daily:v1:';
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Date UTC `YYYY-MM-DD` de l'instant donné. */
export function utcDateKey(at: Date): string {
  if (Number.isNaN(at.getTime())) throw new RangeError('date invalide');
  return at.toISOString().slice(0, 10);
}

/** Vrai si la chaîne est une date calendaire UTC valide au format `YYYY-MM-DD`. */
export function isDateKey(key: string): boolean {
  const m = DATE_KEY.exec(key);
  if (!m) return false;
  const d = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && utcDateKey(d) === key && Number(m[1]) >= 2000;
}

/** FNV-1a 32 bits sur des octets ASCII. */
export function fnv1a32(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0x7f) throw new RangeError('clé non ASCII');
    hash ^= code;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Seed uint32 non nulle de la tour du jour. */
export function dailySeed(dateKey: string): number {
  if (!isDateKey(dateKey)) throw new RangeError(`date de tour invalide : ${dateKey}`);
  return fnv1a32(DAILY_KEY_PREFIX + dateKey) || 1;
}

/** Instant du prochain changement de tour (minuit UTC suivant). */
export function nextDailyChange(at: Date): Date {
  const next = new Date(at.getTime());
  next.setUTCHours(24, 0, 0, 0);
  return next;
}
