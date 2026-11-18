/**
 * Sélection du jour de la boutique (V7) — logique pure, sans serveur.
 *
 * - Renouvellement à 00 h 00 UTC : le jour de rotation est le nombre de jours UTC écoulés depuis
 *   1970. Même date et même version de catalogue → même sélection, sur tous les appareils, y
 *   compris après rechargement.
 * - Chaque jour : 3 matières, 1 univers, 2 musiques, tirés parmi les objets vendus en pièces.
 * - Régularité : la sélection est simulée jour après jour depuis l'entrée en vigueur de la version
 *   (`ROTATION_EPOCH_DAY`) ; chaque catégorie privilégie les objets absents depuis le plus
 *   longtemps, donc chaque objet (et chaque rareté) revient régulièrement. Pas de répétition
 *   immédiate d'un jour à l'autre quand la catégorie a assez d'objets. Au moins un objet épique
 *   ou légendaire et au moins un commun ou rare chaque jour, quand le catalogue le permet.
 * - La rotation renouvelle les offres, jamais les possessions : rien n'est donné ni retiré.
 *
 * Limite honnête : calculée sur l'appareil, elle suit son horloge. Changer l'heure montre la
 * sélection d'un autre jour (au même prix) ; cela ne donne ni pièce, ni cadeau, ni objet.
 */
import { catalogItem, type CosmeticKind } from './catalog';
import { hashString, rng } from './music/theory';
import { COIN_SHOP, type ShopItem } from './shop';
import type { Rarity } from '../game';

export const DAY_MS = 86_400_000;
/** Version du catalogue tournant : à changer quand on ajoute ou retire des objets vendus. */
export const ROTATION_VERSION = 1;
/** Premier jour de la version (18 novembre 2026, jour UTC 20 775). */
export const ROTATION_EPOCH_DAY = 20_775;
/** Au-delà, on simule seulement les derniers jours (coût borné, résultat toujours déterministe). */
export const MAX_SIMULATED_DAYS = 400;
export const SLOTS: Readonly<Record<CosmeticKind, number>> = { skin: 3, theme: 1, music: 2 };
/** Délai de grâce : une offre confirmée jusqu'à 5 min après le renouvellement reste honorée. */
export const OFFER_GRACE_MS = 5 * 60_000;

export type DailyOffer = ShopItem & { rarity: Rarity };

/** Jour de rotation (UTC) d'un instant. */
export const rotationDay = (nowMs: number): number => Math.floor(nowMs / DAY_MS);
/** Instant (ms) du prochain renouvellement : minuit UTC suivant. */
export const nextRotationAt = (nowMs: number): number => (rotationDay(nowMs) + 1) * DAY_MS;

const RANK: Record<Rarity, number> = { commun: 0, rare: 1, epique: 2, legendaire: 3 };

function poolOf(catalog: readonly ShopItem[]): Record<CosmeticKind, DailyOffer[]> {
  const pools: Record<CosmeticKind, DailyOffer[]> = { skin: [], theme: [], music: [] };
  for (const item of catalog) {
    const info = catalogItem(item.kind, item.id);
    if (!info) continue;
    pools[item.kind].push({ ...item, rarity: info.rarity });
  }
  return pools;
}

type Memo = { day: number; version: number; catalog: readonly ShopItem[]; offers: DailyOffer[] };
let memo: Memo | null = null;

/**
 * Offres du jour `day` (jour UTC), dans l'ordre d'affichage : matières, univers, musiques.
 * Pure : ne dépend que de `day`, de `version` et du catalogue.
 */
