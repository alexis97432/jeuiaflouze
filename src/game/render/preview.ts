/**
 * Aperçu d'une apparence pour la collection du shell (V2, F4) : petite tour de trois étages
 * sur le ciel et le sol de l'univers, dessinée avec le même code que le jeu (`drawBlock`).
 * Fonction pure de dessin : aucun RAF, écouteur, stockage ni son. Image fixe, donc sans
 * mouvement (compatible reduced-motion).
 */
import { BLOCK_HEIGHT, drawBlock, type DrawSkinId } from './blocks';
import { resolveAnyAppearance, type AnyAppearance, type Appearance } from './mount';
import { css, getTheme, mix, skyAt, TIER_FLOORS, type DecorItem } from './themes';

export type PreviewOptions = {
  /** Taille CSS du dessin ; défaut = taille affichée du canvas (getBoundingClientRect). */
  width?: number;
  height?: number;
  /** Défaut : window.devicePixelRatio (borné à 3). */
  dpr?: number;
  /** Palier montré (0 à 3) ; défaut 0. */
  tier?: 0 | 1 | 2 | 3;
};

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

/**
 * Interne : même dessin pour toute apparence que `drawBlock` connaît, y compris les
 * apparences V3 pas encore exposées au shell (démo, harnais, futures boutique et passe).
 */
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
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);

  const tier = options.tier ?? 0;
  const sky = skyAt(theme, TIER_FLOORS[tier]);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, css(sky.top));
  g.addColorStop(1, css(sky.bottom));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Échelle : trois étages et un peu de sol doivent tenir en hauteur, 150 unités en largeur.
  const s = Math.min(w / 150, h / (BLOCK_HEIGHT * 3.9));
  const groundY = h - BLOCK_HEIGHT * 0.6 * s;

  // Deux éléments de décor du palier, fixes.
  const painter = theme.tiers[tier].decor;
  const items: [number, number, DecorItem][] = [
    [0.18, 0.28, { x: 0, r1: 0.3, r2: 0.4, r3: 0.2 }],
    [0.84, 0.18, { x: 0, r1: 0.7, r2: 0.6, r3: 0.8 }],
  ];
  for (const [fx, fy, item] of items) {
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * w * fx, dpr * h * fy);
    ctx.save();
    painter(ctx, item, 0, false);
    ctx.restore();
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = css(theme.ground.body);
  ctx.fillRect(0, groundY, w, h - groundY);
  ctx.fillStyle = css(theme.ground.top);
  ctx.fillRect(0, groundY, w, Math.min(4, h - groundY));

  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (w - 150 * s) / 2, dpr * groundY);
  const widths = [120, 98, 76];
  const offsets = [15, 22, 30];
  widths.forEach((bw, i) => {
    const y = -(i + 1) * BLOCK_HEIGHT;
    const behind = mix(sky.top, sky.bottom, Math.min(1, Math.max(0, (groundY + y * s) / h)));
    drawBlock(ctx, offsets[i]!, y, bw, theme.blocks[i % theme.blocks.length]!, { skin, sky: behind, alpha: 1, variant: i });
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return true;
}
