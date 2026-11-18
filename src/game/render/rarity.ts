/**
 * Raretés des cosmétiques (V6). Une rareté décrit la **réalisation** d'un objet, jamais un avantage :
 * aucune n'agit sur le score, les collisions, le rejeu ou le classement.
 *
 * - Commun : matière soignée et volume, sans animation propre.
 * - Rare : détail plus fin et reflet qui glisse lentement.
 * - Épique : matière en couches qui bouge, particules de pose signées.
 * - Légendaire : matière continue d'une brique à l'autre, avec profondeur interne, pose signée,
 *   célébration au parfait, aura du bloc mobile et cadre de la carte de résultat.
 */
import type { Rgb } from './themes';

export type Rarity = 'commun' | 'rare' | 'epique' | 'legendaire';
export const RARITIES: readonly Rarity[] = ['commun', 'rare', 'epique', 'legendaire'];

export interface RarityInfo {
  readonly name: string;
  readonly rank: 0 | 1 | 2 | 3;
  /** Teinte de la rareté (pastilles, cadres). Jamais seule : le nom est toujours écrit à côté. */
  readonly color: Rgb;
  /** Ce que la rareté apporte, en une phrase simple (aide de la collection). */
  readonly promise: string;
}

export const RARITY_INFO: Record<Rarity, RarityInfo> = {
  commun: { name: 'Commun', rank: 0, color: [128, 140, 160], promise: 'Une matière soignée, en relief.' },
  rare: { name: 'Rare', rank: 1, color: [46, 140, 240], promise: 'Plus de détails et un reflet qui glisse.' },
  epique: { name: 'Épique', rank: 2, color: [160, 80, 240], promise: 'Une matière qui bouge et une pose signée.' },
  legendaire: {
    name: 'Légendaire', rank: 3, color: [240, 160, 20],
    promise: 'Un monde vivant dans les briques, une pose et un parfait signés.',
  },
};

export const rarityRank = (r: Rarity): number => RARITY_INFO[r].rank;
