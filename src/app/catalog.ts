/**
 * Catalogue des cosmétiques (V6) : une seule source pour la rareté, le nom, la phrase de
 * description et la provenance de chaque matière et de chaque univers. Logique pure.
 *
 * Raretés : réalisation de l'objet (moteur : `SKIN_RARITY`, `THEME_RARITY`), jamais un avantage
 * de jeu, jamais une valeur d'argent. Aucun tirage au hasard n'est vendu.
 * Provenances : par défaut, mission, boutique (pièces du jeu), passe gratuit, passe premium.
 * Le premium reste visible mais ne se débloque jamais localement (droit serveur à venir).
 */
import {
  ALL_SKIN_IDS,
  RARITY_INFO,
  SKIN_RARITY,
  THEME_IDS,
  THEME_RARITY,
  rarityRank,
  type AnySkinId,
  type Rarity,
  type ThemeId,
} from '../game';
import type { ObjectiveId } from './progression';
import { TRACKS } from './music/tracks';

export type CosmeticKind = 'skin' | 'theme' | 'music';

export type Source =
  | { kind: 'default' }
  | { kind: 'mission'; objective: ObjectiveId }
  | { kind: 'shop'; price: number }
  | { kind: 'pass'; track: 'free' | 'premium'; tier: number }
  /** V7 : musique d'un univers, possédée avec lui. */
  | { kind: 'universe'; theme: ThemeId };

export type CatalogItem = {
  readonly kind: CosmeticKind;
  readonly id: AnySkinId | ThemeId | string;
  readonly name: string;
  readonly rarity: Rarity;
  /** Une phrase : ce qu'on voit (révélation, collection). */
  readonly blurb: string;
  readonly source: Source;
};

const skin = (id: AnySkinId, name: string, blurb: string, source: Source): CatalogItem =>
  ({ kind: 'skin', id, name, rarity: SKIN_RARITY[id], blurb, source });
const theme = (id: ThemeId, name: string, blurb: string, source: Source): CatalogItem =>
  ({ kind: 'theme', id, name, rarity: THEME_RARITY[id], blurb, source });
const shop = (price: number): Source => ({ kind: 'shop', price });
const free = (tier: number): Source => ({ kind: 'pass', track: 'free', tier });
const premium = (tier: number): Source => ({ kind: 'pass', track: 'premium', tier });
const mission = (objective: ObjectiveId): Source => ({ kind: 'mission', objective });

/** Matières, de la plus simple à la plus rare. */
export const SKIN_CATALOG: readonly CatalogItem[] = [
  skin('gomme', 'Gomme', 'Caoutchouc doux au grain fin.', { kind: 'default' }),
  skin('strie', 'Strié', 'Plastique côtelé en relief.', mission('floors-18')),
  skin('bonbon', 'Bonbon', 'Sucre d’orge verni et cristaux de sucre.', mission('streak-2')),
  skin('graphite', 'Graphite', 'Mine sombre au liseré métallique.', shop(200)),
  skin('bois', 'Bois', 'Bois verni : le fil et les nœuds suivent chaque pièce.', shop(220)),
  skin('marbre', 'Marbré', 'Marbre poli aux veines profondes.', mission('floors-5')),
  skin('ceramique', 'Céramique', 'Émail craquelé et grand reflet.', mission('streak-4')),
  skin('verre', 'Verre dépoli', 'Verre givré, bulles prises dans la masse.', mission('perfects-5')),
  skin('nacre', 'Nacré', 'Nacre irisée qui change de teinte.', shop(600)),
  skin('pixel', 'Pixel', 'Carreaux 8-bit et éclat qui défile.', free(3)),
  skin('circuit', 'Circuit', 'Pistes dorées parcourues d’impulsions lumineuses.', shop(1400)),
  skin('holographique', 'Holographique', 'Bandes arc-en-ciel qui glissent et scintillent.', shop(1300)),
  skin('lave', 'Lave', 'Magma qui coule sous une croûte fendue, braises à la pose.', free(15)),
  skin('or', 'Or', 'Or brossé et gravé, reflets qui passent, éclats.', premium(9)),
  skin('neon', 'Néon', 'Tube néon qui bourdonne dans le verre fumé.', premium(4)),
  skin('galaxie', 'Galaxie', 'Un même cosmos traverse toute la tour, en profondeur.', free(9)),
  skin('cristal', 'Cristal', 'Facettes, lumière qui traverse et arêtes de prisme.', premium(19)),
  skin('aurore', 'Aurore', 'Rideaux d’aurore qui ondulent dans une nuit étoilée.', free(30)),
  skin('abysse', 'Abysse', 'L’océan profond, ses reflets et un poisson qui passe.', premium(30)),
  // V7 : une matière de plus par rareté, vendues en pièces dans la sélection du jour.
  skin('papier', 'Papier', 'Papier fait main : fibres, pli et bord déchiré.', shop(160)),
  skin('mosaique', 'Mosaïque', 'Tesselles émaillées posées à la main ; le reflet glisse.', shop(650)),
  skin('vitrail', 'Vitrail', 'Verres de couleur sertis de plomb, traversés par la lumière.', shop(1500)),
  skin('phenix', 'Phénix', 'Un plumage de feu traverse toute la tour, braises qui montent.', shop(3000)),
];

