/**
 * Dessin d'un étage « jouet » en relief et de ses apparences (V2, F4 ; V6 : matières vivantes).
 * Partagé par le renderer du jeu, l'aperçu de collection et la carte : un seul code de dessin.
 *
 * Invariant : tout ce qui est dessiné pour un bloc de largeur `w` reste dans [0, w]
 * (les matières sont découpées par la forme arrondie du bloc ; le contour est intérieur).
 * Les apparences sont purement visuelles : elles ne changent ni la géométrie ni les règles.
 */
import { BLOCK_HEIGHT, RADIUS } from './dims';
import { faceGradient, faceTone, paintMaterial, STATIC_ENV, type MaterialEnv, type MaterialSkin } from './materials';
import type { Rarity } from './rarity';
import { css, darken, lighten, outlineFor, roundedRect, type Rgb } from './themes';

export { BLOCK_HEIGHT, RADIUS };

export type SkinId = 'gomme' | 'marbre' | 'bonbon' | 'verre' | 'strie' | 'ceramique';
export const SKIN_IDS: readonly SkinId[] = ['gomme', 'marbre', 'bonbon', 'verre', 'strie', 'ceramique'];
export const DEFAULT_SKIN: SkinId = 'gomme';

export function isSkinId(v: unknown): v is SkinId {
  return typeof v === 'string' && (SKIN_IDS as readonly string[]).includes(v);
}

/**
 * Apparences V3 (F8, exposées en F8b). `SKIN_IDS` / `SkinId` / `isSkinId` restent la liste V2
 * (récompenses d'objectifs). Toute apparence dessinable : `ALL_SKIN_IDS`, `AnySkinId`, `isAnySkinId`.
 */
export type SkinIdV3 = 'graphite' | 'nacre' | 'holographique' | 'pixel' | 'galaxie' | 'lave' | 'or' | 'cristal';
export const SKIN_IDS_V3: readonly SkinIdV3[] = ['graphite', 'nacre', 'holographique', 'pixel', 'galaxie', 'lave', 'or', 'cristal'];
/** V6 : cinq nouvelles matières (boutique et passe). */
export type SkinIdV6 = 'bois' | 'circuit' | 'neon' | 'aurore' | 'abysse';
export const SKIN_IDS_V6: readonly SkinIdV6[] = ['bois', 'circuit', 'neon', 'aurore', 'abysse'];
/** Toute apparence que `drawBlock` sait dessiner. */
export type DrawSkinId = SkinId | SkinIdV3 | SkinIdV6;
export const ALL_SKIN_IDS: readonly DrawSkinId[] = [...SKIN_IDS, ...SKIN_IDS_V3, ...SKIN_IDS_V6];
export function isDrawSkinId(v: unknown): v is DrawSkinId {
  return typeof v === 'string' && (ALL_SKIN_IDS as readonly string[]).includes(v);
}
/** Nom public de `DrawSkinId` : toute apparence que le moteur sait dessiner. */
export type AnySkinId = DrawSkinId;
export const isAnySkinId = isDrawSkinId;

/** Rareté de chaque matière (V6) : elle décrit la réalisation, jamais un avantage de jeu. */
export const SKIN_RARITY: Record<DrawSkinId, Rarity> = {
  gomme: 'commun', strie: 'commun', bonbon: 'commun', graphite: 'commun', bois: 'commun',
  marbre: 'rare', ceramique: 'rare', verre: 'rare', nacre: 'rare', pixel: 'rare',
  circuit: 'epique', holographique: 'epique', lave: 'epique', or: 'epique', neon: 'epique',
  galaxie: 'legendaire', cristal: 'legendaire', aurore: 'legendaire', abysse: 'legendaire',
};

/** Matières sombres « vitrine » : le haut est un verre, pas une face claire. */
const GLASSY = new Set<DrawSkinId>(['galaxie', 'aurore', 'abysse', 'neon']);

/** Rectangles dessinés pour un bloc en relief, en unités locales (x relatif au bord gauche). */
export interface ReliefParts {
  readonly face: { x: number; w: number };
  readonly top: { x: number; w: number; h: number };
  readonly lip: { x: number; w: number; h: number };
  readonly gloss: { x: number; w: number };
}

/**
 * Géométrie du relief d'un bloc de largeur `w` (unités). Toutes les parties restent dans
 * [0, w] : le relief décoratif n'élargit jamais la zone perçue comme valide (brief V2).
 */
export function reliefParts(w: number): ReliefParts {
  const inset = Math.min(3, w / 6);
  return {
    face: { x: 0, w },
    top: { x: inset, w: Math.max(0, w - inset * 2), h: Math.min(7, BLOCK_HEIGHT * 0.24) },
    lip: { x: 0, w, h: 4 },
    gloss: { x: Math.min(8, w * 0.12), w: Math.max(0, Math.min(w * 0.22, 44)) },
  };
}

/** Dégradé vertical de la face, en coordonnées locales 0..BLOCK_HEIGHT. */
export function createFaceGradient(ctx: CanvasRenderingContext2D, color: Rgb, skin: DrawSkinId): CanvasGradient {
  return faceGradient(ctx, color, skin as MaterialSkin);
}

