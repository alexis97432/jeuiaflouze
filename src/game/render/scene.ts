/**
 * Scènes d'univers V6 : plusieurs plans en parallaxe qui racontent une ascension.
 *
 * Plans (du plus lointain au plus proche) :
 * - `far`  : astres et phénomènes du ciel (parallaxe quasi nulle) ;
 * - `back` : silhouettes ancrées au sol (qui s'éloignent vers le bas pendant la montée) et
 *            éléments placés à une altitude (atteints à un étage précis) ;
 * - décor (géré par le renderer) : petits éléments par palier ;
 * - `near` : particules légères devant le décor, derrière la tour (qualité complète seulement) ;
 * - `ground` : sol thématique.
 *
 * Purement décoratif : une scène ne lit que la hauteur lissée et le temps ; son hasard est
 * cosmétique (graine de la scène), jamais celui de la partie.
 */
import { BLOCK_HEIGHT } from './dims';
import { css, mix, type Rgb } from './color';

export const TAU = Math.PI * 2;

export interface SceneEnv {
  readonly ctx: CanvasRenderingContext2D;
  /** Taille de l'écran (px CSS). */
  readonly w: number;
  readonly h: number;
  /** Ordonnée écran du sol quand la caméra est à 0. */
  readonly groundY: number;
  /** Caméra (unités du monde). */
  readonly cam: number;
  /** Pixels par unité. */
  readonly scale: number;
  /** Étages (hauteur lissée de la tour). */
  readonly height: number;
  /** Palier fractionnaire (0 à 5) : mélange continu des ambiances. */
  readonly stage: number;
  readonly t: number;
  readonly motion: boolean;
  /** Qualité complète : premier plan et détails coûteux permis. */
  readonly full: boolean;
  /** Graine cosmétique de la scène (découvertes « parfois »). */
  readonly seed: number;
  /** Ligne du bloc actif (fraction de la hauteur), pour placer les éléments d'altitude. */
  readonly activeFrac: number;
}

export interface Scene {
  far(env: SceneEnv): void;
  back(env: SceneEnv): void;
  near(env: SceneEnv): void;
  ground(env: SceneEnv, top: number): void;
}

/** Ordonnée écran d'un point placé à `y` unités au-dessus du sol, sur un plan de parallaxe `p`. */
export function layerY(env: SceneEnv, y: number, p: number): number {
  return env.groundY - (y - env.cam * p) * env.scale;
}

/**
 * Hauteur (unités, sur le plan `p`) d'un élément qui passe à la ligne du bloc actif quand la
 * tour atteint `floor` étages : il est découvert pendant la montée, à cet étage.
 */
export function altitude(env: SceneEnv, floor: number, p: number): number {
  const lead = (env.groundY - env.activeFrac * env.h) / env.scale;
  const cam = Math.max(0, (floor + 1) * BLOCK_HEIGHT - lead);
  return cam * p + lead;
}

/** Abscisse écran d'une abscisse en unités relative au centre (plan `p` : pas de défilement latéral). */
export const sx = (env: SceneEnv, x: number): number => env.w / 2 + x * env.scale;

/** Mélange continu d'une couleur par palier (6 valeurs). */
export function byStage(env: SceneEnv, colors: readonly Rgb[]): Rgb {
  const i = Math.min(colors.length - 1, Math.max(0, Math.floor(env.stage)));
  const j = Math.min(colors.length - 1, i + 1);
  return mix(colors[i]!, colors[j]!, env.stage - i);
}

