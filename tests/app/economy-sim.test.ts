/**
 * V8 — l'équilibre retenu tient ses objectifs sur les profils simulés (estimations, pas des
 * statistiques de vrais joueurs ; hypothèses dans docs/V8-ECONOMIE.md).
 */
import { describe, expect, it } from 'vitest';
import { PROFILES, simulate, v8PricesByRarity, v8ShopPrices, V7_SHOP_PRICES } from './economy-sim';

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const median = (xs: readonly number[]) => xs[Math.floor(xs.length / 2)]!;

function report(): string {
  const byRarity = v8PricesByRarity();
  const shopV8 = sum(v8ShopPrices());
  const shopV7 = sum(V7_SHOP_PRICES);
  const lines: string[] = [];
  lines.push(`Boutique entière : V7 ${shopV7} pièces (${V7_SHOP_PRICES.length} objets) ; V8 ${shopV8} pièces (${v8ShopPrices().length} objets).`);
  for (const p of PROFILES) {
    const v7 = simulate(p, 'v7');
    const v8 = simulate(p, 'v8');
    const day = (x: number | null) => (x === null ? '> 210 j' : `j${x}`);
    lines.push(`\n${p.label} (${p.minutes} min/jour, ${p.daysPerWeek} j/sem., ${p.meanHeight} étages en moyenne, ${Math.round(p.perfectRate * 100)} % de parfaits) — ${v8.gamesPerPlayDay} parties par jour joué`);
    lines.push(`  pièces après 20 min de jeu : V7 ${v7.coinsAtMinute(20)} · V8 ${v8.coinsAtMinute(20)}`);
    lines.push(`  pièces par jour joué (4 premières semaines) : V7 ${v7.coinsPerPlayDay} · V8 ${v8.coinsPerPlayDay}`);
    lines.push(`  toute la boutique V7 avec l'économie V7 : ${day(v7.dayToReach(shopV7))}`);
    lines.push(`  V8 : premier commun ${day(v8.dayToReach(byRarity.commun![0]!))} · premier rare ${day(v8.dayToReach(byRarity.rare![0]!))} · épique médian ${day(v8.dayToReach(median(byRarity.epique!)))} · légendaire médian ${day(v8.dayToReach(median(byRarity.legendaire!)))}`);
    lines.push(`  V8 : moitié de la boutique ${day(v8.dayToReach(shopV8 / 2))} · boutique entière ${day(v8.dayToReach(shopV8))} · passe gratuit fini V7 ${day(v7.passDone)} / V8 ${day(v8.passDone)}`);
  }
  return lines.join('\n');
}

describe('V8 — équilibre économique simulé', () => {
  it('rapport (ECONOMY_REPORT=<fichier> pour l’écrire)', async () => {
    const text = report();
    if (process.env.ECONOMY_REPORT) (await import('node:fs')).writeFileSync(process.env.ECONOMY_REPORT, text);
    expect(text).toContain('Régulier');
  });

  it('V7 : le constat de l’utilisateur est reproduit (boutique du jour payée en environ 20 minutes)', () => {
    const regular = simulate(PROFILES[1]!, 'v7');
    // Sélection du jour typique V7 : 3 matières, 1 univers, 2 musiques ≈ 1 000 pièces.
    expect(regular.coinsAtMinute(20)).toBeGreaterThan(600);
  });

  it('V8 : un premier achat rapide, sans tout acheter en quelques minutes', () => {
    const byRarity = v8PricesByRarity();
    for (const p of PROFILES) {
      const v8 = simulate(p, 'v8');
      expect(v8.dayToReach(byRarity.commun![0]!)).not.toBeNull();
      expect(v8.dayToReach(byRarity.commun![0]!)!).toBeLessThanOrEqual(3); // premier achat en 1 à 3 jours
      expect(v8.coinsAtMinute(20)).toBeLessThan(byRarity.rare![0]!); // pas de rare en 20 min
    }
  });

  it('V8 : des objectifs de moyen et long terme pour le joueur régulier', () => {
    const byRarity = v8PricesByRarity();
    const regular = simulate(PROFILES[1]!, 'v8');
    const rare = regular.dayToReach(byRarity.rare![0]!)!;
    const legendary = regular.dayToReach(median(byRarity.legendaire!))!;
    const all = regular.dayToReach(sum(v8ShopPrices()));
    expect(rare).toBeGreaterThanOrEqual(3);
    expect(rare).toBeLessThanOrEqual(10);
    expect(legendary).toBeGreaterThanOrEqual(14);
    expect(legendary).toBeLessThanOrEqual(45);
    expect(all === null || all > 90).toBe(true);
  });

  it('V8 : même le joueur performant met plusieurs semaines pour toute la boutique', () => {
    const top = simulate(PROFILES[2]!, 'v8');
    expect(top.dayToReach(sum(v8ShopPrices()))!).toBeGreaterThan(35);
  });

  it('V8 : le passe gratuit se finit en jours de jeu, pas en une soirée', () => {
    for (const p of PROFILES) {
      const v8 = simulate(p, 'v8');
      expect(v8.passDone === null || v8.passDone >= 38).toBe(true);
    }
  });
});
