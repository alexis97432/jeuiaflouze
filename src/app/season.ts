/**
 * Passe de saison (V3-A5 ; V6 : 30 niveaux). Une saison finie, à dates fixes (UTC).
 * - Étoiles de saison = étoiles gagnées en partie pendant la saison (même calcul que l'XP,
 *   ajoutées dans la même écriture que les gains de la partie : jamais deux fois).
 * - Piste gratuite : vraiment récupérable, une fois par niveau.
 * - Piste premium : visible et détaillée, **pas achetable** tant qu'aucun paiement réel ni droit
 *   vérifié par un serveur n'existe (docs/SERVICES.md). Jamais déverrouillée localement.
 * - Un cosmétique obtenu reste à vie (inventaire), même après la fin de la saison.
 *
 * V6 — pourquoi 30 niveaux : la saison dure 15 semaines. Le niveau 1 arrive dès la première
 * bonne partie (20 étoiles) ; les écarts grandissent doucement (20 → 250 étoiles) pour finir à
 * 3 000 étoiles, soit environ deux parties par jour. Les 10 anciens paliers gardent leurs seuils
 * et leurs récompenses (devenus les niveaux 1, 3, 5… 19) : la migration renumérote seulement.
 */
import { MAX_COINS, type ProgressDoc } from './economy';

export type SeasonReward =
  | { kind: 'coins'; amount: number }
  | { kind: 'skin'; id: string; name: string }
  | { kind: 'theme'; id: string; name: string };
export type SeasonTier = { tier: number; stars: number; free: SeasonReward; premium: SeasonReward };
export type Season = { id: string; name: string; start: string; end: string; tiers: readonly SeasonTier[] };
/** `today` (V8) : étoiles de saison déjà créditées ce jour UTC (plafond `SEASON_DAILY_STARS`). */
export type SeasonState = { id: string; stars: number; claimed: string[]; today?: { day: string; stars: number } };
export type Track = 'free' | 'premium';

const c = (amount: number): SeasonReward => ({ kind: 'coins', amount });
const skin = (id: string, name: string): SeasonReward => ({ kind: 'skin', id, name });
const theme = (id: string, name: string): SeasonReward => ({ kind: 'theme', id, name });

const STARS = [20, 40, 60, 90, 120, 160, 200, 250, 300, 360, 420, 490, 560, 640, 720, 810, 900, 1000, 1100, 1220, 1350, 1490, 1640, 1800, 1970, 2150, 2340, 2540, 2750, 3000] as const;
const FREE: readonly SeasonReward[] = [
  c(10), c(10), skin('pixel', 'Pixel'), c(15), c(15), c(20), c(20), c(25), skin('galaxie', 'Galaxie'), c(25),
  c(25), c(30), c(30), c(30), skin('lave', 'Lave'), c(35), c(40), c(40), c(50), c(45),
  c(45), c(50), c(50), c(55), c(60), c(60), c(65), c(70), c(80), skin('aurore', 'Aurore'),
];
const PREMIUM: readonly SeasonReward[] = [
  c(20), c(20), c(20), skin('neon', 'Néon'), c(25), c(25), c(25), c(30), skin('or', 'Or'), c(30),
  c(30), c(35), c(30), c(35), c(40), c(40), c(40), c(45), skin('cristal', 'Cristal'), c(45),
  c(50), c(50), c(55), theme('cite', 'Cité néon'), c(60), c(60), c(65), c(70), c(80), skin('abysse', 'Abysse'),
];

/** Saison 1 : du 17 novembre 2026 au 28 février 2027 inclus (UTC). */
export const SEASON_1: Season = {
  id: 's1',
  name: 'Saison 1',
  start: '2026-11-17',
  end: '2027-02-28',
  tiers: STARS.map((stars, i) => ({ tier: i + 1, stars, free: FREE[i]!, premium: PREMIUM[i]! })),
};

