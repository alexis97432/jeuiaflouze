/**
 * Dessin d'un étage « jouet » en relief et de ses apparences (V2, F4).
 * Partagé par le renderer du jeu et par l'aperçu de collection : un seul code de dessin.
 *
 * Invariant : tout ce qui est dessiné pour un bloc de largeur `w` reste dans [0, w]
 * (les matières sont découpées par la forme arrondie du bloc ; le contour est intérieur).
 * Les apparences sont purement visuelles : elles ne changent ni la géométrie ni les règles.
 */
import { css, darken, lighten, mix, outlineFor, roundedRect, type Rgb } from './themes';

/** Hauteur visuelle d'un étage, unités logiques (purement graphique : les règles n'ont pas de hauteur). */
export const BLOCK_HEIGHT = 30;
export const RADIUS = 7;

export type SkinId = 'gomme' | 'marbre' | 'bonbon' | 'verre' | 'strie' | 'ceramique';
export const SKIN_IDS: readonly SkinId[] = ['gomme', 'marbre', 'bonbon', 'verre', 'strie', 'ceramique'];
export const DEFAULT_SKIN: SkinId = 'gomme';

export function isSkinId(v: unknown): v is SkinId {
  return typeof v === 'string' && (SKIN_IDS as readonly string[]).includes(v);
}

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
export function createFaceGradient(ctx: CanvasRenderingContext2D, color: Rgb, skin: SkinId): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, 0, BLOCK_HEIGHT);
  if (skin === 'ceramique') {
    // Glaçure : couleur plus profonde et plus saturée en bas.
    g.addColorStop(0, css(lighten(color, 0.05)));
    g.addColorStop(1, css(darken(color, 0.32)));
  } else if (skin === 'marbre') {
    // Pierre claire teintée par la couleur de l'étage.
    g.addColorStop(0, css(lighten(color, 0.62)));
    g.addColorStop(1, css(lighten(color, 0.38)));
  } else {
    g.addColorStop(0, css(lighten(color, 0.12)));
    g.addColorStop(0.55, css(color));
    g.addColorStop(1, css(darken(color, 0.14)));
  }
  return g;
}

/** Tirage visuel stable par étage (veines du marbre…), indépendant du PRNG de partie. */
function vary(n: number, k: number): number {
  let x = (Math.imul(n + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b)) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d) >>> 0;
  x ^= x >>> 12;
  return (x >>> 0) / 4294967296;
}

export interface DrawBlockOptions {
  readonly skin: SkinId;
  /** Ciel derrière le bloc : choisit un contour foncé ou clair (lisibilité). */
  readonly sky: Rgb;
  readonly alpha: number;
  /** Dégradé de face déjà créé pour (couleur, apparence) ; créé à la volée sinon. */
  readonly gradient?: CanvasGradient;
  /** Numéro d'étage : varie le motif (veines) d'un étage à l'autre. */
  readonly variant: number;
}

/**
 * Couleurs qui forment le bord visible d'un bloc : teinte moyenne de la face et contour.
 * Utilisée par `drawBlock` et par les tests de lisibilité (un seul calcul).
 */
export function edgeColors(color: Rgb, skin: SkinId, sky: Rgb): { face: Rgb; outline: Rgb } {
  // « Verre » est dessiné à 72 % d'opacité : le ciel transparaît dans la face.
  const face = skin === 'marbre' ? lighten(color, 0.5)
    : skin === 'ceramique' ? darken(color, 0.15)
      : skin === 'verre' ? mix(color, sky, 0.28)
        : color;
  const outline = outlineFor(skin === 'marbre' ? darken(color, 0.25) : color, sky);
  return { face, outline };
}

