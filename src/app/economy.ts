/**
 * E1a–E1d (coordination/ECONOMIE.md, arbitrage C5) — logique pure, sans DOM ni stockage.
 *
 * Document de progression **unique et versionné** (`version: 2`), écrit en une fois sous la clé
 * existante `poc:meta:v1:progress` : objectifs/sélection (A3), XP, pièces, inventaire, calendrier,
 * grants. Une seule clé = une écriture atomique : jamais « débité mais non livré ».
 *
 * Valeurs = hypothèses de réglage C5 : partie de référence (10 étages, 2 parfaits) = 14 XP et
 * 5 pièces ; objectifs = 10 pièces ; calendrier = 50 pièces par cycle de 7 réclamations.
 * Rien ici n'a de valeur commerciale : progression locale, modifiable par l'utilisateur.
 */
import { isDateKey } from '../platform/daily';
import {
  applyRun,
  INITIAL_PROGRESS,
  sanitizeProgress,
  type Objective,
  type ObjectiveId,
  type ProgressState,
  type RunSummary,
} from './progression';

// --- Document v2 et migration (E1a) -------------------------------------------------------

export const PROGRESS_VERSION = 2;
/** Prime unique : 10 pièces par objectif déjà accompli avant E1. */
export const BACKFILL_GRANT = 'v2-objectives-backfill';
export const MAX_XP = 10_000_000;
export const MAX_COINS = 1_000_000;
const MAX_GRANTS = 64;

export type CalendarState = {
  /** Dernière date UTC réclamée (`YYYY-MM-DD`), ou null. */
  lastClaimDate: string | null;
  /** Nombre de cycles de 7 réclamations terminés. */
  cycle: number;
  /** Prochaine récompense du cycle (0..6). */
  index: number;
};

export type ProgressDoc = ProgressState & {
  version: typeof PROGRESS_VERSION;
  xp: number;
  coins: number;
  /** Objets de boutique possédés (E1e) ; identifiants validés au bord, liste vide pour l'instant. */
  inventory: string[];
  calendar: CalendarState;
  grants: string[];
};

const INITIAL_CALENDAR: CalendarState = { lastClaimDate: null, cycle: 0, index: 0 };

export const INITIAL_DOC: ProgressDoc = {
  ...INITIAL_PROGRESS,
  version: PROGRESS_VERSION,
  xp: 0,
  coins: 0,
  inventory: [],
  calendar: INITIAL_CALENDAR,
  // Un document créé directement en v2 n'a rien à rattraper : la prime est marquée appliquée.
  grants: [BACKFILL_GRANT],
};

const boundedInt = (v: unknown, max: number): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 ? Math.min(v, max) : 0;

function sanitizeCalendar(raw: unknown): CalendarState {
  if (typeof raw !== 'object' || raw === null) return INITIAL_CALENDAR;
  const r = raw as Record<string, unknown>;
  const last = typeof r.lastClaimDate === 'string' && isDateKey(r.lastClaimDate) ? r.lastClaimDate : null;
  const index = boundedInt(r.index, CALENDAR_REWARDS.length - 1);
  return { lastClaimDate: last, cycle: boundedInt(r.cycle, 100_000), index };
}

/**
 * Lit n'importe quelle sauvegarde (absente, v1 d'A3a, v2, abîmée) et renvoie un document v2 valide.
 * Idempotent : migrer deux fois donne le même résultat ; la prime v1 → v2 n'est versée qu'une fois.
 * Limite assumée : réimporter volontairement une ancienne sauvegarde v1 rejoue sa migration
 * (aucune antifraude locale possible, C5).
 */
export function migrateProgress(raw: unknown): ProgressDoc {
  const base = sanitizeProgress(raw);
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  // Version future (onglet ancien, retour arrière de publication) : lue comme une v2, en
  // conservant XP, pièces et calendrier, au lieu d'être réinitialisée (revue E1 FLK, m3).
  const isV2OrLater = typeof r.version === 'number' && Number.isInteger(r.version) && r.version >= PROGRESS_VERSION;

  if (!isV2OrLater) {
    // v1 (A3a) ou rien : on part de l'état A3 nettoyé, puis prime unique par objectif accompli.
    const fresh = raw === undefined || raw === null;
    return {
      ...INITIAL_DOC,
      ...base,
      coins: fresh ? 0 : Math.min(base.completed.length * OBJECTIVE_COINS, MAX_COINS),
      grants: [BACKFILL_GRANT],
    };
  }

  const grants = Array.isArray(r.grants)
    ? [...new Set(r.grants.filter((g): g is string => typeof g === 'string' && g.length > 0 && g.length <= 64))]
    : [];
  return {
    ...base,
    version: PROGRESS_VERSION,
    xp: boundedInt(r.xp, MAX_XP),
    coins: boundedInt(r.coins, MAX_COINS),
    inventory: Array.isArray(r.inventory)
      ? [...new Set(r.inventory.filter((i): i is string => typeof i === 'string' && /^[a-z0-9-]{1,32}$/.test(i)))]
      : [],
    calendar: sanitizeCalendar(r.calendar),
    // Un document v2 a déjà reçu (ou n'avait pas à recevoir) la prime : on ne la rejoue jamais.
    grants: [...new Set([BACKFILL_GRANT, ...grants])].slice(0, MAX_GRANTS),
  };
}

/**
 * Lecture pour le shell : document migré + droit d'écriture. Une sauvegarde d'une version
 * **future** est lue en mode dégradé mais jamais réécrite par cette version (pas de perte des
 * champs qu'elle ne connaît pas).
 */