/**
 * Migration V5 → V6 (une seule fois, document de version < 4) : l'ancien palier N (1 à 10)
 * devient le niveau `LEGACY_TIER_MAP[N - 1]`, aux mêmes seuil et récompense. Une réclamation
 * déjà faite le reste ; aucune récompense n'est rendue deux fois.
 */
export const LEGACY_TIER_MAP = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19] as const;

export function migrateSeasonState(state: SeasonState): SeasonState {
  if (state.id !== SEASON_1.id) return state;
  const claimed = state.claimed.flatMap((key) => {
    const m = /^(free|premium):(\d{1,3})$/.exec(key);
    if (!m) return [];
    const next = LEGACY_TIER_MAP[Number(m[2]) - 1];
    return next ? [`${m[1]}:${next}`] : [];
  });
  return { ...state, claimed: [...new Set(claimed)] };
}

export const MAX_SEASON_STARS = 1_000_000;

export type SeasonPhase = 'upcoming' | 'active' | 'ended';
export function seasonPhase(season: Season, day: string): SeasonPhase {
  return day < season.start ? 'upcoming' : day > season.end ? 'ended' : 'active';
}

/** État de saison du document (une autre saison ou rien : départ à zéro pour cette saison). */
export function seasonState(doc: ProgressDoc, season: Season): SeasonState {
  return doc.season?.id === season.id ? doc.season : { id: season.id, stars: 0, claimed: [] };
}

/**
 * V8 : plafond quotidien d'étoiles de saison. Les étoiles d'XP restent entières ; le passe, lui,
 * avance d'au plus 80 étoiles par jour UTC. Il récompense la régularité plutôt que l'enchaînement
 * de parties : 3 000 étoiles demandent au moins 38 jours de jeu (docs/V8-ECONOMIE.md).
 */
export const SEASON_DAILY_STARS = 80;

/** Étoiles de saison encore créditables ce jour-là. */
export function seasonStarsLeftToday(doc: ProgressDoc, season: Season, day: string): number {
  const s = seasonState(doc, season);
  return Math.max(0, SEASON_DAILY_STARS - (s.today?.day === day ? s.today.stars : 0));
}

/**
 * V8 : crédite les étoiles de saison d'une partie, dans la limite du plafond du jour. Renvoie le
 * nombre réellement crédité (0 hors saison ou plafond atteint).
 */
export function creditSeasonStars(doc: ProgressDoc, season: Season, day: string, stars: number): { doc: ProgressDoc; credited: number } {
  if (stars <= 0 || seasonPhase(season, day) !== 'active') return { doc, credited: 0 };
  const credited = Math.min(stars, seasonStarsLeftToday(doc, season, day));
  if (credited <= 0) return { doc, credited: 0 };
  const s = seasonState(doc, season);
  const already = s.today?.day === day ? s.today.stars : 0;
  return {
    doc: { ...doc, season: { ...s, stars: Math.min(MAX_SEASON_STARS, s.stars + credited), today: { day, stars: already + credited } } },
    credited,
  };
}

/** Ajoute des étoiles de saison sans plafond quotidien (outil de test et de migration). */
export function addSeasonStars(doc: ProgressDoc, season: Season, day: string, stars: number): ProgressDoc {
  if (stars <= 0 || seasonPhase(season, day) !== 'active') return doc;
  const s = seasonState(doc, season);
  return { ...doc, season: { ...s, stars: Math.min(MAX_SEASON_STARS, s.stars + stars) } };
}

/** Niveau de passe atteint (0 à 30) et progression vers le suivant. */
export function seasonLevel(doc: ProgressDoc, season: Season): { level: number; max: number; into: number; span: number; next: SeasonTier | null } {
  const stars = seasonState(doc, season).stars;
  const reached = season.tiers.filter((t) => stars >= t.stars);
  const level = reached.length;
  const next = season.tiers[level] ?? null;
  const prev = reached.at(-1)?.stars ?? 0;
  return { level, max: season.tiers.length, into: stars - prev, span: next ? next.stars - prev : 1, next };
}

export type TierStatus = 'claimed' | 'claimable' | 'locked' | 'soon' | 'premium-unavailable' | 'ended';

