/**
 * V4 : contrastes des jetons de couleur, en clair et en sombre (WCAG 2.x).
 * Texte courant ≥ 4,5:1 ; grand texte gras (titres, gros boutons) et éléments graphiques ≥ 3:1.
 * Le rendu réel des écrans est en plus contrôlé par tests/e2e/v4.spec.ts.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');

/** Variables du premier bloc qui suit `selector {`. */
function block(selector: string, from = 0): Record<string, string> {
  const start = css.indexOf(`${selector} {`, from);
  if (start < 0) throw new Error(`bloc absent : ${selector}`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) vars[m[1]!] = m[2]!.trim();
  return vars;
}

const light = block(':root');
const dark = block(":root[data-theme='dark']");
const darkAuto = block(":root[data-theme='system']", css.indexOf('@media (prefers-color-scheme: dark)'));

function rgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`couleur non opaque ou inattendue : ${hex}`);
  const n = Number.parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** [texte, fond, minimum, usage] ; les noms sont des jetons, `#fff…` une couleur fixe. */
const PAIRS: [string, string, number, string][] = [
  ['ink', 'bg', 4.5, 'texte sur le fond de page'],
  ['ink', 'surface', 4.5, 'texte des cartes'],
  ['ink', 'surface-2', 4.5, 'pastilles de gains'],
  ['ink', 'surface-3', 4.5, 'boutons pressés, notices neutres'],
  ['ink-soft', 'bg', 4.5, 'textes d’aide sur le fond'],
  ['ink-soft', 'surface', 4.5, 'textes d’aide des cartes'],
  ['ink-soft', 'surface-2', 4.5, 'textes d’aide sur surface-2'],
  ['ink-soft', 'surface-3', 4.5, 'textes d’aide sur surface-3'],
  ['on-color', 'primary', 4.5, 'bouton principal (Jouer, Rejouer)'],
  ['on-color', 'primary-hi', 4.5, 'haut du dégradé du bouton principal'],
  ['on-color', 'secondary', 4.5, 'bouton secondaire (Défi du jour, Défier un ami)'],
  ['on-color', 'secondary-hi', 4.5, 'haut du dégradé secondaire'],
  ['on-color', 'accent', 4.5, 'bouton accent et ruban « Nouveau record »'],
  ['on-color', 'accent-hi', 4.5, 'haut du dégradé accent'],
  ['#ffffff', 'ribbon-violet', 4.5, 'ruban « Niveau atteint »'],
  ['brand-accent', 'bg', 3, 'mot « Crash » du titre (grand texte gras)'],
  ['violet-ink', 'surface', 4.5, 'textes violets (liens d’état)'],
  ['ok-ink', 'ok-bg', 4.5, 'messages de réussite'],
  ['warn-ink', 'warn-bg', 4.5, 'avertissements'],
  ['danger-ink', 'danger-bg', 4.5, 'erreurs'],
  ['focus', 'bg', 3, 'anneau de focus (élément graphique)'],
  ['focus', 'surface', 3, 'anneau de focus sur carte'],
  ['edge', 'bg', 3, 'contours des boutons'],
];

function check(vars: Record<string, string>) {
  const color = (k: string) => (k.startsWith('#') ? k : vars[k] ?? (() => { throw new Error(`jeton absent : ${k}`); })());
  return PAIRS.map(([fg, bg, min, use]) => ({ fg, bg, use, min, ratio: Math.round(contrast(color(fg), color(bg)) * 100) / 100 }))
    .filter((r) => r.ratio < r.min);
}

describe('contrastes des jetons V4', () => {
  it('thème clair : toutes les paires lisibles', () => {
    expect(check(light)).toEqual([]);
  });

  it('thème sombre : toutes les paires lisibles', () => {
    expect(check({ ...light, ...dark })).toEqual([]);
  });

  it('sombre « Auto » (préférence de l’appareil) = sombre choisi : mêmes valeurs, aucune dérive', () => {
    expect(darkAuto).toEqual(dark);
  });

  it('le calcul de contraste est le bon (valeurs de référence WCAG)', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});
