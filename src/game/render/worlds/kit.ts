/** Petits éléments de décor partagés par les univers (dessinés centrés en 0, 0). */
import { css, roundedRect, type Rgb } from '../color';
import { drawCached, TAU } from '../scene';
import type { DecorItem } from '../theme-types';

export function star(ctx: CanvasRenderingContext2D, r: number, color: Rgb, alpha: number): void {
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

export const twinkle = (item: DecorItem, t: number, motion: boolean, base: number): number =>
  motion ? base * (0.65 + 0.35 * Math.sin(t * (1.5 + item.r3 * 2) + item.r1 * 20)) : base;

/** Petit nuage de décor. */
export function puff(ctx: CanvasRenderingContext2D, s: number, color: Rgb, alpha: number): void {
  ctx.fillStyle = css(color, alpha);
  ctx.beginPath();
  ctx.arc(-14 * s, 4 * s, 11 * s, 0, TAU);
  ctx.arc(0, -3 * s, 15 * s, 0, TAU);
  ctx.arc(15 * s, 4 * s, 10 * s, 0, TAU);
  ctx.fill();
  roundedRect(ctx, -25 * s, 2 * s, 50 * s, 12 * s, 6 * s);
  ctx.fill();
}

/** Ballon avec ficelle ; `sway` en unités. */
export function balloon(ctx: CanvasRenderingContext2D, color: Rgb, sway: number, alpha = 0.7): void {
  ctx.strokeStyle = 'rgba(32,33,61,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sway, 12);
  ctx.quadraticCurveTo(sway - 4, 24, sway, 36);
  ctx.stroke();
  ctx.fillStyle = css(color, alpha);
  ctx.beginPath();
  ctx.ellipse(sway, 0, 10, 12, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(sway - 3.5, -4, 2.5, 4, -0.4, 0, TAU);
  ctx.fill();
}

/** Oiseau en V (deux traits), battement d'ailes `flap` (unités). */
export function bird(ctx: CanvasRenderingContext2D, size: number, flap: number, color: Rgb, alpha: number): void {
  ctx.strokeStyle = css(color, alpha);
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8 * size, -flap);
  ctx.quadraticCurveTo(-3 * size, 2, 0, 0);
  ctx.quadraticCurveTo(3 * size, 2, 8 * size, -flap);
  ctx.stroke();
}

/** Poisson simple orienté vers la droite. */
export function fish(ctx: CanvasRenderingContext2D, len: number, color: Rgb, alpha: number, wiggle = 0): void {
  ctx.fillStyle = css(color, alpha);
  ctx.beginPath();
  ctx.ellipse(0, 0, len * 0.5, len * 0.22, 0, 0, TAU);
  ctx.moveTo(-len * 0.4, 0);
  ctx.lineTo(-len * 0.75, -len * 0.22 + wiggle);
  ctx.lineTo(-len * 0.75, len * 0.22 + wiggle);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${(alpha * 0.9).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(len * 0.28, -len * 0.04, len * 0.05, 0, TAU);
  ctx.fill();
}

/** Point lumineux (luciole, plancton, lumière de drone), servi depuis le cache d'images. */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: Rgb, alpha: number): void {
  if (alpha <= 0.01) return;
  const rr = Math.max(1, Math.round(r * 2) / 2);
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * Math.min(1, alpha);
  drawCached(ctx, `glow|${rr}|${color.join(',')}`, x - rr, y - rr, rr * 2, rr * 2, (s) => {
    const g = s.createRadialGradient(rr, rr, 0, rr, rr, rr);
    g.addColorStop(0, css(color));
    g.addColorStop(0.35, css(color, 0.45));
    g.addColorStop(1, css(color, 0));
    s.fillStyle = g;
    s.fillRect(0, 0, rr * 2, rr * 2);
  });
  ctx.globalAlpha = a0;
}
