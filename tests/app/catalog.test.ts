import { getTrack } from '../../src/app/music/tracks';
import { describe, expect, it } from 'vitest';
import { RARITIES, SKIN_RARITY, THEME_RARITY } from '../../src/game';
import { CATALOG, catalogCoverage, catalogItem, LOCAL_SKINS, LOCAL_THEMES, sourceLabel } from '../../src/app/catalog';
import { INITIAL_DOC, migrateProgress } from '../../src/app/economy';
import { selectAppearance, unlockedSkins, unlockedThemes } from '../../src/app/progression';
import { SEASON_1 } from '../../src/app/season';
import { COIN_SHOP, purchaseWithCoins } from '../../src/app/shop';

describe('V6 : catalogue et raretés', () => {
  it('chaque matière et chaque univers dessinables ont exactement une entrée', () => {
    expect(catalogCoverage()).toEqual({ skins: true, themes: true });
    expect(new Set(CATALOG.map((i) => i.name)).size).toBe(CATALOG.length);
    for (const item of CATALOG) expect(item.blurb.length, item.id).toBeGreaterThan(10);
  });

  it('la rareté du catalogue est celle du moteur ; toutes les raretés sont représentées', () => {
    for (const item of CATALOG) {
      const expected = item.kind === 'skin' ? SKIN_RARITY[item.id as keyof typeof SKIN_RARITY]
        : item.kind === 'theme' ? THEME_RARITY[item.id as keyof typeof THEME_RARITY]
          : getTrack(item.id)?.rarity;
      expect(item.rarity, item.id).toBe(expected);
    }
    for (const r of RARITIES) expect(CATALOG.some((i) => i.kind === 'skin' && i.rarity === r), r).toBe(true);
    // V7 : 23 matières (4 nouvelles) et 9 univers (4 nouveaux), une nouveauté par rareté.
    expect(CATALOG.filter((i) => i.kind === 'skin')).toHaveLength(23);
    expect(CATALOG.filter((i) => i.kind === 'theme')).toHaveLength(9);
    for (const r of RARITIES) expect(CATALOG.some((i) => i.kind === 'theme' && i.rarity === r), r).toBe(true);
  });

  it('provenances cohérentes : boutique = catalogue en pièces, passe = récompenses du passe', () => {
    const shopItems = CATALOG.filter((i) => i.source.kind === 'shop');
    expect(COIN_SHOP.map((i) => i.id).sort()).toEqual(shopItems.map((i) => i.id).sort());
    for (const item of CATALOG) {
      if (item.source.kind !== 'pass') continue;
      const tier = SEASON_1.tiers[item.source.tier - 1]!;
      const reward = item.source.track === 'free' ? tier.free : tier.premium;
      expect(reward, item.id).toMatchObject({ kind: item.kind, id: item.id });
    }
    expect(sourceLabel({ kind: 'shop', price: 120 })).toBe('Boutique · 120 pièces');
    expect(sourceLabel({ kind: 'pass', track: 'premium', tier: 30 })).toBe('Passe premium · niveau 30');
  });

  it('prix croissants avec la rareté (pièces du jeu), sans tirage au hasard', () => {
    const rank = { commun: 0, rare: 1, epique: 2, legendaire: 3 } as const;
    const priced = CATALOG.flatMap((i) => (i.source.kind === 'shop' && i.kind === 'skin' ? [[rank[i.rarity], i.source.price] as const] : []));
    for (const [r1, p1] of priced) for (const [r2, p2] of priced) if (r1 < r2) expect(p1).toBeLessThan(p2);
  });

  it('premium jamais débloqué localement, même écrit à la main dans la sauvegarde', () => {
    const hacked = migrateProgress({ version: 4, inventory: ['or', 'neon', 'cristal', 'abysse', 'cite', 'aurore', 'recif'] });
    expect(unlockedSkins(hacked)).not.toContain('or');
    expect(unlockedSkins(hacked)).not.toContain('abysse');
    expect(unlockedThemes(hacked)).not.toContain('cite');
    expect(unlockedSkins(hacked)).toContain('aurore');
    expect(unlockedThemes(hacked)).toContain('recif');
    expect(selectAppearance(hacked, { theme: 'cite', skin: 'abysse' }).selected).toEqual(hacked.selected);
    expect(LOCAL_SKINS).not.toContain('or');
    expect(LOCAL_THEMES).not.toContain('cite');
  });

  it('univers acheté en pièces : possédé une fois, équipable, jamais racheté', () => {
    const rich = { ...INITIAL_DOC, coins: 1530 };
    const r = purchaseWithCoins(rich, 'recif', COIN_SHOP);
    if (!r.ok) throw new Error(r.reason);
    expect(r.doc.coins).toBe(80);
    expect(unlockedThemes(r.doc)).toContain('recif');
    expect(selectAppearance(r.doc, { theme: 'recif' }).selected.theme).toBe('recif');
    expect(purchaseWithCoins(r.doc, 'recif', COIN_SHOP)).toMatchObject({ ok: false, reason: 'owned' });
    expect(catalogItem('theme', 'recif')?.rarity).toBe('epique');
  });

  it('objets déjà possédés (V5) conservés par la migration, avec leur rareté', () => {
    const v3 = migrateProgress({ version: 3, inventory: ['graphite', 'pixel', 'galaxie'], selected: { theme: 'confiserie', skin: 'galaxie' }, grants: ['v2-objectives-backfill'] });
    expect(unlockedSkins(v3)).toEqual(expect.arrayContaining(['graphite', 'pixel', 'galaxie']));
    expect(v3.selected.skin).toBe('galaxie');
    expect(catalogItem('skin', 'galaxie')?.rarity).toBe('legendaire');
    expect(catalogItem('skin', 'graphite')?.rarity).toBe('commun');
  });
});
