/**
 * V8 — simulation de l'économie (estimations, pas des statistiques de vrais joueurs).
 *
 * Joue des journées entières pour trois profils hypothétiques avec les **vraies** fonctions de
 * gain du jeu (parties, objectifs, prime du jour, calendrier, passe de saison), puis compare avec
 * les formules de la V7. Aucun achat n'est simulé : on mesure le cumul de pièces gagnées et le
 * temps pour atteindre le prix d'objets de chaque rareté.
 *
 * Rapport lisible : `ECONOMY_REPORT=rapport.txt npx vitest run tests/app/economy-sim.test.ts`.
 */
import { applyRunEconomy, claimCalendar, INITIAL_DOC, runXp, type ProgressDoc } from '../../src/app/economy';
import { activeObjectives } from '../../src/app/progression';
import { claimAllFree, creditSeasonStars, addSeasonStars, SEASON_1, seasonLevel } from '../../src/app/season';
import { CATALOG } from '../../src/app/catalog';

export type Profile = {
  id: string;
  label: string;
  /** Minutes de jeu par jour joué. */
  minutes: number;
  /** Jours joués par semaine (les premiers jours de chaque semaine). */
  daysPerWeek: number;
  /** Hauteur moyenne et écart type d'une partie. */
  meanHeight: number;
  sdHeight: number;
  /** Probabilité qu'un étage soit un parfait. */
  perfectRate: number;
};

/** Hypothèses retenues (docs/V8-ECONOMIE.md). */
export const PROFILES: readonly Profile[] = [
  { id: 'debutant', label: 'Débutant', minutes: 15, daysPerWeek: 4, meanHeight: 9, sdHeight: 4, perfectRate: 0.08 },
  { id: 'regulier', label: 'Régulier', minutes: 25, daysPerWeek: 6, meanHeight: 20, sdHeight: 7, perfectRate: 0.2 },
  { id: 'performant', label: 'Performant', minutes: 40, daysPerWeek: 7, meanHeight: 38, sdHeight: 10, perfectRate: 0.4 },
];

/** Durée d'une partie (s) : 1,3 s par étage, plus 12 s de lancement, chute et écran de résultat. */
export const gameSeconds = (height: number): number => 12 + 1.3 * height;

/** Prix V7 des objets en boutique (avant recalibrage), pour la comparaison. */
export const V7_SHOP_PRICES: readonly number[] = [60, 60, 120, 280, 240, 70, 140, 260, 520, 320, 140, 220, 320, 560, 90, 150, 150, 240, 420];

export type Economy = 'v7' | 'v8';

export type SimResult = {
  /** Pièces cumulées après N minutes de jeu (indice = minute). */
  coinsAtMinute: (minute: number) => number;
  /** Jour (1 = premier jour) où le cumul atteint `price`, ou null au-delà de l'horizon. */
  dayToReach: (price: number) => number | null;
  /** Jour où le passe gratuit est entièrement atteint, ou null. */
  passDone: number | null;
  /** Pièces par jour joué, en moyenne sur les 4 premières semaines. */
  coinsPerPlayDay: number;
  gamesPerPlayDay: number;
};

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function normal(r: () => number): number {
  const u = Math.max(1e-9, r());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

const V7_CALENDAR = [5, 5, 5, 5, 5, 10, 15];

/** Simule `days` jours calendaires à partir du début de la saison 1. */
export function simulate(profile: Profile, economy: Economy, days = 210, seed = 42): SimResult {
  const r = rng(seed);
  let doc: ProgressDoc = INITIAL_DOC;
  let earned = 0;
  let minutes = 0;
  let v7Cal = 0;
  const minuteLog: [number, number][] = [[0, 0]];
  const dayLog: number[] = [];
  let passDone: number | null = null;
  let games = 0;
  let playDays = 0;
  let earnedFirst4w = 0;
  let runN = 0;
  const start = Date.parse(`${SEASON_1.start}T00:00:00Z`);
  for (let d = 0; d < days; d++) {
    const day = new Date(start + d * 86_400_000).toISOString().slice(0, 10);
    if (d % 7 < profile.daysPerWeek) {
      playDays++;
      // Calendrier : réclamé à chaque jour joué.
      if (economy === 'v8') {
        const c = claimCalendar(doc, day);
        if (c.claimed) { doc = c.doc; earned += c.reward; }
      } else {
        earned += V7_CALENDAR[v7Cal % 7]!;
        v7Cal++;
      }
      let used = 0;
      while (used < profile.minutes * 60) {
        const height = Math.max(1, Math.round(profile.meanHeight + profile.sdHeight * normal(r)));
        let perfects = 0, streak = 0, longest = 0;
        for (let f = 0; f < height; f++) {
          if (r() < profile.perfectRate) { perfects++; streak++; longest = Math.max(longest, streak); } else streak = 0;
        }
        const run = { runId: `r${runN++}`, mode: 'free' as const, score: height, perfectCount: perfects, longestStreak: longest };
        const e = applyRunEconomy(doc, activeObjectives(doc).map((o) => o.id), run, economy === 'v8' ? day : undefined);
        let gain = e.gained.coins;
        if (economy === 'v7') {
          // Formules V7 : min(25, ⌊h/3⌋ + parfaits) + 10 par objectif ; étoiles de saison = XP.
          gain = Math.min(25, Math.floor(height / 3) + perfects) + 10 * e.completedNow.length;
          doc = addSeasonStars(e.doc, SEASON_1, day, runXp(run));
        } else {
          doc = creditSeasonStars(e.doc, SEASON_1, day, e.gained.xp).doc;
        }
        earned += gain;
        const before = doc.coins;
        const claim = claimAllFree(doc, SEASON_1, day, () => true);
        doc = claim.doc;
        // Pièces du passe gratuit (identiques en V7 et V8 : mêmes niveaux, mêmes récompenses).
        earned += doc.coins - before;
        used += gameSeconds(height);
        games++;
        minutes += gameSeconds(height) / 60;
        minuteLog.push([minutes, earned]);
      }
      if (passDone === null && seasonLevel(doc, SEASON_1).level >= SEASON_1.tiers.length) passDone = d + 1;
    }
    dayLog.push(earned);
    if (d === 27) earnedFirst4w = earned;
  }
  return {
    coinsAtMinute: (m) => {
      let v = 0;
      for (const [t, c] of minuteLog) { if (t <= m) v = c; else break; }
      return v;
    },
    dayToReach: (price) => {
      const i = dayLog.findIndex((c) => c >= price);
      return i < 0 ? null : i + 1;
    },
    passDone,
    coinsPerPlayDay: Math.round(earnedFirst4w / Math.max(1, Math.min(playDays, Math.round((28 * profile.daysPerWeek) / 7)))),
    gamesPerPlayDay: Math.round(games / Math.max(1, playDays)),
  };
}

/** Prix V8 des objets en boutique (catalogue actuel). */
export function v8ShopPrices(): number[] {
  return CATALOG.flatMap((i) => (i.source.kind === 'shop' ? [i.source.price] : []));
}

/** Prix par rareté (V8), pour les repères « premier objet rare », etc. */
export function v8PricesByRarity(): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const i of CATALOG) {
    if (i.source.kind !== 'shop') continue;
    (out[i.rarity] ??= []).push(i.source.price);
  }
  for (const k of Object.keys(out)) out[k]!.sort((a, b) => a - b);
  return out;
}
