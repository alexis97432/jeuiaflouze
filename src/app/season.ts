/**
 * Passe de saison (V3-A5). Une première saison finie, à dates fixes (UTC).
 * - Étoiles de saison = étoiles gagnées en partie pendant la saison (même calcul que l'XP,
 *   ajoutées dans la même écriture que les gains de la partie : jamais deux fois).
 * - Piste gratuite : vraiment réclamable, une fois par palier.
 * - Piste premium : visible en aperçu, **Indisponible** tant qu'aucun droit vérifié par le
 *   serveur n'existe (paiement + comptes : docs/SERVICES.md). Jamais déverrouillée localement.
 * - Une apparence obtenue reste à vie (inventaire), même après la fin de la saison.
 * - Une récompense dont le moteur ne sait pas encore dessiner l'apparence attend (« Bientôt »).
 */
import { MAX_COINS, type ProgressDoc } from './economy';

export type SeasonReward = { kind: 'coins'; amount: number } | { kind: 'skin'; id: string; name: string };
export type SeasonTier = { tier: number; stars: number; free: SeasonReward; premium: SeasonReward };
export type Season = { id: string; name: string; start: string; end: string; tiers: readonly SeasonTier[] };
export type SeasonState = { id: string; stars: number; claimed: string[] };
export type Track = 'free' | 'premium';

const c = (amount: number): SeasonReward => ({ kind: 'coins', amount });
const skin = (id: string, name: string): SeasonReward => ({ kind: 'skin', id, name });

/** Saison 1 : du 17 novembre 2026 au 28 février 2027 inclus (UTC). Contenu convenu avec FLK (#27). */
export const SEASON_1: Season = {
  id: 's1',
  name: 'Saison 1',
  start: '2026-11-17',
  end: '2027-02-28',
  tiers: [
    { tier: 1, stars: 20, free: c(10), premium: c(20) },
    { tier: 2, stars: 60, free: skin('pixel', 'Pixel'), premium: c(20) },
    { tier: 3, stars: 120, free: c(15), premium: c(25) },
    { tier: 4, stars: 200, free: c(20), premium: c(25) },
    { tier: 5, stars: 300, free: skin('galaxie', 'Galaxie'), premium: skin('or', 'Or') },
    { tier: 6, stars: 420, free: c(25), premium: c(30) },
    { tier: 7, stars: 560, free: c(30), premium: c(30) },
    { tier: 8, stars: 720, free: skin('lave', 'Lave'), premium: c(40) },
    { tier: 9, stars: 900, free: c(40), premium: c(40) },
    { tier: 10, stars: 1100, free: c(50), premium: skin('cristal', 'Cristal') },
  ],
};

export const MAX_SEASON_STARS = 1_000_000;

export type SeasonPhase = 'upcoming' | 'active' | 'ended';
export function seasonPhase(season: Season, day: string): SeasonPhase {
  return day < season.start ? 'upcoming' : day > season.end ? 'ended' : 'active';
}

/** État de saison du document (une autre saison ou rien : départ à zéro pour cette saison). */
export function seasonState(doc: ProgressDoc, season: Season): SeasonState {
  return doc.season?.id === season.id ? doc.season : { id: season.id, stars: 0, claimed: [] };
}

/** Ajoute les étoiles d'une partie, seulement pendant la saison. */
export function addSeasonStars(doc: ProgressDoc, season: Season, day: string, stars: number): ProgressDoc {
  if (stars <= 0 || seasonPhase(season, day) !== 'active') return doc;
  const s = seasonState(doc, season);
  return { ...doc, season: { ...s, stars: Math.min(MAX_SEASON_STARS, s.stars + stars) } };
}

export type TierStatus = 'claimed' | 'claimable' | 'locked' | 'soon' | 'premium-unavailable' | 'ended';

export function tierStatus(
  doc: ProgressDoc,
  season: Season,
  tier: SeasonTier,
  track: Track,
  day: string,
  canDraw: (skinId: string) => boolean,
): TierStatus {
  const s = seasonState(doc, season);
  if (s.claimed.includes(`${track}:${tier.tier}`)) return 'claimed';
  if (track === 'premium') return 'premium-unavailable';
  if (seasonPhase(season, day) !== 'active') return 'ended';
  if (s.stars < tier.stars) return 'locked';
  const reward = tier.free;
  if (reward.kind === 'skin' && !canDraw(reward.id)) return 'soon';
  return 'claimable';
}

export type SeasonClaim =
  | { ok: true; doc: ProgressDoc; reward: SeasonReward }
  | { ok: false; doc: ProgressDoc; reason: Exclude<TierStatus, 'claimable'> | 'unknown-tier' };

/** Réclamation pure : à appeler sur le document relu sous verrou (une seule fois par palier). */
export function claimSeasonTier(
  doc: ProgressDoc,
  season: Season,
  tierNumber: number,
  track: Track,
  day: string,
  canDraw: (skinId: string) => boolean,
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

/** Prochain palier non encore atteint (pour la jauge), ou null si tout est atteint. */
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
  return { id: r.id, stars, claimed };
}
