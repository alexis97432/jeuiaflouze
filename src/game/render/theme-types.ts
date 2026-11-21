/** Types des univers (V2, F3 ; V6 : six paliers, scènes en plusieurs plans, rareté). */
import type { Rgb } from './color';
import type { Rarity } from './rarity';
import type { Scene } from './scene';

/**
 * V7 : quatre univers de plus (Désert, Montagne, Fête foraine, Royaume des nuées).
 * V8 : collection sombre (Forêt de brume, Cathédrale oubliée, Cœur d'obsidienne) et Noël (Veillée).
 */
export type ThemeId =
  | 'confiserie' | 'orbital' | 'jardin' | 'recif' | 'cite' | 'desert' | 'montagne' | 'foire' | 'nuees'
  | 'brume' | 'cathedrale' | 'volcan' | 'noel';

/** Étages à partir desquels chaque palier commence (V6 : premiers changements dès 5 étages). */
export const TIER_FLOORS = [0, 5, 10, 20, 35, 50] as const;
export type TierIndex = 0 | 1 | 2 | 3 | 4 | 5;

export interface DecorItem {
  /** Position x en unités logiques (0..360). */
  readonly x: number;
  /** Trois tirages visuels stables dans [0, 1[. */
  readonly r1: number;
  readonly r2: number;
  readonly r3: number;
}

/** Dessine un élément de décor centré en (0, 0) ; `t` en secondes, `motion` = animations permises. */
export type DecorPainter = (ctx: CanvasRenderingContext2D, item: DecorItem, t: number, motion: boolean) => void;

export interface Tier {
  readonly name: string;
  readonly skyTop: Rgb;
  readonly skyBottom: Rgb;
  /** Couleur du score et des libellés dessinés sur ce ciel. */
  readonly ink: Rgb;
  readonly decor: DecorPainter;
}

export interface ThemeAudio {
  readonly wave: OscillatorType;
  /** Fréquence de la première note de série (Hz). */
  readonly root: number;
  /** Demi-tons de la gamme montée par la série de parfaits. */
  readonly scale: readonly number[];
}

export type Tiers = readonly [Tier, Tier, Tier, Tier, Tier, Tier];

export interface Theme {
  readonly id: ThemeId;
  readonly name: string;
  readonly rarity: Rarity;
  readonly tiers: Tiers;
  /** Couleurs des étages, en cycle. Toujours plus contrastées que le décor. */
  readonly blocks: readonly Rgb[];
  /** Couleurs des étincelles de parfait. */
  readonly sparks: readonly Rgb[];
  /** Sol sous la tour (repli et aperçus simples). */
  readonly ground: { readonly top: Rgb; readonly body: Rgb };
  readonly audio: ThemeAudio;
  /** V6 : scène en plusieurs plans (astres, silhouettes, premier plan, sol). */
  readonly scene: Scene;
}
