import { describe, expect, it } from 'vitest';
import { INITIAL_DOC, migrateProgress, type ProgressDoc } from '../../src/app/economy';
import { selectAppearance, unlockedSkins } from '../../src/app/progression';
import { COIN_SHOP, itemState, purchaseWithCoins, sellableItems, type ShopItem } from '../../src/app/shop';

const catalog: ShopItem[] = [
  { id: 'ceramique', kind: 'skin', price: 50, name: 'Céramique' },
  { id: 'graphite', kind: 'skin', price: 60, name: 'Graphite' },
];
const rich = (coins: number): ProgressDoc => ({ ...INITIAL_DOC, coins });

describe('catalogue', () => {
  it('prix fixés (V5 inchangés, V6 par rareté), univers Récif, aucune apparence d’objectif à vendre', () => {
    expect(COIN_SHOP.map((i) => [i.id, i.kind, i.price])).toEqual([
      ['graphite', 'skin', 60], ['bois', 'skin', 60], ['nacre', 'skin', 120], ['circuit', 'skin', 280], ['holographique', 'skin', 240],
      // V7 : une matière et un univers de plus par rareté.
      ['papier', 'skin', 70], ['mosaique', 'skin', 140], ['vitrail', 'skin', 260], ['phenix', 'skin', 520],
      ['recif', 'theme', 320], ['desert', 'theme', 140], ['montagne', 'theme', 220], ['foire', 'theme', 320], ['nuees', 'theme', 560],
      // V7 : musiques en pièces du jeu (compositions originales).
      ['gouter-lofi', 'music', 90], ['pixel-parade', 'music', 150], ['fanfare-de-poche', 'music', 150], ['funk-des-briques', 'music', 240], ['aurore-polaire', 'music', 420],
    ]);
    const objectiveSkins = ['marbre', 'bonbon', 'verre', 'strie', 'ceramique'];
    expect(COIN_SHOP.some((i) => objectiveSkins.includes(i.id))).toBe(false);
  });

  it('ne vend que ce que le moteur sait dessiner', () => {
    expect(sellableItems(catalog, (id) => id === 'ceramique').map((i) => i.id)).toEqual(['ceramique']);
    expect(sellableItems(COIN_SHOP, () => false)).toEqual([]);
  });
});

describe('achat en pièces', () => {
  it('débite et livre dans le même document ; l’objet devient sélectionnable', () => {
    const r = purchaseWithCoins(rich(70), 'ceramique', catalog);
    if (!r.ok) throw new Error(r.reason);
    expect(r.doc.coins).toBe(20);
    expect(r.doc.inventory).toEqual(['ceramique']);
    expect(unlockedSkins(r.doc)).toContain('ceramique');
    expect(selectAppearance(r.doc, { skin: 'ceramique' }).selected.skin).toBe('ceramique');
  });

  it('refuse : déjà possédé (double achat), solde insuffisant, objet inconnu — sans rien débiter', () => {
    const first = purchaseWithCoins(rich(200), 'ceramique', catalog);
    if (!first.ok) throw new Error('attendu');
    const again = purchaseWithCoins(first.doc, 'ceramique', catalog);
    expect(again).toMatchObject({ ok: false, reason: 'owned' });
    expect(again.doc).toBe(first.doc);
    expect(purchaseWithCoins(rich(59), 'graphite', catalog)).toMatchObject({ ok: false, reason: 'insufficient', missing: 1 });
    expect(purchaseWithCoins(rich(999), 'pirate', catalog)).toMatchObject({ ok: false, reason: 'unknown-item' });
  });

  it('un objet déjà gagné par objectif n’est jamais revendu', () => {
    const doc: ProgressDoc = { ...rich(500), completed: ['streak-4'] };
    expect(itemState(doc, catalog[0]!)).toBe('owned');
    expect(purchaseWithCoins(doc, 'ceramique', catalog)).toMatchObject({ ok: false, reason: 'owned' });
  });

  it('états : possédé, abordable, trop cher', () => {
    expect(itemState(rich(60), catalog[1]!)).toBe('affordable');
    expect(itemState(rich(59), catalog[1]!)).toBe('too-expensive');
  });

  it('achat et sélection survivent au rechargement (inventaire pris en compte à la lecture)', () => {
    const r = purchaseWithCoins(rich(100), 'ceramique', catalog);
    if (!r.ok) throw new Error('attendu');
    const saved = JSON.parse(JSON.stringify(selectAppearance(r.doc, { skin: 'ceramique' })));
    const reloaded = migrateProgress(saved);
    expect(reloaded.selected.skin).toBe('ceramique');
    expect(reloaded.inventory).toEqual(['ceramique']);
    expect(reloaded.coins).toBe(50);
  });
});
