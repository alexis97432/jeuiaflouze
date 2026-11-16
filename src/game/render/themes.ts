/**
 * Univers visuels V2 (F3). Données et fonctions de dessin purement décoratives :
 * aucune n'influence les règles, le rejeu ou le score (rulesVersion 1 inchangée).
 *
 * Un univers définit, pour chacun de ses 4 paliers de hauteur (0, 10, 25, 50 étages) :
 * les couleurs du ciel, la couleur du texte HUD, le nom du palier et un peintre de décor.
 * Le ciel est interpolé en continu entre paliers : une partie courte voit déjà le décor bouger.
 */

export type Rgb = readonly [number, number, number];
export type ThemeId = 'confiserie' | 'orbital' | 'jardin';
export const THEME_IDS: readonly ThemeId[] = ['confiserie', 'orbital', 'jardin'];
export const DEFAULT_THEME: ThemeId = 'confiserie';

/** Étages à partir desquels chaque palier commence. */
export const TIER_FLOORS = [0, 10, 25, 50] as const;

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

export interface Theme {
  readonly id: ThemeId;
  readonly name: string;
  readonly tiers: readonly [Tier, Tier, Tier, Tier];
  /** Couleurs des étages, en cycle. Toujours plus contrastées que le décor. */
  readonly blocks: readonly Rgb[];
  /** Couleurs des étincelles de parfait. */
  readonly sparks: readonly Rgb[];
  /** Sol sous la tour (bande pleine largeur, sous l'étage 0). */
  readonly ground: { readonly top: Rgb; readonly body: Rgb };
  readonly audio: ThemeAudio;
}

// ——— Outils de couleur ———

export function hex(h: string): Rgb {
  const n = Number.parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function css(c: Rgb, alpha = 1): string {
  return alpha >= 1 ? `rgb(${c[0]} ${c[1]} ${c[2]})` : `rgb(${c[0]} ${c[1]} ${c[2]} / ${alpha.toFixed(3)})`;
}
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)];
}
export const lighten = (c: Rgb, t: number): Rgb => mix(c, [255, 255, 255], t);
export const darken = (c: Rgb, t: number): Rgb => mix(c, [0, 0, 0], t);

/** Luminance relative WCAG 2.x. */
export function luminance(c: Rgb): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
}
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// ——— Paliers ———

/** Index du palier atteint pour un nombre d'étages posés. */
export function tierIndex(floors: number): 0 | 1 | 2 | 3 {
  if (floors >= TIER_FLOORS[3]) return 3;
  if (floors >= TIER_FLOORS[2]) return 2;
  if (floors >= TIER_FLOORS[1]) return 1;
  return 0;
}

/**
 * Ciel à une hauteur fractionnaire (en étages) : interpolation continue du palier
 * courant vers le suivant, constante au-delà du dernier.
 */
export function skyAt(theme: Theme, floors: number): { top: Rgb; bottom: Rgb; ink: Rgb } {
  const h = Math.max(0, floors);
  const i = tierIndex(h);
  const cur = theme.tiers[i];
  if (i === 3) return { top: cur.skyTop, bottom: cur.skyBottom, ink: cur.ink };
  const next = theme.tiers[i + 1 as 1 | 2 | 3];
  const t = (h - TIER_FLOORS[i]) / (TIER_FLOORS[i + 1 as 1 | 2 | 3] - TIER_FLOORS[i]);
  const top = mix(cur.skyTop, next.skyTop, t);
  const bottom = mix(cur.skyBottom, next.skyBottom, t);
  return { top, bottom, ink: bestInk(top, bottom) };
}

/** Position verticale (fraction de l'écran) où le score et les libellés sont dessinés. */
export const HUD_SKY_POSITION = 0.12;

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

// ——— Formes de base ———

export function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const TAU = Math.PI * 2;
const twinkle = (item: DecorItem, t: number, motion: boolean, base: number) =>
  motion ? base * (0.65 + 0.35 * Math.sin(t * (1.5 + item.r3 * 2) + item.r1 * 20)) : base;

function cloud(ctx: CanvasRenderingContext2D, s: number, color: Rgb, alpha: number) {
  ctx.fillStyle = css(color, alpha);
  ctx.beginPath();
  ctx.arc(-14 * s, 4 * s, 11 * s, 0, TAU);
  ctx.arc(0, -3 * s, 15 * s, 0, TAU);
  ctx.arc(15 * s, 4 * s, 10 * s, 0, TAU);
  ctx.fill();
  roundedRect(ctx, -25 * s, 2 * s, 50 * s, 12 * s, 6 * s);
  ctx.fill();
}

function star(ctx: CanvasRenderingContext2D, r: number, color: Rgb, alpha: number) {
  ctx.fillStyle = css(color, alpha);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.38;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
}

// ——— Univers ———