export function readProgressDoc(raw: unknown): { doc: ProgressDoc; writable: boolean } {
  const version = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).version : undefined;
  const future = typeof version === 'number' && version > PROGRESS_VERSION;
  return { doc: migrateProgress(raw), writable: !future };
}

// --- XP et niveaux (E1b) -----------------------------------------------------------------

export const LEVEL_MAX = 10;
export const LEVEL_TITLES: Partial<Record<number, string>> = {
  2: 'Apprenti',
  5: 'Architecte',
  10: 'Maître de la tour',
};

/** XP total requis pour atteindre le niveau L (1 ≤ L ≤ 10) : 20 × (L − 1) × L. */
export const levelThreshold = (level: number): number => 20 * (level - 1) * level;

export function runXp(run: Pick<RunSummary, 'score' | 'perfectCount'>): number {
  return Math.min(run.score, 50) + 2 * Math.min(run.perfectCount, 10);
}

export type LevelInfo = {
  level: number;
  /** Titre le plus élevé atteint, ou null avant le niveau 2. */
  title: string | null;
  /** XP gagné depuis le début du niveau courant. */
  intoLevel: number;
  /** XP restant avant le niveau suivant ; null au niveau maximal (pas de niveau 11 annoncé). */
  toNext: number | null;
};

export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  while (level < LEVEL_MAX && xp >= levelThreshold(level + 1)) level++;
  let title: string | null = null;
  for (let l = level; l >= 2 && title === null; l--) title = LEVEL_TITLES[l] ?? null;
  return {
    level,
    title,
    intoLevel: xp - levelThreshold(level),
    toNext: level === LEVEL_MAX ? null : levelThreshold(level + 1) - xp,
  };
}

// --- Pièces et fin de partie (E1c) -------------------------------------------------------

export const OBJECTIVE_COINS = 10;
export const RUN_COINS_CAP = 25;

export function runCoins(run: Pick<RunSummary, 'score' | 'perfectCount'>): number {
  return Math.min(RUN_COINS_CAP, Math.floor(run.score / 3) + run.perfectCount);
}

export type RunEconomy = {
  doc: ProgressDoc;
  completedNow: Objective[];
  gained: { xp: number; coins: number; levelUp: { from: number; to: number } | null };
};

/**
 * Applique une partie **terminée** : objectifs (actifs au lancement), XP et pièces.
 * Idempotent par runId parmi les MAX_REMEMBERED_RUNS (200) dernières parties évaluées — même
 * garantie bornée qu'A3a, pour les objectifs comme pour l'XP et les pièces (revue E1 FLK, m2).
 */
export function applyRunEconomy(doc: ProgressDoc, activeAtStart: readonly ObjectiveId[], run: RunSummary): RunEconomy {
  const evaluation = applyRun(doc, activeAtStart, run);
  if (evaluation.state === doc) {
    return { doc, completedNow: [], gained: { xp: 0, coins: 0, levelUp: null } };
  }
  const xpGain = runXp(run);
  const coinGain = runCoins(run) + OBJECTIVE_COINS * evaluation.completedNow.length;
  const before = levelInfo(doc.xp).level;
  const xp = Math.min(MAX_XP, doc.xp + xpGain);
  const after = levelInfo(xp).level;
  return {
    doc: { ...doc, ...evaluation.state, xp, coins: Math.min(MAX_COINS, doc.coins + coinGain) },
    completedNow: evaluation.completedNow,
    gained: { xp: xpGain, coins: coinGain, levelUp: after > before ? { from: before, to: after } : null },
  };
}

// --- Calendrier (E1d) --------------------------------------------------------------------

export const CALENDAR_REWARDS = [5, 5, 5, 5, 5, 10, 15] as const;

export type CalendarStatus = { canClaim: boolean; reward: number; dayInCycle: number };

export function calendarStatus(doc: ProgressDoc, today: string): CalendarStatus {
  const last = doc.calendar.lastClaimDate;
  return {
    canClaim: isDateKey(today) && (last === null || today > last),
    reward: CALENDAR_REWARDS[doc.calendar.index] ?? CALENDAR_REWARDS[0],
    dayInCycle: doc.calendar.index + 1,
  };
}

export type ClaimResult =
  | { claimed: true; doc: ProgressDoc; reward: number }
  | { claimed: false; doc: ProgressDoc; reason: 'invalid-date' | 'already-claimed' | 'earlier-date' };

/**
 * Réclame la récompense de la date UTC `today`. Une seule par date ; une date antérieure à la
 * dernière réclamation (horloge reculée) est refusée ; un jour d'absence ne remet rien à zéro et
 * ne se rattrape pas : un passage = une récompense au plus.
 */
export function claimCalendar(doc: ProgressDoc, today: string): ClaimResult {
  if (!isDateKey(today)) return { claimed: false, doc, reason: 'invalid-date' };
  const last = doc.calendar.lastClaimDate;
  if (last !== null && today === last) return { claimed: false, doc, reason: 'already-claimed' };
  if (last !== null && today < last) return { claimed: false, doc, reason: 'earlier-date' };
  const reward = CALENDAR_REWARDS[doc.calendar.index] ?? CALENDAR_REWARDS[0];
  const nextIndex = (doc.calendar.index + 1) % CALENDAR_REWARDS.length;
  return {
    claimed: true,
    reward,
    doc: {
      ...doc,
      coins: Math.min(MAX_COINS, doc.coins + reward),
      calendar: {
        lastClaimDate: today,
        index: nextIndex,
        cycle: doc.calendar.cycle + (nextIndex === 0 ? 1 : 0),
      },
    },
  };
}
