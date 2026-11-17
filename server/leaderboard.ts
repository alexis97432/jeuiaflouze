/**
 * Domaine du classement (pur, sans E/S) : tableaux, meilleur résultat par joueur, rangs et pages.
 * Un tableau = un type (global, hebdomadaire, quotidien) × une version de règles × une période.
 * Les versions de règles ne sont jamais mélangées (ECONOMIE.md E2, accord plan V3).
 */

export type BoardKind = 'global' | 'weekly' | 'daily';

export type ScoreEntry = {
  playerId: string;
  pseudo: string;
  /** Points (v2) ou étages (v1, où le score est la hauteur). Critère principal. */
  score: number;
  height: number;
  perfectCount: number;
  /** Instant serveur d'obtention (ms) : départage final, le plus ancien d'abord. */
  achievedAt: number;
  demo?: boolean;
};

export type RankedEntry = Omit<ScoreEntry, 'achievedAt'> & { rank: number };

/** Semaine ISO 8601 en UTC, ex. `2026-W47`. */
export function isoWeek(at: Date): string {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function boardKey(kind: BoardKind, rulesVersion: number, period?: string): string {
  if (kind === 'global') return `global:v${rulesVersion}`;
  if (!period) throw new RangeError(`période requise pour ${kind}`);
  return `${kind}:v${rulesVersion}:${period}`;
}

/**
 * Ordre convenu avec FLK (PR #27) : score desc, hauteur desc, parfaits desc, plus ancien d'abord,
 * puis id (ordre stable). En règles v1, score = hauteur.
 */
export function compareEntries(a: ScoreEntry, b: ScoreEntry): number {
  return (
    b.score - a.score ||
    b.height - a.height ||
    b.perfectCount - a.perfectCount ||
    a.achievedAt - b.achievedAt ||
    (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0)
  );
}

/** Le nouveau résultat remplace-t-il le meilleur actuel du joueur ? (strictement meilleur) */
export function isBetter(candidate: ScoreEntry, current: ScoreEntry | undefined): boolean {
  if (!current) return true;
  return (
    candidate.score - current.score || candidate.height - current.height || candidate.perfectCount - current.perfectCount
  ) > 0;
}

/**
 * Rangs « de compétition » : deux joueurs à égalité de score, de hauteur et de parfaits
 * partagent le même rang (1, 1, 3). L'ordre d'affichage reste stable (le plus ancien d'abord).
 */
export function rank(entries: readonly ScoreEntry[]): RankedEntry[] {
  const sorted = [...entries].sort(compareEntries);
  const ranked: RankedEntry[] = [];
  sorted.forEach((e, i) => {
    const prev = sorted[i - 1];
    const tie = prev && prev.score === e.score && prev.perfectCount === e.perfectCount && prev.height === e.height;
    const { achievedAt: _a, ...rest } = e;
    ranked.push({ ...rest, rank: tie ? ranked[i - 1]!.rank : i + 1 });
  });
  return ranked;
}

export const MAX_PAGE = 50;

export function page(ranked: readonly RankedEntry[], offset: number, limit: number) {
  const start = Math.max(0, Math.floor(offset));
  const size = Math.min(MAX_PAGE, Math.max(1, Math.floor(limit)));
  const entries = ranked.slice(start, start + size);
  const next = start + size < ranked.length ? start + size : null;
  return { entries, total: ranked.length, nextOffset: next };
}

const PSEUDO = /^[\p{L}\p{N}][\p{L}\p{N} _-]{1,14}[\p{L}\p{N}]$/u;
/** Pseudonyme : 3 à 16 caractères, lettres, chiffres, espace, tiret, souligné. */
export function validPseudo(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const p = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  return PSEUDO.test(p) ? p : null;
}

/** Identifiant joueur pseudonyme généré par le client : 32 caractères hexadécimaux. */
export function validPlayerId(raw: unknown): string | null {
  return typeof raw === 'string' && /^[0-9a-f]{32}$/.test(raw) ? raw : null;
}
