/**
 * Boutique en pièces du jeu (E1e, ECONOMIE.md / C5 ; V6 : matières et univers ; V7 : musiques et
 * sélection du jour) — logique pure.
 *
 * - Les pièces se gagnent en jouant ; elles ne s'achètent pas et n'ont aucune valeur d'argent.
 * - Ce catalogue ne vend que des cosmétiques déterminés (jamais de tirage au hasard), à prix fixe.
 *   Les apparences d'objectifs ne deviennent jamais payantes : elles ne figurent pas ici.
 * - Un objet n'est proposé que si le moteur sait le dessiner (`isAvailable`).
 * - Achat atomique : vérifier, débiter et livrer dans le même document, écrit en une fois sous
 *   le verrou de progression (shell). Jamais « débité mais non livré », jamais deux débits.
 * - V7 : le prix confirmé par le joueur est vérifié au moment du débit ; s'il diffère (catalogue
 *   mis à jour entre-temps), rien n'est débité.
 */
import { MUSIC_CATALOG, musicInventoryId, SKIN_CATALOG, THEME_CATALOG, type CosmeticKind, type ShopEventId } from './catalog';
import { ownsMusic, unlockedSkins, unlockedThemes } from './progression';
import type { ProgressDoc } from './economy';

/** `season` (V8) : objet saisonnier, vendu pendant son événement seulement (rotation.ts). */
export type ShopItem = { id: string; kind: CosmeticKind; price: number; name: string; season?: ShopEventId };

export { musicInventoryId };

/** Catalogue en pièces, dérivé du catalogue (prix fixés par rareté). */
export const COIN_SHOP: readonly ShopItem[] = [...SKIN_CATALOG, ...THEME_CATALOG, ...MUSIC_CATALOG].flatMap((i) =>
  i.source.kind === 'shop' ? [{ id: i.id, kind: i.kind, price: i.source.price, name: i.name, ...(i.source.season ? { season: i.source.season } : {}) }] : []);

export type ItemState = 'owned' | 'affordable' | 'too-expensive';

/** Objets vendables : ceux que le moteur sait dessiner (ou jouer). */
export function sellableItems(
  catalog: readonly ShopItem[],
  isAvailable: (id: string) => boolean,
): ShopItem[] {
  return catalog.filter((item) => item.price > 0 && Number.isInteger(item.price) && isAvailable(item.id));
}

export function ownsItem(doc: ProgressDoc, item: Pick<ShopItem, 'id' | 'kind'>): boolean {
  if (item.kind === 'music') return ownsMusic(doc, item.id);
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
  | { ok: false; doc: ProgressDoc; reason: 'unknown-item' | 'owned' | 'insufficient' | 'price-changed'; missing?: number };

/**
 * Achète `itemId` avec des pièces. Pur et déterministe : appelé sur le document **relu sous
 * verrou**, il refuse un double achat (déjà possédé), un solde devenu insuffisant entre-temps, ou
 * un prix différent de `confirmedPrice` (le prix affiché et accepté par le joueur).
 */
export function purchaseWithCoins(doc: ProgressDoc, itemId: string, catalog: readonly ShopItem[], confirmedPrice?: number): PurchaseResult {
  const item = catalog.find((i) => i.id === itemId);
  if (!item) return { ok: false, doc, reason: 'unknown-item' };
  if (confirmedPrice !== undefined && confirmedPrice !== item.price) return { ok: false, doc, reason: 'price-changed' };
  if (ownsItem(doc, item)) return { ok: false, doc, reason: 'owned' };
  if (doc.coins < item.price) return { ok: false, doc, reason: 'insufficient', missing: item.price - doc.coins };
  const entry = item.kind === 'music' ? musicInventoryId(item.id) : item.id;
  return {
    ok: true,
    item,
    doc: { ...doc, coins: doc.coins - item.price, inventory: [...doc.inventory, entry] },
  };
}