const CREAM = hex('#FFF4DB');
const INK = hex('#20213D');
const INK_DARK: Rgb = INK;
const INK_LIGHT: Rgb = CREAM;

const confiserie: Theme = {
  id: 'confiserie',
  name: 'Confiserie',
  blocks: ['#FF665E', '#62DEBF', '#8B75ED', '#FFB840', '#FF7FB0', '#4FB3F0'].map(hex),
  sparks: ['#FF665E', '#8B75ED', '#62DEBF', '#FFB840'].map(hex),
  ground: { top: hex('#FFD1E1'), body: hex('#F7B6CE') },
  audio: { wave: 'triangle', root: 523.25, scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24] },
  tiers: [
    {
      name: 'Confiserie', skyTop: hex('#FFD1E4'), skyBottom: CREAM, ink: INK,
      decor: (ctx, it) => cloud(ctx, 0.7 + it.r2 * 0.6, [255, 255, 255], 0.75),
    },
    {
      name: 'Pluie de vermicelles', skyTop: hex('#FFC4DA'), skyBottom: hex('#FFE6C2'), ink: INK,
      decor: (ctx, it, t, motion) => {
        const colors = confiserie.blocks;
        for (let k = 0; k < 5; k++) {
          const a = it.r1 * 10 + k * 1.7 + (motion ? t * 0.4 : 0);
          ctx.save();
          ctx.translate(Math.cos(k * 2.1 + it.r2 * 6) * 22, Math.sin(k * 1.3 + it.r3 * 6) * 16);
          ctx.rotate(a);
          ctx.fillStyle = css(colors[(k + Math.floor(it.r3 * 6)) % colors.length]!, 0.55);
          roundedRect(ctx, -5, -1.6, 10, 3.2, 1.6);
          ctx.fill();
          ctx.restore();
        }
      },
    },
    {
      name: 'Ballons sucrés', skyTop: hex('#B8A4FF'), skyBottom: hex('#FFC0D5'), ink: INK,
      decor: (ctx, it, t, motion) => {
        const c = confiserie.blocks[Math.floor(it.r1 * confiserie.blocks.length)]!;
        const sway = motion ? Math.sin(t * 0.8 + it.r2 * 6) * 3 : 0;
        ctx.strokeStyle = css(INK, 0.25);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sway, 12);
        ctx.quadraticCurveTo(sway - 4, 24, sway, 36);
        ctx.stroke();
        ctx.fillStyle = css(c, 0.6);
        ctx.beginPath();
        ctx.ellipse(sway, 0, 10, 12, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = css([255, 255, 255], 0.45);
        ctx.beginPath();
        ctx.ellipse(sway - 3.5, -4, 2.5, 4, -0.4, 0, TAU);
        ctx.fill();
      },
    },
    {
      name: 'Nuit bonbon', skyTop: hex('#4B2F86'), skyBottom: hex('#C27AD6'), ink: CREAM,
      decor: (ctx, it, t, motion) => star(ctx, 4 + it.r2 * 5, CREAM, twinkle(it, t, motion, 0.8)),
    },
  ],
};

const orbital: Theme = {
  id: 'orbital',
  name: 'Orbital',
  blocks: ['#62DEBF', '#8B75ED', '#4FB3F0', '#FFC65C', '#FF665E', '#D9D2FF'].map(hex),
  sparks: ['#FFF4DB', '#62DEBF', '#FFC65C'].map(hex),
  ground: { top: hex('#6E6A9E'), body: hex('#4A4675') },
  audio: { wave: 'sine', root: 440, scale: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24] },
  tiers: [
    {
      name: 'Orbite basse', skyTop: hex('#1E2257'), skyBottom: hex('#35307A'), ink: CREAM,
      decor: (ctx, it, t, motion) => {
        star(ctx, 2 + it.r2 * 2.5, CREAM, twinkle(it, t, motion, 0.7));
        ctx.fillStyle = css(CREAM, 0.5);
        ctx.beginPath();
        ctx.arc(26 * (it.r3 - 0.5), 18 * (it.r1 - 0.5), 1.1, 0, TAU);
        ctx.fill();
      },
    },
    {
      name: 'Anneaux', skyTop: hex('#16184A'), skyBottom: hex('#3F2D82'), ink: CREAM,
      decor: (ctx, it) => {
        const r = 10 + it.r2 * 9;
        const c = orbital.blocks[Math.floor(it.r1 * orbital.blocks.length)]!;
        ctx.fillStyle = css(c, 0.45);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = css(CREAM, 0.4);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.8, r * 0.45, -0.35 + it.r3 * 0.3, 0, TAU);
        ctx.stroke();
      },
    },
    {
      name: 'Constellations', skyTop: hex('#0F1033'), skyBottom: hex('#4A2A72'), ink: CREAM,
      decor: (ctx, it, t, motion) => {
        const pts: [number, number][] = [];
        for (let k = 0; k < 4; k++) pts.push([Math.cos(k * 1.9 + it.r1 * 6) * 26, Math.sin(k * 2.7 + it.r2 * 6) * 18]);
        ctx.strokeStyle = css(CREAM, 0.25);
        ctx.lineWidth = 1;
        ctx.beginPath();
        pts.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
        for (const [x, y] of pts) {
          ctx.save();
          ctx.translate(x, y);
          star(ctx, 3, CREAM, twinkle(it, t, motion, 0.8));
          ctx.restore();
        }
      },
    },
    {
      name: 'Nébuleuse', skyTop: hex('#070820'), skyBottom: hex('#33174F'), ink: CREAM,
      decor: (ctx, it) => {
        const c = it.r1 < 0.5 ? hex('#8B75ED') : hex('#62DEBF');
        const r = 26 + it.r2 * 20;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, css(c, 0.32));
        g.addColorStop(1, css(c, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
      },
    },
  ],
};

