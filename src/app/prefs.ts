/**
 * Application des préférences (V4) à l'interface : thème clair/sombre, animations, effets.
 *
 * - Le thème de l'interface est indépendant de l'univers des blocs (Confiserie, Orbital, Jardin).
 * - `system` suit l'appareil en direct (`prefers-color-scheme`, `prefers-reduced-motion`).
 * - Tout est posé en attributs `data-*` sur `<html>` : le CSS fait le reste, sans clignotement.
 */
import type { MotionPref, Prefs, ThemePref } from '../platform/storage';

export type EffectiveTheme = 'light' | 'dark';

type MediaWindow = Pick<Window, 'matchMedia'>;

const media = (win: MediaWindow | null | undefined, query: string): MediaQueryList | null => {
  try {
    return typeof win?.matchMedia === 'function' ? win.matchMedia(query) : null;
  } catch {
    return null;
  }
};

export const DARK_QUERY = '(prefers-color-scheme: dark)';
export const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

export function effectiveTheme(theme: ThemePref, win?: MediaWindow | null): EffectiveTheme {
  if (theme !== 'system') return theme;
  return media(win, DARK_QUERY)?.matches ? 'dark' : 'light';
}

export function effectiveReducedMotion(motion: MotionPref, win?: MediaWindow | null): boolean {
  if (motion !== 'system') return motion === 'reduce';
  return media(win, REDUCE_QUERY)?.matches ?? false;
}

/** Couleur de la barre du navigateur (meta theme-color), alignée sur le fond de chaque thème. */
export const THEME_COLOR: Record<EffectiveTheme, string> = { light: '#fff3e0', dark: '#16163a' };

export function applyPrefs(doc: Document, prefs: Prefs): void {
  const root = doc.documentElement;
  const win = doc.defaultView;
  root.dataset.theme = prefs.theme;
  root.dataset.motion = effectiveReducedMotion(prefs.motion, win) ? 'reduce' : 'full';
  root.dataset.effects = prefs.effects;
  const color = THEME_COLOR[effectiveTheme(prefs.theme, win)];
  let meta = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = doc.createElement('meta');
    meta.name = 'theme-color';
    doc.head.append(meta);
  }
  meta.content = color;
  root.style.colorScheme = effectiveTheme(prefs.theme, win);
}

/**
 * Réapplique les préférences quand l'appareil change de thème ou de réglage d'animations.
 * Renvoie la fonction qui retire les écouteurs.
 */
export function watchSystemPrefs(doc: Document, current: () => Prefs): () => void {
  const win = doc.defaultView;
  const lists = [media(win, DARK_QUERY), media(win, REDUCE_QUERY)].filter((m): m is MediaQueryList => m !== null);
  const onChange = () => applyPrefs(doc, current());
  for (const m of lists) {
    if (typeof m.addEventListener === 'function') m.addEventListener('change', onChange);
  }
  return () => {
    for (const m of lists) {
      if (typeof m.removeEventListener === 'function') m.removeEventListener('change', onChange);
    }
  };
}
