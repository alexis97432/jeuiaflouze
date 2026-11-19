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
/** V7 : une matière de plus par rareté (Papier, Mosaïque, Vitrail, Phénix). */
export type SkinIdV7 = 'papier' | 'mosaique' | 'vitrail' | 'phenix';
export const SKIN_IDS_V7: readonly SkinIdV7[] = ['papier', 'mosaique', 'vitrail', 'phenix'];
/** Toute apparence que `drawBlock` sait dessiner. */
export type DrawSkinId = SkinId | SkinIdV3 | SkinIdV6 | SkinIdV7;
export const ALL_SKIN_IDS: readonly DrawSkinId[] = [...SKIN_IDS, ...SKIN_IDS_V3, ...SKIN_IDS_V6, ...SKIN_IDS_V7];
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
  papier: 'commun', mosaique: 'rare', vitrail: 'epique', phenix: 'legendaire',
};

/** Matières sombres « vitrine » : le haut est un verre, pas une face claire. */
const GLASSY = new Set<DrawSkinId>(['galaxie', 'aurore', 'abysse', 'neon', 'phenix']);

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
  // V8 : contour calculé sur la teinte réelle de la face (la couleur vient de la matière).
  const outline = outlineFor(face, sky);
  return { face, outline };
}

/**
 * V8 : épaisseur visible de la face supérieure (unités). La lumière vient d'en haut à gauche :
 * dessus éclairé, biseau gauche clair, biseau droit et bas dans l'ombre.
 */
export const TOP_FACE = 6;

/**
 * Bloc en relief, strictement contenu dans [x, x + w] (V8 : relief de matière, plus de contour
 * épais de dessin animé ; un liseré fin garde la limite lisible sur tous les ciels).
 */
export function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: Rgb, o: DrawBlockOptions): void {
  if (w <= 0) return;
  const p = reliefParts(w);
  const H = BLOCK_HEIGHT;
  const glassy = GLASSY.has(o.skin);
  const env: MaterialEnv = o.env ?? { ...STATIC_ENV, wx: x, wy: y, ox: x, floor: o.variant };
  const r = Math.min(RADIUS, w / 2, H / 2);
  ctx.save();
  ctx.globalAlpha = o.alpha * (o.skin === 'verre' ? 0.72 : 1);
  ctx.translate(x, y);
  roundedRect(ctx, 0, 0, w, H, r);
  ctx.fillStyle = o.gradient ?? createFaceGradient(ctx, color, o.skin);
  ctx.fill();
  ctx.save();
  ctx.clip(); // tout ce qui suit est découpé par la forme du bloc
  paintMaterial(ctx, w, color, o.skin as MaterialSkin, env);
  const tone = glassy ? faceTone(color, o.skin as MaterialSkin, o.sky) : color;
  const T = Math.min(TOP_FACE, H * 0.24);
  // 1. Dessus : bande éclairée qui donne l'épaisseur, pli d'ombre à la jonction avec la face.
  const top = ctx.createLinearGradient(0, 0, 0, T);
  top.addColorStop(0, css(lighten(tone, glassy ? 0.35 : 0.42), glassy ? 0.4 : 0.62));
  top.addColorStop(1, css(lighten(tone, glassy ? 0.12 : 0.16), glassy ? 0.22 : 0.4));
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, T);
  ctx.fillStyle = css(darken(tone, 0.45), glassy ? 0.35 : 0.42);
  ctx.fillRect(0, T, w, 0.9);
  if (w > 6) {
    // Arête vive du dessus : elle accroche la lumière.
    ctx.fillStyle = css(lighten(tone, 0.78), glassy ? 0.5 : 0.7);
    ctx.fillRect(1.5, 0.4, w - 3, 0.9);
  }
  // 2. Biseaux : gauche éclairé, droite dans l'ombre (lumière haute à gauche).
  if (w > 8) {
    const bl = Math.min(3, w * 0.1);
    const lg = ctx.createLinearGradient(0, 0, bl, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0.22)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, T, bl, H - T);
    const br = Math.min(6, w * 0.16);
    const rg = ctx.createLinearGradient(w - br, 0, w, 0);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = rg;
    ctx.fillRect(w - br, 0, br, H);
  }
  // 3. Bas de la face : occlusion douce, puis lèvre sombre qui sépare les étages.
  const ao = ctx.createLinearGradient(0, H - 9, 0, H);
  ao.addColorStop(0, 'rgba(0,0,0,0)');
  ao.addColorStop(1, `rgba(0,0,0,${glassy ? 0.4 : 0.3})`);
  ctx.fillStyle = ao;
  ctx.fillRect(0, H - 9, w, 9);
  ctx.fillStyle = css(darken(tone, glassy ? 0.6 : 0.5), 0.85);
  ctx.fillRect(p.lip.x, H - 1.6, p.lip.w, 1.6);
  drawGloss(ctx, p, o.skin);
  ctx.restore();
  ctx.globalAlpha = o.alpha;
  // Liseré intérieur fin : tracé dans [0, w], jamais au-delà ; clair sur ciel sombre, sombre sinon.
  const lw = 1;
  if (w > lw * 2) {
    ctx.strokeStyle = css(edgeColors(color, o.skin, o.sky).outline, 0.75);
    ctx.lineWidth = lw;
    roundedRect(ctx, lw / 2, lw / 2, w - lw, H - lw, Math.max(0, r - lw / 2));
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
    ctx.fillStyle = css([255, 255, 255], 0.42);
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
  // V8 : reflet de matière discret (le relief vient désormais de la lumière, pas d'un trait blanc).
  ctx.fillStyle = css([255, 255, 255], skin === 'marbre' ? 0.3 : skin === 'bois' ? 0.12 : 0.18);
  roundedRect(ctx, p.gloss.x, H * 0.38, p.gloss.w, 3.5, 1.75);
  ctx.fill();
}