export function tierStatus(
  doc: ProgressDoc,
  season: Season,
  tier: SeasonTier,
  track: Track,
  day: string,
  canDraw: (reward: SeasonReward) => boolean,
): TierStatus {
  const s = seasonState(doc, season);
  if (s.claimed.includes(`${track}:${tier.tier}`)) return 'claimed';
  if (track === 'premium') return 'premium-unavailable';
  if (seasonPhase(season, day) !== 'active') return 'ended';
  if (s.stars < tier.stars) return 'locked';
  if (tier.free.kind !== 'coins' && !canDraw(tier.free)) return 'soon';
  return 'claimable';
}

export type SeasonClaim =
  | { ok: true; doc: ProgressDoc; reward: SeasonReward }
  | { ok: false; doc: ProgressDoc; reason: Exclude<TierStatus, 'claimable'> | 'unknown-tier' };

/** Réclamation pure : à appeler sur le document relu sous verrou (une seule fois par niveau). */
export function claimSeasonTier(
  doc: ProgressDoc,
  season: Season,
  tierNumber: number,
  track: Track,
  day: string,
  canDraw: (reward: SeasonReward) => boolean,
): SeasonClaim {
  const tier = season.tiers.find((t) => t.tier === tierNumber);
  if (!tier) return { ok: false, doc, reason: 'unknown-tier' };
  const status = tierStatus(doc, season, tier, track, day, canDraw);
  if (status !== 'claimable') return { ok: false, doc, reason: status };
  const reward = tier.free;
  const s = seasonState(doc, season);
  const next: ProgressDoc = {
    ...doc,
    season: { ...s, claimed: [...s.claimed, `${track}:${tier.tier}`] },
    ...(reward.kind === 'coins'
      ? { coins: Math.min(MAX_COINS, doc.coins + reward.amount) }
      : { inventory: doc.inventory.includes(reward.id) ? doc.inventory : [...doc.inventory, reward.id] }),
  };
  return { ok: true, doc: next, reward };
}

/** Récupère tous les niveaux gratuits disponibles en une écriture (bouton « Tout récupérer »). */
export function claimAllFree(
  doc: ProgressDoc,
  season: Season,
  day: string,
  canDraw: (reward: SeasonReward) => boolean,
): { doc: ProgressDoc; rewards: SeasonReward[] } {
  let current = doc;
  const rewards: SeasonReward[] = [];
  for (const t of season.tiers) {
    const r = claimSeasonTier(current, season, t.tier, 'free', day, canDraw);
    if (r.ok) {
      current = r.doc;
      rewards.push(r.reward);
    }
  }
  return { doc: current, rewards };
}

/** Prochain niveau non encore atteint (pour la jauge), ou null si tout est atteint. */
export function nextTier(doc: ProgressDoc, season: Season): SeasonTier | null {
  const stars = seasonState(doc, season).stars;
  return season.tiers.find((t) => t.stars > stars) ?? null;
}

const SEASON_ID = /^[a-z0-9-]{1,16}$/;
const CLAIM = /^(free|premium):\d{1,3}$/;
export function sanitizeSeason(raw: unknown): SeasonState | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !SEASON_ID.test(r.id)) return undefined;
  const stars = typeof r.stars === 'number' && Number.isSafeInteger(r.stars) && r.stars >= 0 ? Math.min(r.stars, MAX_SEASON_STARS) : 0;
  const claimed = Array.isArray(r.claimed)
    ? [...new Set(r.claimed.filter((x): x is string => typeof x === 'string' && CLAIM.test(x)))].slice(0, 64)
    : [];
  const t = r.today as Record<string, unknown> | undefined;
  const today = typeof t === 'object' && t !== null && typeof t.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.day)
    && typeof t.stars === 'number' && Number.isInteger(t.stars) && t.stars >= 0
    ? { today: { day: t.day, stars: Math.min(t.stars, SEASON_DAILY_STARS) } }
    : {};
  return { id: r.id, stars, claimed, ...today };
}
