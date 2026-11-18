/** Outils de couleur et de forme partagés (univers, matières, scènes). Aucune dépendance. */

export type Rgb = readonly [number, number, number];

export function hex(h: string): Rgb {
  const n = Number.parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function css(c: Rgb, alpha = 1): string {
  return alpha >= 1 ? `rgb(${c[0]} ${c[1]} ${c[2]})` : `rgb(${c[0]} ${c[1]} ${c[2]} / ${Math.max(0, alpha).toFixed(3)})`;
}
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)];
}
export function lighten(c: Rgb, t: number): Rgb {
  return mix(c, [255, 255, 255], t);
}
export function darken(c: Rgb, t: number): Rgb {
  return mix(c, [0, 0, 0], t);
}

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

/** Encres du HUD : foncée et crème (mêmes objets partout : comparées par identité). */
export const CREAM: Rgb = hex('#FFF4DB');
export const INK: Rgb = hex('#20213D');