export interface DrawBlockOptions {
  readonly skin: DrawSkinId;
  /** Ciel derrière le bloc : choisit un contour foncé ou clair (lisibilité). */
  readonly sky: Rgb;
  readonly alpha: number;
  /** Dégradé de face déjà créé pour (couleur, apparence) ; créé à la volée sinon. */
  readonly gradient?: CanvasGradient;
  /** Numéro d'étage : varie le motif d'un étage à l'autre. */
  readonly variant: number;
  /** V6 : position dans le monde, temps et qualité (matières vivantes). Absent : image fixe. */
  readonly env?: MaterialEnv;
}

/**
 * Couleurs qui forment le bord visible d'un bloc : teinte moyenne de la face et contour.
 * Utilisée par `drawBlock` et par les tests de lisibilité (un seul calcul).
 */
export function edgeColors(color: Rgb, skin: DrawSkinId, sky: Rgb): { face: Rgb; outline: Rgb } {
  const face = faceTone(color, skin as MaterialSkin, sky);
  // V2 : contour calculé sur la couleur d'étage (inchangé) ; V3+ : sur la teinte de la matière.
  const outline = outlineFor(skin === 'marbre' ? darken(color, 0.25) : isSkinId(skin) ? color : face, sky);
  return { face, outline };
}

/** Bloc « jouet » en relief, strictement contenu dans [x, x + w]. */
export function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: Rgb, o: DrawBlockOptions): void {
  if (w <= 0) return;
  const p = reliefParts(w);
  const H = BLOCK_HEIGHT;
  const glassy = GLASSY.has(o.skin);
  const env: MaterialEnv = o.env ?? { ...STATIC_ENV, wx: x, wy: y, ox: x, floor: o.variant };
  ctx.save();
  ctx.globalAlpha = o.alpha * (o.skin === 'verre' ? 0.72 : 1);
  ctx.translate(x, y);
  roundedRect(ctx, 0, 0, w, H, RADIUS);
  ctx.fillStyle = o.gradient ?? createFaceGradient(ctx, color, o.skin);
  ctx.fill();
  ctx.save();
  ctx.clip(); // tout ce qui suit est découpé par la forme du bloc
  paintMaterial(ctx, w, color, o.skin as MaterialSkin, env);
  const tone = glassy ? faceTone(color, o.skin as MaterialSkin, o.sky) : color;
  // Lèvre sombre en bas : volume et séparation entre étages.
  ctx.fillStyle = css(darken(tone, o.skin === 'marbre' ? 0.05 : glassy ? 0.5 : 0.28), glassy ? 0.75 : 0.9);
  ctx.fillRect(p.lip.x, H - p.lip.h, p.lip.w, p.lip.h);
  // Face supérieure : claire et en retrait des bords (verre fin pour les matières « vitrine »).
  ctx.fillStyle = css(lighten(tone, o.skin === 'marbre' ? 0.75 : glassy ? 0.4 : 0.35), glassy ? 0.42 : 0.95);
  roundedRect(ctx, p.top.x, 1.5, p.top.w, p.top.h, p.top.h / 2);
  ctx.fill();
  if (!glassy && w > 8) {
    // Arête lumineuse : le bord supérieur accroche la lumière.
    ctx.fillStyle = css(lighten(tone, 0.7), 0.55);
    ctx.fillRect(p.top.x + 2, 1.6, Math.max(0, p.top.w - 4), 0.9);
  }
  drawGloss(ctx, p, o.skin);
  ctx.restore();
  ctx.globalAlpha = o.alpha;
  // Contour intérieur : tracé dans [0, w] (inset d'une demi-épaisseur), jamais au-delà.
  const lw = 1.5;
  if (w > lw * 2) {
    ctx.strokeStyle = css(edgeColors(color, o.skin, o.sky).outline, 0.85);
    ctx.lineWidth = lw;
    roundedRect(ctx, lw / 2, lw / 2, w - lw, H - lw, RADIUS - lw / 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Reflet propre à la matière. */
function drawGloss(ctx: CanvasRenderingContext2D, p: ReliefParts, skin: DrawSkinId): void {
  const H = BLOCK_HEIGHT;
  if (p.gloss.w <= 4) return;
  if (skin === 'ceramique') {
    // Grand reflet ovale très brillant.
    ctx.fillStyle = css([255, 255, 255], 0.6);
    ctx.beginPath();
    ctx.ellipse(p.gloss.x + p.gloss.w * 0.5, H * 0.42, p.gloss.w * 0.5, 3.2, -0.08, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (GLASSY.has(skin)) {
    // Vitre : un trait de reflet fin et net, la profondeur reste visible.
    ctx.fillStyle = css([255, 255, 255], 0.32);
    roundedRect(ctx, p.gloss.x, H * 0.36, p.gloss.w, 1.6, 0.8);
    ctx.fill();
    ctx.fillStyle = css([255, 255, 255], 0.18);
    roundedRect(ctx, p.gloss.x + p.gloss.w + 4, H * 0.36, Math.min(8, p.gloss.w * 0.3), 1.6, 0.8);
    ctx.fill();
    return;
  }
  if (skin === 'verre' || skin === 'pixel') return; // reflet diagonal / rendu 8-bit sans reflet
  ctx.fillStyle = css([255, 255, 255], skin === 'marbre' ? 0.5 : skin === 'bois' ? 0.22 : 0.35);
  roundedRect(ctx, p.gloss.x, H * 0.38, p.gloss.w, 3.5, 1.75);
  ctx.fill();
}
