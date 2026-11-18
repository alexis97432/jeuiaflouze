/**
 * Aperçu d'une apparence pour la collection et la boutique (V2, F4 ; V6 : aperçus vivants).
 * Petite tour de trois étages dans la vraie scène de l'univers, dessinée avec le même code que
 * le jeu (`drawBlock`, matières et scène). Fonction pure de dessin : aucun RAF, écouteur,
 * stockage ni son. Sans `time`, image fixe (animations réduites) ; avec `time`, l'appelant
 * redessine à son rythme et l'aperçu montre les mêmes animations qu'en partie.
 */
import { BLOCK_HEIGHT, drawBlock, type DrawSkinId } from './blocks';
import { STATIC_ENV, type MaterialEnv } from './materials';
import { resolveAnyAppearance, type AnyAppearance, type Appearance } from './mount';
import type { SceneEnv } from './scene';
import { css, getTheme, mix, skyAt, stageAt, TIER_FLOORS, type DecorItem, type TierIndex } from './themes';

export type PreviewOptions = {
  /** Taille CSS du dessin ; défaut = taille affichée du canvas (getBoundingClientRect). */
  width?: number;
  height?: number;
  /** Défaut : window.devicePixelRatio (borné à 3). */
  dpr?: number;
  /** Palier montré (0 à 5) ; défaut 0. Ignoré si `climb` est vrai. */
  tier?: TierIndex;
  /** V6 : secondes écoulées (animations). Absent : image fixe. */
  time?: number;
  /** V6 : l'aperçu monte lentement à travers les paliers de l'univers (cartes d'univers). */
  climb?: boolean;
};

const ITEMS: [number, number, DecorItem][] = [
  [0.18, 0.28, { x: 0, r1: 0.3, r2: 0.4, r3: 0.2 }],
  [0.84, 0.2, { x: 0, r1: 0.7, r2: 0.6, r3: 0.8 }],
];

/** Durée d'une montée complète de l'aperçu « climb » (s) : 0 → 54 étages, puis on recommence. */
export const CLIMB_SECONDS = 18;

/**
 * Dessine l'aperçu dans `canvas`. Renvoie false (sans lever) si le contexte Canvas 2D est
 * indisponible : une collection doit rester utilisable même sans aperçu.
 */
export function renderAppearancePreview(
  canvas: HTMLCanvasElement,
  appearance: Partial<AnyAppearance> | undefined,
  options: PreviewOptions = {},
): boolean {
  return drawAppearancePreview(canvas, resolveAnyAppearance(appearance), options);
}

/** Interne : même dessin pour toute apparence que `drawBlock` connaît. */
export function drawAppearancePreview(
  canvas: HTMLCanvasElement,
  { theme: themeId, skin }: { theme: Appearance['theme']; skin: DrawSkinId },
  options: PreviewOptions = {},
): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const theme = getTheme(themeId);
  const rect = options.width && options.height ? null : canvas.getBoundingClientRect();
  const w = Math.max(1, options.width ?? rect?.width ?? 120);
  const h = Math.max(1, options.height ?? rect?.height ?? 80);
  const win = canvas.ownerDocument?.defaultView;
  const dpr = Math.min(Math.max(options.dpr ?? win?.devicePixelRatio ?? 1, 1), 3);
  const cw = Math.round(w * dpr);
  const ch = Math.round(h * dpr);
  // Taille changée seulement si nécessaire : un aperçu animé ne réalloue pas sa mémoire.
  if (canvas.width !== cw) canvas.width = cw;
  if (canvas.height !== ch) canvas.height = ch;

  const animated = options.time !== undefined;
  const t = options.time ?? 0;
  const height = options.climb && animated
    ? ((t % CLIMB_SECONDS) / CLIMB_SECONDS) * 54
    : TIER_FLOORS[options.tier ?? 0];

  const sky = skyAt(theme, height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, css(sky.top));
  g.addColorStop(1, css(sky.bottom));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Échelle : trois étages et un peu de sol doivent tenir en hauteur, 150 unités en largeur.
  const s = Math.min(w / 150, h / (BLOCK_HEIGHT * 3.9));
  const groundY = h - BLOCK_HEIGHT * 0.6 * s;
  const activeFrac = 0.4;
  const lead = (groundY - activeFrac * h) / s;
  const cam = Math.max(0, (height + 1) * BLOCK_HEIGHT - lead);
  const scene: SceneEnv = {
    ctx, w, h, groundY, cam, scale: s, height, stage: stageAt(height), t, motion: animated, full: true, seed: 7, activeFrac,
  };
  const paint = (fn: () => void) => {
    ctx.save();
    try {
      fn();
    } catch {
      // Décor seulement.
    }
    ctx.restore();
  };
  paint(() => theme.scene.far(scene));
  paint(() => theme.scene.back(scene));

  // Deux éléments de décor du palier courant.
  const painter = theme.tiers[stageIndex(height)].decor;
  for (const [fx, fy, item] of ITEMS) {
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * w * fx, dpr * h * fy);
    paint(() => painter(ctx, item, t, animated));
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const groundTop = groundY + cam * s;
  if (groundTop < h) {
    ctx.fillStyle = css(theme.ground.body);
    ctx.fillRect(0, groundTop, w, h - groundTop);
    paint(() => theme.scene.ground(scene, groundTop));
  }
  paint(() => theme.scene.near(scene));

  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (w - 150 * s) / 2, dpr * groundY);
  const widths = [120, 98, 76];
  const offsets = [15, 22, 30];
  const floor0 = Math.max(0, Math.round(height) - 2);
  widths.forEach((bw, i) => {
    const y = -(i + 1) * BLOCK_HEIGHT;
    const behind = mix(sky.top, sky.bottom, Math.min(1, Math.max(0, (groundY + y * s) / h)));
    const env: MaterialEnv = { ...STATIC_ENV, t, motion: animated, wx: offsets[i]!, wy: y, ox: offsets[i]!, cam: 0, floor: floor0 + i };
    drawBlock(ctx, offsets[i]!, y, bw, theme.blocks[(floor0 + i) % theme.blocks.length]!, { skin, sky: behind, alpha: 1, variant: floor0 + i, env });
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return true;
}

function stageIndex(height: number): TierIndex {
  let i: TierIndex = 0;
  for (let k = 1; k < TIER_FLOORS.length; k++) if (height >= TIER_FLOORS[k]!) i = k as TierIndex;
  return i;
}
