/**
 * Univers visuels (V2, F3 ; V6 : six paliers et scènes en plusieurs plans). Données et fonctions
 * de dessin purement décoratives : aucune n'influence les règles, le rejeu ou le score.
 *
 * Un univers définit, pour chacun de ses 6 paliers (0, 5, 10, 20, 35, 50 étages) : les couleurs
 * du ciel, la couleur du texte HUD, le nom du palier et un peintre de décor ; et une scène
 * (astres, silhouettes, éléments d'altitude, premier plan, sol). Le ciel est interpolé en
 * continu entre paliers : une partie courte voit déjà le décor bouger.
 */
import { contrast, CREAM, darken, INK, lighten, mix, type Rgb } from './color';
import type { Rarity } from './rarity';
import { TIER_FLOORS, type Theme, type ThemeId, type TierIndex } from './theme-types';
import { cite } from './worlds/cite';
import { confiserie } from './worlds/confiserie';
import { jardin } from './worlds/jardin';
import { orbital } from './worlds/orbital';
import { recif } from './worlds/recif';

export { contrast, css, darken, hex, lighten, luminance, mix, roundedRect, type Rgb } from './color';
export {
  TIER_FLOORS,
  type DecorItem,
  type DecorPainter,
  type Theme,
  type ThemeAudio,
  type ThemeId,
  type Tier,
  type TierIndex,
} from './theme-types';

export const THEME_IDS: readonly ThemeId[] = ['confiserie', 'orbital', 'jardin', 'recif', 'cite'];
export const DEFAULT_THEME: ThemeId = 'confiserie';

const LAST = (TIER_FLOORS.length - 1) as TierIndex;

/** Index du palier atteint pour un nombre d'étages posés. */
export function tierIndex(floors: number): TierIndex {
  for (let i = LAST; i > 0; i--) if (floors >= TIER_FLOORS[i]!) return i as TierIndex;
  return 0;
}

/** Palier fractionnaire (0 à 5) : position continue entre deux paliers. */
export function stageAt(floors: number): number {
  const h = Math.max(0, floors);
  const i = tierIndex(h);
  if (i === LAST) return LAST;
  return i + (h - TIER_FLOORS[i]) / (TIER_FLOORS[i + 1]! - TIER_FLOORS[i]);
}

/**
 * Ciel à une hauteur fractionnaire (en étages) : interpolation continue du palier
 * courant vers le suivant, constante au-delà du dernier.
 */
export function skyAt(theme: Theme, floors: number): { top: Rgb; bottom: Rgb; ink: Rgb } {
  const h = Math.max(0, floors);
  const i = tierIndex(h);
  const cur = theme.tiers[i];
  if (i === LAST) return { top: cur.skyTop, bottom: cur.skyBottom, ink: cur.ink };
  const next = theme.tiers[(i + 1) as TierIndex];
  const t = (h - TIER_FLOORS[i]) / (TIER_FLOORS[i + 1]! - TIER_FLOORS[i]);
  const top = mix(cur.skyTop, next.skyTop, t);
  const bottom = mix(cur.skyBottom, next.skyBottom, t);
  return { top, bottom, ink: bestInk(top, bottom) };
}

/** Position verticale (fraction de l'écran) où le score et les libellés sont dessinés. */
export const HUD_SKY_POSITION = 0.12;

const INK_DARK: Rgb = INK;
const INK_LIGHT: Rgb = CREAM;

/**
 * Encre du HUD : foncée ou crème, celle qui contraste le plus avec le ciel à l'endroit
 * du score. Jamais de gris interpolé entre les deux.
 */
export function bestInk(top: Rgb, bottom: Rgb): Rgb {
  const sky = mix(top, bottom, HUD_SKY_POSITION);
  return contrast(INK_DARK, sky) >= contrast(INK_LIGHT, sky) ? INK_DARK : INK_LIGHT;
}

/** Liseré du texte HUD : la couleur opposée à l'encre (crème autour du foncé et inversement). */
export function haloFor(ink: Rgb): Rgb {
  return ink === INK_DARK ? INK_LIGHT : INK_DARK;
}

/**
 * Contour d'un bloc : sa couleur foncée sur ciel clair, éclaircie sur ciel sombre, au choix
 * du meilleur contraste avec le ciel derrière le bloc. Le bord reste lisible partout.
 */
export function outlineFor(c: Rgb, sky: Rgb): Rgb {
  const dark = darken(c, 0.7);
  const light = lighten(c, 0.72);
  return contrast(dark, sky) >= contrast(light, sky) ? dark : light;
}

const THEMES: Record<ThemeId, Theme> = { confiserie, orbital, jardin, recif, cite };

/** Rareté de chaque univers (V6) : richesse de la scène, jamais un avantage de jeu. */
export const THEME_RARITY: Record<ThemeId, Rarity> = {
  confiserie: confiserie.rarity, jardin: jardin.rarity, orbital: orbital.rarity, recif: recif.rarity, cite: cite.rarity,
};

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && (THEME_IDS as readonly string[]).includes(v);
}

/** Univers demandé, ou l'univers par défaut si l'identifiant est inconnu. */
export function getTheme(id: unknown): Theme {
  return THEMES[isThemeId(id) ? id : DEFAULT_THEME];
}

/**
 * Variante « la tour voyage » (avis FLK V2, à tester) : une même partie traverse Confiserie
 * (paliers 0–2), Jardin (palier 3) et Orbital (paliers 4–5). Composition des univers existants.
 */
export const VOYAGE: Theme = {
  ...confiserie,
  name: 'Voyage',
  tiers: [confiserie.tiers[0], confiserie.tiers[1], confiserie.tiers[2], jardin.tiers[3], orbital.tiers[4], orbital.tiers[5]],
};