export const THEME_CATALOG: readonly CatalogItem[] = [
  theme('confiserie', 'Confiserie', 'Du village sucré à la nuit bonbon et sa lune en chocolat.', { kind: 'default' }),
  theme('jardin', 'Jardin', 'Du potager aux cerfs-volants, jusqu’à la nuit des lucioles.', mission('daily-8')),
  theme('orbital', 'Orbital', 'Du pas de tir à la nébuleuse, en passant par l’orbite.', mission('floors-12')),
  theme('recif', 'Récif', 'Du fond marin à la surface, puis l’aurore sur la mer.', shop(1450)),
  theme('cite', 'Cité néon', 'De la rue sous la pluie jusqu’à l’anneau orbital.', premium(24)),
  // V7 : un univers de plus par rareté, vendus en pièces dans la sélection du jour.
  theme('desert', 'Désert', 'Du campement dans les dunes à la Voie lactée, caravane et mirage.', shop(350)),
  theme('montagne', 'Montagne', 'Des chalets du col aux sommets roses du soir, téléphérique et aigle.', shop(800)),
  theme('foire', 'Fête foraine', 'Grande roue, manège et montagnes russes, jusqu’aux feux d’artifice.', shop(1600)),
  theme('nuees', 'Royaume des nuées', 'Îles suspendues et cascades, baleine céleste et citadelle dorée.', shop(3400)),
];

/**
 * V7 : musiques. Chaque univers a sa musique, possédée avec lui ; « Premier étage » est offerte à
 * tous ; les autres s'achètent en pièces du jeu. Compositions originales (src/app/music/tracks.ts).
 */
const UNIVERSE_TRACK: Partial<Record<ThemeId, string>> = {
  confiserie: 'sucre-glace', jardin: 'rosee', orbital: 'apesanteur', recif: 'lagon', cite: 'nocturne-neon',
  desert: 'mirage', montagne: 'cimes', foire: 'manege', nuees: 'nuees',
};
const MUSIC_SOURCE: Record<string, Source> = {
  'premier-etage': { kind: 'default' },
  'gouter-lofi': shop(180),
  'pixel-parade': shop(450),
  'fanfare-de-poche': shop(450),
  'funk-des-briques': shop(900),
  'aurore-polaire': shop(1800),
};

/** Musique d'un univers (mode « musique de l'univers »), ou undefined. */
export const universeTrack = (theme: ThemeId): string | undefined => UNIVERSE_TRACK[theme];

export const MUSIC_CATALOG: readonly CatalogItem[] = TRACKS.flatMap((t) => {
  const theme = (Object.keys(UNIVERSE_TRACK) as ThemeId[]).find((k) => UNIVERSE_TRACK[k] === t.id);
  const source: Source | undefined = theme ? { kind: 'universe', theme } : MUSIC_SOURCE[t.id];
  return source ? [{ kind: 'music' as const, id: t.id, name: t.name, rarity: t.rarity, blurb: `${t.mood[0]!.toUpperCase()}${t.mood.slice(1)}.`, source }] : [];
});

/** Musique offerte à tous (au moins une musique gratuite par joueur). */
export const DEFAULT_MUSIC = 'premier-etage';

/** Identifiant d'inventaire d'une musique achetée (préfixe : pas de collision avec les matières). */
export const musicInventoryId = (id: string): string => `musique-${id}`;

export const CATALOG: readonly CatalogItem[] = [...SKIN_CATALOG, ...THEME_CATALOG, ...MUSIC_CATALOG];

export function catalogItem(kind: CosmeticKind, id: string): CatalogItem | undefined {
  return CATALOG.find((i) => i.kind === kind && i.id === id);
}

/** Tri d'affichage : rareté croissante, puis ordre du catalogue. */
export function byRarity(items: readonly CatalogItem[]): CatalogItem[] {
  return items.map((item, i) => ({ item, i })).sort((a, b) => rarityRank(a.item.rarity) - rarityRank(b.item.rarity) || a.i - b.i).map((x) => x.item);
}

/** Objets obtenables sur cet appareil (tout sauf le premium, qui attend un droit serveur). */
export const LOCAL_SKINS: readonly AnySkinId[] = SKIN_CATALOG
  .filter((i) => i.source.kind !== 'pass' || i.source.track === 'free')
  .map((i) => i.id as AnySkinId);
export const LOCAL_THEMES: readonly ThemeId[] = THEME_CATALOG
  .filter((i) => i.source.kind !== 'pass' || i.source.track === 'free')
  .map((i) => i.id as ThemeId);
/** Univers achetables ou gagnés et rangés dans l'inventaire (pas les missions ni le défaut). */
export const INVENTORY_THEMES: readonly ThemeId[] = THEME_CATALOG
  .filter((i) => i.source.kind === 'shop' || (i.source.kind === 'pass' && i.source.track === 'free'))
  .map((i) => i.id as ThemeId);

/** D'où vient un objet, en une ligne courte (cartes de collection). */
export function sourceLabel(source: Source): string {
  switch (source.kind) {
    case 'default': return 'Offert';
    case 'mission': return 'Mission';
    case 'shop': return `Boutique · ${source.price} pièces`;
    case 'pass': return source.track === 'free' ? `Passe gratuit · niveau ${source.tier}` : `Passe premium · niveau ${source.tier}`;
    case 'universe': return `Avec l’univers ${THEME_CATALOG.find((t) => t.id === source.theme)?.name ?? source.theme}`;
  }
}

export const rarityName = (r: Rarity): string => RARITY_INFO[r].name;

/** Contrôle de cohérence (tests) : chaque identifiant dessinable a exactement une entrée. */
export function catalogCoverage(): { skins: boolean; themes: boolean } {
  const skins = new Set(SKIN_CATALOG.map((i) => i.id));
  const themes = new Set(THEME_CATALOG.map((i) => i.id));
  return {
    skins: skins.size === SKIN_CATALOG.length && ALL_SKIN_IDS.every((id) => skins.has(id)) && skins.size === ALL_SKIN_IDS.length,
    themes: themes.size === THEME_CATALOG.length && THEME_IDS.every((id) => themes.has(id)) && themes.size === THEME_IDS.length,
  };
}
