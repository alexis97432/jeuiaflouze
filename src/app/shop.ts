/**
 * Boutique en pièces (E1e, ECONOMIE.md / C5) — logique pure, sans DOM ni stockage.
 *
 * - Les pièces se gagnent en jouant ; ce catalogue ne vend que des apparences supplémentaires.
 *   Les apparences d'objectifs (V2) ne deviennent jamais payantes : elles ne figurent pas ici.
 * - Un objet n'est proposé que si le moteur sait le dessiner (`isAvailable`, ex. `isSkinId`).
 * - Achat atomique : vérifier, débiter et livrer dans le même document, écrit en une fois sous
 *   le verrou de progression (shell). Jamais « débité mais non livré ».
 * - Les pièces sont locales : aucune valeur d'argent réel, aucun lien avec les achats payants.
 */
import { unlockedSkins } from './progression';
import type { ProgressDoc } from './economy';

export type ShopItem = { id: string; kind: 'skin'; price: number; name: string };

/** Premier catalogue (hypothèses C4/C5 : 12, 24 et 48 parties de référence). */
export const COIN_SHOP: readonly ShopItem[] = [
  { id: 'graphite', kind: 'skin', price: 60, name: 'Graphite' },
  { id: 'nacre', kind: 'skin', price: 120, name: 'Nacré' },
  { id: 'holographique', kind: 'skin', price: 240, name: 'Holographique' },
];

export type ItemState = 'owned' | 'affordable' | 'too-expensive';

/** Objets vendables : ceux que le moteur sait dessiner. */
export function sellableItems(
  catalog: readonly ShopItem[],
  isAvailable: (id: string) => boolean,
): ShopItem[] {
  return catalog.filter((item) => item.price > 0 && Number.isInteger(item.price) && isAvailable(item.id));
}

export function ownsItem(doc: ProgressDoc, item: ShopItem): boolean {
  return doc.inventory.includes(item.id) || (unlockedSkins(doc) as readonly string[]).includes(item.id);
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