export function dailySelection(day: number, catalog: readonly ShopItem[] = COIN_SHOP, version = ROTATION_VERSION): DailyOffer[] {
  if (memo && memo.day === day && memo.version === version && memo.catalog === catalog) return memo.offers;
  const pools = poolOf(catalog);
  const start = day < ROTATION_EPOCH_DAY ? day : Math.max(ROTATION_EPOCH_DAY, day - MAX_SIMULATED_DAYS);
  const lastSeen = new Map<string, number>();
  let previous = new Set<string>();
  let offers: DailyOffer[] = [];
  for (let d = start; d <= day; d++) {
    const random = rng(hashString(`rotation:${version}:${d}`));
    const picked: { offer: DailyOffer; score: number; kind: CosmeticKind }[] = [];
    const leftovers: { offer: DailyOffer; score: number; kind: CosmeticKind }[] = [];
    for (const kind of ['skin', 'theme', 'music'] as const) {
      const pool = pools[kind];
      const slots = Math.min(SLOTS[kind], pool.length);
      if (slots === 0) continue;
      // Pas de répétition immédiate si la catégorie a assez d'autres objets.
      const fresh = pool.filter((o) => !previous.has(o.id));
      const candidates = fresh.length >= slots ? fresh : pool;
      const scored = candidates.map((offer) => {
        const seen = lastSeen.get(offer.id);
        const age = seen === undefined ? 1000 : d - seen;
        return { offer, kind, score: age + random() * 1.5 };
      }).sort((a, b) => b.score - a.score || a.offer.id.localeCompare(b.offer.id));
      picked.push(...scored.slice(0, slots));
      leftovers.push(...scored.slice(slots));
    }
    // Équilibre des raretés : au moins un épique/légendaire et au moins un commun/rare.
    const high = (o: DailyOffer) => RANK[o.rarity] >= 2;
    for (const wantHigh of [true, false]) {
      if (picked.some((p) => high(p.offer) === wantHigh)) continue;
      const swap = leftovers.filter((l) => high(l.offer) === wantHigh).sort((a, b) => b.score - a.score)[0];
      if (!swap) continue;
      // On remplace, dans la même catégorie, l'offre la moins prioritaire.
      const sameKind = picked.filter((p) => p.kind === swap.kind).sort((a, b) => a.score - b.score)[0];
      if (!sameKind) continue;
      picked[picked.indexOf(sameKind)] = swap;
    }
    offers = picked.map((p) => p.offer);
    for (const o of offers) lastSeen.set(o.id, d);
    previous = new Set(offers.map((o) => o.id));
  }
  const order: Record<CosmeticKind, number> = { skin: 0, theme: 1, music: 2 };
  offers = [...offers].sort((a, b) => order[a.kind] - order[b.kind] || RANK[a.rarity] - RANK[b.rarity] || a.id.localeCompare(b.id));
  memo = { day, version, catalog, offers };
  return offers;
}

/** L'objet est-il en vente aujourd'hui ? */
export function isOffered(day: number, kind: CosmeticKind, id: string, catalog: readonly ShopItem[] = COIN_SHOP): boolean {
  return dailySelection(day, catalog).some((o) => o.kind === kind && o.id === id);
}

/**
 * Achat ouvert au moment du renouvellement : la fenêtre de confirmation garde l'offre affichée
 * (objet, prix, jour). À la confirmation :
 * - même jour, ou objet encore proposé le nouveau jour : l'achat se fait au prix confirmé ;
 * - minuit UTC passé depuis moins de 5 minutes : l'offre affichée est honorée au prix confirmé ;
 * - au-delà : l'offre a expiré, rien n'est débité.
 * Dans tous les cas, jamais un autre objet ni un autre prix (vérifiés au débit, sous verrou).
 */
export type OfferCheck = { ok: true } | { ok: false; reason: 'expired' };

export function checkOpenOffer(offer: { kind: CosmeticKind; id: string; day: number }, nowMs: number, catalog: readonly ShopItem[] = COIN_SHOP): OfferCheck {
  const today = rotationDay(nowMs);
  if (today === offer.day) return { ok: true };
  if (isOffered(today, offer.kind, offer.id, catalog)) return { ok: true };
  if (today === offer.day + 1 && nowMs - today * DAY_MS < OFFER_GRACE_MS) return { ok: true };
  return { ok: false, reason: 'expired' };
}

/** « dans 5 h 12 » / « dans 8 min » jusqu'au prochain renouvellement. */
export function untilRotation(nowMs: number): string {
  const minutes = Math.ceil(Math.max(0, nextRotationAt(nowMs) - nowMs) / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `dans ${Math.max(1, m)} min`;
  return `dans ${h} h ${String(m).padStart(2, '0')}`;
}

/** Heure locale du renouvellement (« 01:00 »), selon le fuseau de l'appareil. */
export function rotationLocalTime(nowMs: number, locale = 'fr-FR'): string {
  try {
    return new Date(nextRotationAt(nowMs)).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '00:00 UTC';
  }
}
