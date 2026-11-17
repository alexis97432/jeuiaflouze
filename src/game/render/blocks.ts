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

/**
 * Apparences V3 (F8, exposées en F8b). `SKIN_IDS` / `SkinId` / `isSkinId` restent la liste V2
 * (récompenses d'objectifs) : le shell type ses libellés sur `SkinId`, l'élargir casserait sa
 * compilation. Toute apparence dessinable : `ALL_SKIN_IDS`, `AnySkinId`, `isAnySkinId`, acceptés
 * par `Appearance`, `resolveAppearance`, `mountGame` et `renderAppearancePreview`.
 */
export type SkinIdV3 = 'graphite' | 'nacre' | 'holographique' | 'pixel' | 'galaxie' | 'lave' | 'or' | 'cristal';
export const SKIN_IDS_V3: readonly SkinIdV3[] = ['graphite', 'nacre', 'holographique', 'pixel', 'galaxie', 'lave', 'or', 'cristal'];
/** Toute apparence que `drawBlock` sait dessiner. */
export type DrawSkinId = SkinId | SkinIdV3;
export const ALL_SKIN_IDS: readonly DrawSkinId[] = [...SKIN_IDS, ...SKIN_IDS_V3];
export function isDrawSkinId(v: unknown): v is DrawSkinId {
  return typeof v === 'string' && (ALL_SKIN_IDS as readonly string[]).includes(v);
}
/** Nom public de `DrawSkinId` : toute apparence que le moteur sait dessiner. */
export type AnySkinId = DrawSkinId;
export const isAnySkinId = isDrawSkinId;