const LEAF = hex('#4CAF7A');
const jardin: Theme = {
  id: 'jardin',
  name: 'Jardin',
  blocks: ['#4CAF7A', '#FFB840', '#FF8F6B', '#5FB7EE', '#B48BE0', '#E5537A'].map(hex),
  sparks: ['#FFB840', '#4CAF7A', '#FF8F6B'].map(hex),
  ground: { top: hex('#8CD08F'), body: hex('#5FAE6E') },
  audio: { wave: 'sine', root: 392, scale: [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18] },
  tiers: [
    {
      name: 'Potager', skyTop: hex('#C8ECD3'), skyBottom: CREAM, ink: INK,
      decor: (ctx, it, t, motion) => {
        ctx.rotate(it.r1 * TAU + (motion ? Math.sin(t * 0.7 + it.r2 * 6) * 0.15 : 0));
        ctx.fillStyle = css(LEAF, 0.45);
        ctx.beginPath();
        ctx.ellipse(0, 0, 11 + it.r2 * 6, 5, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = css(darken(LEAF, 0.3), 0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
      },
    },
    {
      name: 'Floraison', skyTop: hex('#C6ECD6'), skyBottom: hex('#FFF0CC'), ink: INK,
      decor: (ctx, it) => {
        const c = jardin.blocks[1 + Math.floor(it.r1 * 5)]!;
        const s = 0.8 + it.r2 * 0.6;
        ctx.fillStyle = css(c, 0.55);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU + it.r3;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 6 * s, Math.sin(a) * 6 * s, 4.5 * s, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = css(hex('#FFE27A'), 0.8);
        ctx.beginPath();
        ctx.arc(0, 0, 3.2 * s, 0, TAU);
        ctx.fill();
      },
    },
    {
      name: 'Envol', skyTop: hex('#A8D8F0'), skyBottom: hex('#E4F5D8'), ink: INK,
      decor: (ctx, it, t, motion) => {
        if (it.r3 < 0.5) {
          cloud(ctx, 0.6 + it.r2 * 0.5, [255, 255, 255], 0.7);
          return;
        }
        const flap = motion ? Math.sin(t * 6 + it.r1 * 10) * 3 : 0;
        ctx.strokeStyle = css(INK, 0.4);
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-8, -flap);
        ctx.quadraticCurveTo(-3, 2, 0, 0);
        ctx.quadraticCurveTo(3, 2, 8, -flap);
        ctx.stroke();
      },
    },
    {
      name: 'Soleil couchant', skyTop: hex('#FFAD86'), skyBottom: hex('#FFE2B0'), ink: INK,
      decor: (ctx, it, t, motion) => {
        const r = 4 + it.r2 * 4;
        ctx.fillStyle = css(hex('#FFF4DB'), twinkle(it, t, motion, 0.7));
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = css(hex('#FFF4DB'), 0.18);
        ctx.beginPath();
        ctx.arc(0, 0, r * 2.4, 0, TAU);
        ctx.fill();
      },
    },
  ],
};

const THEMES: Record<ThemeId, Theme> = { confiserie, orbital, jardin };

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && (THEME_IDS as readonly string[]).includes(v);
}

/** Univers demandé, ou l'univers par défaut si l'identifiant est inconnu. */
export function getTheme(id: unknown): Theme {
  return THEMES[isThemeId(id) ? id : DEFAULT_THEME];
}

/**
 * Variante « la tour voyage » (avis FLK V2, à tester) : une même partie traverse
 * Confiserie (paliers 0–1), Jardin (palier 2) et Orbital (palier 3). Composition des
 * univers existants, sans nouvelle donnée.
 */
export const VOYAGE: Theme = {
  id: 'confiserie',
  name: 'Voyage',
  blocks: confiserie.blocks,
  sparks: confiserie.sparks,
  ground: confiserie.ground,
  audio: confiserie.audio,
  tiers: [confiserie.tiers[0], confiserie.tiers[1], jardin.tiers[2], orbital.tiers[3]],
};