/** 0 → 1 quand la hauteur passe de `a` à `b` étages. */
export function fade(env: SceneEnv, a: number, b: number): number {
  const k = Math.min(1, Math.max(0, (env.height - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

/** Tirage stable dans [0, 1[. */
export function hash(n: number, k = 0): number {
  let x = (Math.imul(n + 17, 0x9e3779b1) ^ Math.imul(k + 3, 0x85ebca6b)) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d) >>> 0;
  x ^= x >>> 12;
  return (x >>> 0) / 4294967296;
}

/**
 * Apparition d'un élément d'altitude à l'approche de son étage. Nécessaire en bas de tour :
 * la caméra ne monte qu'après une douzaine d'étages, l'élément serait sinon visible d'emblée.
 */
export const reveal = (env: SceneEnv, floor: number): number => fade(env, floor - 7, floor - 2);

/** Découverte « parfois » : présente dans une partie sur `chance` (graine de scène). */
export const egg = (env: SceneEnv, id: number, chance: number): boolean => hash(env.seed, id) < chance;

/** Relief 1D doux (somme de sinus déphasés). */
export function ridge(x: number, seed: number, freq: number): number {
  let v = 0;
  let a = 1;
  let f = freq;
  let n = 0;
  for (let k = 0; k < 4; k++) {
    v += Math.sin(x * f + hash(seed, k) * TAU) * a;
    n += a;
    a *= 0.5;
    f *= 2.1;
  }
  return v / n;
}

/** Silhouette pleine (collines, récif, toits) ancrée à `base` unités sur le plan `p`. */
export function silhouette(
  env: SceneEnv, p: number, base: number, height: (x: number) => number, fill: string | CanvasGradient, step = 10,
): void {
  const { ctx, w, h } = env;
  const y0 = layerY(env, base, p);
  if (y0 < -400 || layerY(env, base + 400, p) > h + 10) return;
  ctx.beginPath();
  ctx.moveTo(0, h + 2);
  for (let x = 0; x <= w + step; x += step) {
    const X = (x - w / 2) / env.scale;
    ctx.lineTo(x, layerY(env, base + height(X), p));
  }
  ctx.lineTo(w, h + 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Nuage arrondi centré en (x, y), taille `s` (px). */
export function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: Rgb, alpha: number, shade?: Rgb): void {
  if (alpha <= 0.01) return;
  ctx.fillStyle = css(color, alpha);
  ctx.beginPath();
  ctx.arc(x - 14 * s, y + 4 * s, 11 * s, 0, TAU);
  ctx.arc(x, y - 3 * s, 15 * s, 0, TAU);
  ctx.arc(x + 15 * s, y + 4 * s, 10 * s, 0, TAU);
  ctx.arc(x + 4 * s, y + 7 * s, 12 * s, 0, TAU);
  ctx.fill();
  if (shade) {
    ctx.fillStyle = css(shade, alpha * 0.45);
    ctx.beginPath();
    ctx.ellipse(x + 1 * s, y + 11 * s, 24 * s, 4 * s, 0, 0, TAU);
    ctx.fill();
  }
}

// ——— Images mises en cache (halos, astres, galaxie) ———

type SpriteCanvas = HTMLCanvasElement | OffscreenCanvas;
const MAX_SPRITES = 24;
/**
 * V7 : budget mémoire des images en cache (pixels). Avant, seules 24 images étaient comptées,
 * jusqu'à 1,2 million de pixels chacune : en théorie plus de 100 Mo de canvas gardés d'une partie
 * à l'autre. Les plus anciennes sont libérées au-delà de 3 millions de pixels (environ 12 Mo).
 */
export const SPRITE_PIXEL_BUDGET = 3_000_000;
/** V7 : résolution maximale des images de décor (le décor flou au-delà de ×2 ne se voit pas). */
export const SPRITE_MAX_RES = 2;
const sprites = new Map<string, SpriteCanvas>();
let spritePixels = 0;

const pixelsOf = (c: SpriteCanvas): number => c.width * c.height;

function dropOldestSprite(): void {
  const first = sprites.keys().next().value;
  if (first === undefined) return;
  const c = sprites.get(first);
  sprites.delete(first);
  if (c) spritePixels -= pixelsOf(c);
}

/** Libère toutes les images en cache (fin de partie, perte du contexte graphique, manque de mémoire). */
export function releaseSprites(): void {
  sprites.clear();
  spritePixels = 0;
}

/** Pixels gardés par le cache d'images (tests de bornes). */
export const spritePixelCount = (): number => spritePixels;

function newCanvas(w: number, h: number): SpriteCanvas | null {
  try {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }
  } catch {
    // Pas de canvas hors écran : dessin direct.
  }
  return null;
}

/** Images en cache (tests de bornes). */
export const spriteCount = (): number => sprites.size;

/**
 * Dessine `paint` (repère local 0..w × 0..h, en px CSS) à (x, y), via une image mise en cache à la
 * résolution courante : un halo ou une galaxie coûte un seul remplissage par image. Sans vrai
 * canvas (tests), dessin direct.
 */
export function drawCached(
  ctx: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number,
  paint: (c: CanvasRenderingContext2D) => void,
): void {
  const m = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
  const res = m && typeof m.a === 'number' ? Math.min(SPRITE_MAX_RES, Math.max(1, Math.round(Math.hypot(m.a, m.b) * 4) / 4)) : 0;
  const pw = Math.ceil(w * res);
  const ph = Math.ceil(h * res);
  const full = `${key}|${res}|${pw}x${ph}`;
  const cacheable = res > 0 && pw > 0 && ph > 0 && pw * ph < 1_200_000;
  let sprite = cacheable ? sprites.get(full) : undefined;
  if (sprite) {
    // Récemment utilisée : en fin de liste (les plus anciennes partent en premier).
    sprites.delete(full);
    sprites.set(full, sprite);
  } else if (cacheable) {
    const c = newCanvas(pw, ph);
    const x2 = (c?.getContext('2d') ?? null) as CanvasRenderingContext2D | null;
    if (c && x2) {
      x2.setTransform(res, 0, 0, res, 0, 0);
      paint(x2);
      while (sprites.size > 0 && (sprites.size >= MAX_SPRITES || spritePixels + pw * ph > SPRITE_PIXEL_BUDGET)) dropOldestSprite();
      sprites.set(full, c);
      spritePixels += pixelsOf(c);
      sprite = c;
    }
  }
  if (sprite) {
    ctx.drawImage(sprite as CanvasImageSource, x, y, w, h);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  paint(ctx);
  ctx.restore();
}

/** Disque lumineux (soleil, lune, planète) avec halo, servi depuis le cache d'images. */
export function orb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: Rgb, halo: number, alpha = 1): void {
  if (alpha <= 0.01) return;
  const rr = Math.round(r * 2) / 2;
  const R = halo > 0 ? rr * (2.4 + halo) : rr;
  const q = (v: number) => Math.round(v / 6) * 6;
  const c: Rgb = [q(color[0]), q(color[1]), q(color[2])];
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * alpha;
  drawCached(ctx, `orb|${rr}|${c.join(',')}|${halo.toFixed(2)}`, x - R, y - R, R * 2, R * 2, (s) => {
    if (halo > 0) {
      const g = s.createRadialGradient(R, R, rr * 0.6, R, R, R);
      g.addColorStop(0, css(c, 0.35 * halo));
      g.addColorStop(1, css(c, 0));
      s.fillStyle = g;
      s.fillRect(0, 0, R * 2, R * 2);
    }
    s.fillStyle = css(c);
    s.beginPath();
    s.arc(R, R, rr, 0, TAU);
    s.fill();
  });
  ctx.globalAlpha = a0;
}

/** Champ d'étoiles (écran), scintillement doux ; `alpha` 0 → rien. */
export function starfield(env: SceneEnv, count: number, alpha: number, seed: number, drift = 0.03): void {
  if (alpha <= 0.01) return;
  const { ctx, w, h, t, motion } = env;
  const n = env.full ? count : Math.ceil(count / 2);
  for (let k = 0; k < n; k++) {
    const x = hash(seed, k * 3) * w;
    const y = ((hash(seed, k * 3 + 1) * h * 1.3 + env.cam * drift * env.scale) % (h * 1.3)) - h * 0.15;
    const big = hash(seed, k * 3 + 2) > 0.88;
    const tw = motion ? 0.6 + 0.4 * Math.sin(t * (1.2 + hash(seed, k) * 2.5) + k) : 0.85;
    ctx.fillStyle = `rgba(255,250,240,${(alpha * tw * (big ? 1 : 0.7)).toFixed(3)})`;
    const r = big ? 1.4 : 0.8;
    ctx.fillRect(x - r / 2, y - r / 2, r, r);
    if (big && env.full) {
      ctx.fillRect(x - r * 2.2, y - 0.25, r * 4.4, 0.5);
      ctx.fillRect(x - 0.25, y - r * 2.2, 0.5, r * 4.4);
    }
  }
}

/** Rayons de lumière obliques (sous l'eau, lumière dorée). */
export function rays(env: SceneEnv, color: Rgb, alpha: number, count: number, seed: number): void {
  if (alpha <= 0.01) return;
  const { ctx, w, h, t, motion } = env;
  for (let k = 0; k < count; k++) {
    const sway = motion ? Math.sin(t * 0.25 + k * 1.7) * 18 : 0;
    const x = hash(seed, k) * w * 1.2 - w * 0.1 + sway;
    const width = 20 + hash(seed, k + 9) * 50;
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.9);
    g.addColorStop(0, css(color, alpha * (0.5 + hash(seed, k + 4) * 0.5)));
    g.addColorStop(1, css(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + width, 0);
    ctx.lineTo(x + width * 0.4 + h * 0.25, h * 0.9);
    ctx.lineTo(x - width * 0.6 + h * 0.25, h * 0.9);
    ctx.closePath();
    ctx.fill();
  }
}

/** Particules de premier plan (vermicelles, bulles, lucioles, pluie…), bornées. */
export function drifters(
  env: SceneEnv, count: number, seed: number,
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number, k: number, phase: number) => void,
  speed: { x: number; y: number },
): void {
  const { ctx, w, h, t, motion } = env;
  const n = env.full ? count : 0;
  const span = h + 40;
  for (let k = 0; k < n; k++) {
    const phase = hash(seed, k);
    const vx = speed.x * (0.6 + hash(seed, k + 50) * 0.8);
    const vy = speed.y * (0.6 + hash(seed, k + 90) * 0.8);
    const tt = motion ? t : 0;
    const x = ((((hash(seed, k + 7) * w + tt * vx) % (w + 40)) + w + 40) % (w + 40)) - 20;
    const y = ((((hash(seed, k + 13) * span + tt * vy + env.cam * env.scale * 0.15) % span) + span) % span) - 20;
    draw(ctx, x, y, k, phase);
  }
}

/** Petite étiquette néon / panneau : rectangle arrondi lumineux. */
export function glowRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: Rgb, alpha: number): void {
  if (alpha <= 0.01) return;
  for (const [grow, a] of [[6, 0.12], [3, 0.22], [0, 0.85]] as const) {
    ctx.fillStyle = css(color, alpha * a);
    ctx.fillRect(x - grow, y - grow, w + grow * 2, h + grow * 2);
  }
}