/** Teintes fixes des matières V3, mélangées à la couleur de l'étage. */
const GRAPHITE: Rgb = [58, 60, 70];
const GALAXY: Rgb = [22, 18, 58];
const ROCK: Rgb = [52, 30, 24];
const GOLD: Rgb = [226, 178, 64];
const HOLO: readonly Rgb[] = [[255, 128, 206], [255, 214, 120], [130, 240, 170], [120, 196, 255], [196, 140, 255]];

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
  const g = ctx.createLinearGradient(0, 0, 0, BLOCK_HEIGHT);
  if (skin === 'ceramique') {
    // Glaçure : couleur plus profonde et plus saturée en bas.
    g.addColorStop(0, css(lighten(color, 0.05)));
    g.addColorStop(1, css(darken(color, 0.32)));
  } else if (skin === 'marbre') {
    // Pierre claire teintée par la couleur de l'étage.
    g.addColorStop(0, css(lighten(color, 0.62)));
    g.addColorStop(1, css(lighten(color, 0.38)));
  } else if (skin === 'graphite') {
    const c = mix(color, GRAPHITE, 0.78);
    g.addColorStop(0, css(lighten(c, 0.14)));
    g.addColorStop(1, css(darken(c, 0.22)));
  } else if (skin === 'nacre') {
    const c = lighten(color, 0.55);
    g.addColorStop(0, css(mix(c, [255, 222, 238], 0.45)));
    g.addColorStop(0.5, css(mix(c, [222, 236, 255], 0.45)));
    g.addColorStop(1, css(mix(c, [236, 255, 240], 0.35)));
  } else if (skin === 'holographique') {
    const c = lighten(color, 0.3);
    HOLO.forEach((h, i) => g.addColorStop(i / (HOLO.length - 1), css(mix(c, h, 0.55))));
  } else if (skin === 'galaxie') {
    const c = mix(color, GALAXY, 0.72);
    g.addColorStop(0, css(lighten(c, 0.12)));
    g.addColorStop(1, css(darken(c, 0.3)));
  } else if (skin === 'lave') {
    const c = mix(color, ROCK, 0.7);
    g.addColorStop(0, css(lighten(c, 0.08)));
    g.addColorStop(1, css(darken(c, 0.25)));
  } else if (skin === 'or') {
    const c = mix(color, GOLD, 0.78);
    g.addColorStop(0, css(lighten(c, 0.35)));
    g.addColorStop(0.45, css(c));
    g.addColorStop(0.6, css(lighten(c, 0.25)));
    g.addColorStop(1, css(darken(c, 0.28)));
  } else if (skin === 'cristal') {
    const c = lighten(color, 0.32);
    g.addColorStop(0, css(lighten(c, 0.2)));
    g.addColorStop(1, css(darken(c, 0.1)));
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
  readonly skin: DrawSkinId;
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
export function edgeColors(color: Rgb, skin: DrawSkinId, sky: Rgb): { face: Rgb; outline: Rgb } {
  const face = faceTone(color, skin, sky);
  // V2 : contour calculé sur la couleur d'étage (inchangé) ; V3 : sur la teinte de la matière.
  const outline = outlineFor(skin === 'marbre' ? darken(color, 0.25) : isSkinId(skin) ? color : face, sky);
  return { face, outline };
}

/** Teinte moyenne de la face (avant contour). */
function faceTone(color: Rgb, skin: DrawSkinId, sky: Rgb): Rgb {
  switch (skin) {
    case 'marbre': return lighten(color, 0.5);
    case 'ceramique': return darken(color, 0.15);
    // « Verre » est dessiné à 72 % d'opacité : le ciel transparaît dans la face.
    case 'verre': return mix(color, sky, 0.28);
    case 'graphite': return mix(color, GRAPHITE, 0.78);
    case 'nacre': return lighten(color, 0.55);
    case 'holographique': return lighten(color, 0.3);
    case 'galaxie': return mix(color, GALAXY, 0.72);
    case 'lave': return mix(color, ROCK, 0.7);
    case 'or': return mix(color, GOLD, 0.78);
    case 'cristal': return lighten(color, 0.32);
    default: return color;
  }
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
function drawMaterial(ctx: CanvasRenderingContext2D, w: number, color: Rgb, skin: DrawSkinId, n: number): void {
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
    case 'graphite': {
      // Liseré métallique clair sous la face supérieure, grain fin.
      ctx.fillStyle = css([210, 214, 226], 0.55);
      ctx.fillRect(0, 9, w, 1.2);
      ctx.fillStyle = css([255, 255, 255], 0.08);
      for (let sy = 12; sy < H - 5; sy += 3) ctx.fillRect(0, sy, w, 0.8);
      return;
    }
    case 'nacre': {
      // Irisations douces, statiques : deux voiles ondulés rose et bleu.
      const tints: Rgb[] = [[255, 190, 222], [180, 212, 255]];
      tints.forEach((t, k) => {
        ctx.fillStyle = css(t, 0.35);
        ctx.beginPath();
        const y0 = 12 + k * 7 + vary(n, 40 + k) * 3;
        ctx.moveTo(0, y0);
        for (let x = 0; x <= w + 12; x += 12) ctx.quadraticCurveTo(x + 6, y0 - 4, x + 12, y0);
        ctx.lineTo(w + 12, y0 + 4);
        ctx.lineTo(0, y0 + 4);
        ctx.closePath();
        ctx.fill();
      });
      return;
    }
    case 'holographique': {
      // Bandes arc-en-ciel diagonales ; leur phase varie d'un étage à l'autre (image fixe).
      const step = 10;
      const offset = vary(n, 4) * step * HOLO.length;
      let k = Math.floor(vary(n, 5) * HOLO.length);
      for (let sx = -H - step * HOLO.length + offset; sx < w + H; sx += step, k++) {
        ctx.fillStyle = css(HOLO[k % HOLO.length]!, 0.38);
        ctx.beginPath();
        ctx.moveTo(sx, H);
        ctx.lineTo(sx + step, H);
        ctx.lineTo(sx + step + H * 0.7, 0);
        ctx.lineTo(sx + H * 0.7, 0);
        ctx.closePath();
        ctx.fill();
      }
      return;
    }
    case 'pixel': {
      // Damier 8-bit : carrés de 5 unités, alternance claire / sombre.
      const size = 5;
      for (let sy = 0, row = 0; sy < H; sy += size, row++) {
        for (let sx = 0, col = 0; sx < w; sx += size, col++) {
          if ((row + col) % 2 === 0) continue;
          ctx.fillStyle = (row + col + n) % 4 === 1 ? css(lighten(color, 0.3), 0.55) : css(darken(color, 0.22), 0.45);
          ctx.fillRect(sx, sy, size, size);
        }
      }
      return;
    }
    case 'galaxie': {
      // Étoiles : points blancs et quelques points teintés.
      for (let k = 0; k < Math.min(36, Math.floor(w / 5)); k++) {
        const big = vary(n, 500 + k) > 0.85;
        ctx.fillStyle = k % 5 === 0 ? css(lighten(color, 0.5), 0.9) : css([255, 255, 255], big ? 0.95 : 0.7);
        ctx.beginPath();
        ctx.arc(vary(n, 600 + k) * w, 7 + vary(n, 700 + k) * (H - 10), big ? 1.3 : 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    case 'lave': {
      // Craquelures lumineuses orangées.
      ctx.strokeStyle = css([255, 150, 50], 0.9);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const cracks = 2 + Math.floor(w / 70);
      for (let k = 0; k < cracks; k++) {
        let x = vary(n, 800 + k) * w;
        let y = 6;
        ctx.lineWidth = 1 + vary(n, 850 + k) * 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let seg = 0; seg < 4; seg++) {
          x += (vary(n, 900 + k * 10 + seg) - 0.5) * 18;
          y += (H - 6) / 4;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      return;
    }
    case 'or': {
      // Métal brossé : fines lignes claires horizontales.
      ctx.fillStyle = css([255, 248, 214], 0.28);
      for (let sy = 10; sy < H - 4; sy += 2.5) ctx.fillRect(0, sy, w, 0.6);
      return;
    }
    case 'cristal': {
      // Facettes : triangles alternés clairs.
      const step = 18;
      const offset = vary(n, 6) * step;
      for (let sx = -step + offset, k = 0; sx < w + step; sx += step, k++) {
        ctx.fillStyle = css([255, 255, 255], k % 2 === 0 ? 0.32 : 0.14);
        ctx.beginPath();
        ctx.moveTo(sx, H);
        ctx.lineTo(sx + step / 2, 6);
        ctx.lineTo(sx + step, H);
        ctx.closePath();
        ctx.fill();
      }
      return;
    }
  }
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
  if (skin === 'verre' || skin === 'pixel') return; // reflet diagonal / rendu 8-bit sans reflet
  ctx.fillStyle = css([255, 255, 255], skin === 'marbre' ? 0.5 : 0.35);
  roundedRect(ctx, p.gloss.x, H * 0.38, p.gloss.w, 3.5, 1.75);
  ctx.fill();
}