/** Bloc « jouet » en relief, strictement contenu dans [x, x + w]. */
export function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: Rgb, o: DrawBlockOptions): void {
  if (w <= 0) return;
  const p = reliefParts(w);
  const H = BLOCK_HEIGHT;
  ctx.save();
  ctx.globalAlpha = o.alpha * (o.skin === 'verre' ? 0.72 : 1);
  ctx.translate(x, y);
  roundedRect(ctx, 0, 0, w, H, RADIUS);
  ctx.fillStyle = o.gradient ?? createFaceGradient(ctx, color, o.skin);
  ctx.fill();
  ctx.save();
  ctx.clip(); // tout ce qui suit est découpé par la forme du bloc
  drawMaterial(ctx, w, color, o.skin, o.variant);
  // Lèvre sombre en bas : volume et séparation entre étages.
  ctx.fillStyle = css(darken(color, o.skin === 'marbre' ? 0.05 : 0.28), 0.9);
  ctx.fillRect(p.lip.x, H - p.lip.h, p.lip.w, p.lip.h);
  // Face supérieure claire, légèrement en retrait des bords.
  ctx.fillStyle = css(lighten(color, o.skin === 'marbre' ? 0.75 : 0.35), 0.95);
  roundedRect(ctx, p.top.x, 1.5, p.top.w, p.top.h, p.top.h / 2);
  ctx.fill();
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

/** Motif propre à l'apparence, dessiné sous la face supérieure (déjà découpé par le bloc). */
function drawMaterial(ctx: CanvasRenderingContext2D, w: number, color: Rgb, skin: SkinId, n: number): void {
  const H = BLOCK_HEIGHT;
  switch (skin) {
    case 'gomme':
      return;
    case 'bonbon': {
      // Rayures diagonales claires, façon sucre d'orge.
      ctx.fillStyle = css([255, 255, 255], 0.42);
      const step = 14;
      const offset = vary(n, 1) * step;
      for (let sx = -H + offset; sx < w + H; sx += step) {
        ctx.beginPath();
        ctx.moveTo(sx, H);
        ctx.lineTo(sx + 6, H);
        ctx.lineTo(sx + 6 + H, 0);
        ctx.lineTo(sx + H, 0);
        ctx.closePath();
        ctx.fill();
      }
      return;
    }
    case 'strie': {
      // Rayures horizontales fines et régulières.
      ctx.fillStyle = css(darken(color, 0.3), 0.8);
      for (let sy = 9; sy < H - 4; sy += 4) ctx.fillRect(0, sy, w, 1.8);
      return;
    }
    case 'marbre': {
      // Veines sinueuses de la couleur de l'étage, différentes d'un étage à l'autre.
      ctx.strokeStyle = css(darken(color, 0.12), 0.75);
      ctx.lineCap = 'round';
      const veins = 2 + Math.floor(vary(n, 2) * 2);
      for (let k = 0; k < veins; k++) {
        const x0 = vary(n, 10 + k) * w;
        const dx = (vary(n, 20 + k) - 0.5) * 60;
        ctx.lineWidth = 0.8 + vary(n, 30 + k) * 1.4;
        ctx.beginPath();
        ctx.moveTo(x0, -2);
        ctx.bezierCurveTo(x0 + dx, H * 0.35, x0 - dx * 0.6, H * 0.7, x0 + dx * 0.4, H + 2);
        ctx.stroke();
      }
      return;
    }
    case 'verre': {
      // Translucide : un reflet diagonal net et un liseré intérieur clair.
      ctx.fillStyle = css([255, 255, 255], 0.35);
      ctx.beginPath();
      const sx = w * (0.15 + vary(n, 3) * 0.2);
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx + 14, 0);
      ctx.lineTo(sx + 2, H);
      ctx.lineTo(sx - 12, H);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = css([255, 255, 255], 0.55);
      ctx.lineWidth = 2;
      roundedRect(ctx, 3, 3, Math.max(0, w - 6), H - 6, RADIUS - 3);
      ctx.stroke();
      return;
    }
    case 'ceramique': {
      // Glaçure : petits mouchetis sombres et clairs.
      for (let k = 0; k < Math.min(40, Math.floor(w / 6)); k++) {
        const light = k % 3 === 0;
        ctx.fillStyle = light ? css([255, 255, 255], 0.35) : css(darken(color, 0.45), 0.35);
        ctx.beginPath();
        ctx.arc(vary(n, 100 + k) * w, 8 + vary(n, 200 + k) * (H - 12), 0.6 + vary(n, 300 + k) * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
  }
}

/** Reflet propre à la matière. */
function drawGloss(ctx: CanvasRenderingContext2D, p: ReliefParts, skin: SkinId): void {
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
  if (skin === 'verre') return; // déjà un reflet diagonal
  ctx.fillStyle = css([255, 255, 255], skin === 'marbre' ? 0.5 : 0.35);
  roundedRect(ctx, p.gloss.x, H * 0.38, p.gloss.w, 3.5, 1.75);
  ctx.fill();
}
