/**
 * Boutique en pièces du jeu (E1e, ECONOMIE.md / C5 ; V6 : matières et univers) — logique pure.
 *
 * - Les pièces se gagnent en jouant ; elles ne s'achètent pas et n'ont aucune valeur d'argent.
 * - Ce catalogue ne vend que des cosmétiques déterminés (jamais de tirage au hasard), à prix fixe.
 *   Les apparences d'objectifs ne deviennent jamais payantes : elles ne figurent pas ici.
 * - Un objet n'est proposé que si le moteur sait le dessiner (`isAvailable`).
 * - Achat atomique : vérifier, débiter et livrer dans le même document, écrit en une fois sous
 *   le verrou de progression (shell). Jamais « débité mais non livré », jamais deux débits.
 */
import { SKIN_CATALOG, THEME_CATALOG } from './catalog';
import { unlockedSkins, unlockedThemes } from './progression';
import type { ProgressDoc } from './economy';

export type ShopItem = { id: string; kind: 'skin' | 'theme'; price: number; name: string };

/** Catalogue en pièces, dérivé du catalogue V6 (prix fixés par rareté, inchangés depuis la V5). */
export const COIN_SHOP: readonly ShopItem[] = [...SKIN_CATALOG, ...THEME_CATALOG].flatMap((i) =>
  i.source.kind === 'shop' ? [{ id: i.id, kind: i.kind, price: i.source.price, name: i.name }] : []);

export type ItemState = 'owned' | 'affordable' | 'too-expensive';

/** Objets vendables : ceux que le moteur sait dessiner. */
export function sellableItems(
  catalog: readonly ShopItem[],
  isAvailable: (id: string) => boolean,
): ShopItem[] {
  return catalog.filter((item) => item.price > 0 && Number.isInteger(item.price) && isAvailable(item.id));
}

export function ownsItem(doc: ProgressDoc, item: ShopItem): boolean {
  if (doc.inventory.includes(item.id)) return true;
  return item.kind === 'theme'
    ? (unlockedThemes(doc) as readonly string[]).includes(item.id)
    : (unlockedSkins(doc) as readonly string[]).includes(item.id);
}

export function itemState(doc: ProgressDoc, item: ShopItem): ItemState {
  if (ownsItem(doc, item)) return 'owned';
  return doc.coins >= item.price ? 'affordable' : 'too-expensive';
}

export type PurchaseResult =
  | { ok: true; doc: ProgressDoc; item: ShopItem }
  | { ok: false; doc: ProgressDoc; reason: 'unknown-item' | 'owned' | 'insufficient'; missing?: number };

/**
 * Achète `itemId` avec des pièces. Pur et déterministe : appelé sur le document **relu sous
 * verrou**, il refuse un double achat (déjà possédé) ou un solde devenu insuffisant entre-temps.
 */
export function purchaseWithCoins(doc: ProgressDoc, itemId: string, catalog: readonly ShopItem[]): PurchaseResult {
  const item = catalog.find((i) => i.id === itemId);
  if (!item) return { ok: false, doc, reason: 'unknown-item' };
  if (ownsItem(doc, item)) return { ok: false, doc, reason: 'owned' };
  if (doc.coins < item.price) return { ok: false, doc, reason: 'insufficient', missing: item.price - doc.coins };
  return {
    ok: true,
    item,
    doc: { ...doc, coins: doc.coins - item.price, inventory: [...doc.inventory, item.id] },
  };
}
