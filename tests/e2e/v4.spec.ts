/**
 * V4 en vrai navigateur (build de production) : contrastes à l'écran en clair et en sombre,
 * aucun bouton mort, réglages persistants, animations réduites, retour du téléphone, pause et
 * sortie de partie avec le vrai moteur, vibrations. Auto-vérification (exception V4).
 */
import { expect, test, type Page } from '@playwright/test';
import { metrics, noHorizontalOverflow, tapUntilResult, trackErrors } from './helpers';

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = trackErrors(page);
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

/** Progression de démonstration : de quoi remplir boutique, collection, passe et récompenses. */
const SEED = {
  version: 3, coins: 150, xp: 260, lives: 1, completed: ['floors-5'], inventory: ['graphite'],
  grants: ['v2-objectives-backfill'], season: { id: 's1', stars: 70, claimed: ['free:1'] },
};
async function seeded(page: Page) {
  await page.addInitScript((seed) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('poc:meta:v1:progress', JSON.stringify(seed));
      sessionStorage.setItem('seeded', '1');
    }
  }, SEED);
}

type Opener = { name: string; open: (page: Page) => Promise<void> };
const SCREENS: Opener[] = [
  { name: 'accueil', open: async () => undefined },
  { name: 'boutique', open: (p) => p.getByTestId('nav-shop').click() },
  { name: 'collection', open: (p) => p.getByTestId('nav-collection').click() },
  { name: 'récompenses', open: (p) => p.getByTestId('nav-rewards').click() },
  { name: 'passe', open: async (p) => { await p.getByTestId('nav-rewards').click(); await p.getByTestId('open-season').click(); } },
  { name: 'classement', open: (p) => p.getByTestId('nav-leaderboard').click() },
  { name: 'réglages', open: (p) => p.getByTestId('nav-settings').click() },
  {
    name: 'aide',
    // Sous 360 px, l'aide n'est plus dans la barre du haut : elle reste dans Réglages.
    open: async (p) => {
      if (await p.getByTestId('nav-help').isVisible()) await p.getByTestId('nav-help').click();
      else {
        await p.getByTestId('nav-settings').click();
        await p.getByTestId('open-howto').click();
      }
    },
  },
];

/** Textes visibles dont le contraste avec leur fond uni est insuffisant (WCAG 2.x). */
function lowContrast(page: Page) {
  return page.evaluate(() => {
    type C = { r: number; g: number; b: number; a: number };
    const parse = (c: string): C | null => {
      const m = /rgba?\(([^)]+)\)/.exec(c);
      if (!m) return null;
      const [r = 0, g = 0, b = 0, a = 1] = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r, g, b, a };
    };
    const lum = ({ r, g, b }: C) => {
      const f = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (x: C, y: C) => {
      const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    /** Premier fond opaque en remontant ; null si un dégradé ou un voile le cache (jetons testés à part). */
    const background = (el: Element): C | null => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage !== 'none') return null;
        const c = parse(cs.backgroundColor);
        if (c && c.a >= 0.99) return c;
        if (c && c.a > 0.05) return null;
      }
      return parse(getComputedStyle(document.documentElement).backgroundColor);
    };
    const bad: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent?.trim();
      const el = node.parentElement;
      if (!text || !el) continue;
      const box = el.getBoundingClientRect();
      if (box.width < 3 || box.height < 3) continue; // texte réservé aux lecteurs d'écran
      if (el.closest('button:disabled, [aria-hidden="true"]')) continue; // désactivé ou décoratif : exempté
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.99) continue;
      const fg = parse(cs.color);
      const bg = background(el);
      if (!fg || !bg || fg.a < 0.99) continue;
      const size = Number.parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      const r = ratio(fg, bg);
      if (r < (large ? 3 : 4.5)) bad.push(`${text.slice(0, 40)} : ${r.toFixed(2)}`);
    }
    return bad;
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`contrastes à l'écran, thème ${scheme === 'light' ? 'clair' : 'sombre'} (Auto suit l'appareil)`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile seulement');
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await seeded(page);
    for (const screen of SCREENS) {
      await page.goto('/');
      await screen.open(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
      expect(await lowContrast(page), `${screen.name} (${scheme})`).toEqual([]);
    }
    // Résultat : sauvegarde neuve (aucune vie, donc pas d'offre de reprise pendant la partie).
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.getByTestId('play').click();
    await tapUntilResult(page);
    expect(await lowContrast(page), `résultat (${scheme})`).toEqual([]);
  });
}

test('aucun bouton mort : chaque bouton visible de chaque écran produit un effet', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile seulement');
  test.setTimeout(300_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seeded(page);
  const snapshot = () =>
    page.evaluate(() => [
      document.documentElement.outerHTML,
      JSON.stringify({ ...localStorage }),
      document.activeElement?.outerHTML ?? '',
    ].join('|'));
  // Fenêtre ouverte : seuls ses boutons sont atteignables (le reste est sous le voile, inerte).
  const visible = async (p: Page) =>
    (await p.locator('[role="dialog"]').count()) > 0
      ? p.locator('[role="dialog"] button:visible:not([disabled])')
      : p.locator('button:visible:not([disabled])');
  /** Repart de la même sauvegarde à chaque bouton : un achat ou un cadeau pris ne fausse pas la suite. */
  const fresh = async (screen: Opener) => {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/');
    await screen.open(page);
  };
  let clicked = 0;
  await page.goto('/');
  for (const screen of SCREENS) {
    await fresh(screen);
    const count = await (await visible(page)).count();
    for (let i = 0; i < count; i++) {
      await fresh(screen);
      expect(await (await visible(page)).count(), `boutons de ${screen.name}`).toBe(count);
      const button = (await visible(page)).nth(i);
      const label = (await button.getAttribute('aria-label')) ?? (await button.textContent())?.trim();
      const before = await snapshot();
      await button.click();
      await page.waitForTimeout(120);
      expect(await snapshot(), `« ${label} » sans effet (${screen.name})`).not.toBe(before);
      clicked++;
    }
  }
  // Inventaire attendu ≈ 36 boutons (accueil 8, boutique 4, collection 3, récompenses 4, passe 2,
  // classement 1, réglages 12, aide 2) ; moins de 30 voudrait dire que l'exploration a raté des écrans.
  test.info().annotations.push({ type: 'boutons explorés', description: String(clicked) });
  expect(clicked).toBeGreaterThanOrEqual(30);
});

test('réglages : thème, animations, effets et vibrations appliqués et gardés après rechargement', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile seulement');
  await page.addInitScript(() => {
    // Vibrations disponibles (comme sur Android) : on compte les appels.
    const calls: unknown[] = [];
    Object.defineProperty(window, '__vibrations', { value: calls });
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (p: unknown) => { calls.push(p); return true; } });
  });
  await page.goto('/');
  const html = page.locator('html');
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const lightBg = await bg();
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('theme-dark').click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  expect(await bg()).not.toBe(lightBg);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#16163a');
  await page.getByTestId('motion-reduce').click();
  await expect(html).toHaveAttribute('data-motion', 'reduce');
  await page.getByTestId('effects-light').click();
  await expect(html).toHaveAttribute('data-effects', 'light');
  const haptics = page.getByRole('switch', { name: 'Vibrations' });
  await expect(haptics).toHaveAttribute('aria-checked', 'true');
  await noHorizontalOverflow(page);

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).toHaveAttribute('data-motion', 'reduce');
  await expect(html).toHaveAttribute('data-effects', 'light');
  // Animations réduites : le halo du bouton Jouer est coupé.
  const halo = await page.getByTestId('play').evaluate((b) => getComputedStyle(b, '::after').display);
  expect(halo).toBe('none');

  // Une partie : chaque pose vibre brièvement.
  await page.getByTestId('play').click();
  const box = (await page.getByTestId('game-canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __vibrations: unknown[] }).__vibrations.length)).toBeGreaterThan(0);
});

test('vibrations absentes (iPhone) : une phrase claire, pas d’interrupteur', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile seulement');
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: undefined });
  });
  await page.goto('/');
  await page.getByTestId('nav-settings').click();
  await expect(page.getByTestId('haptics-unavailable')).toHaveText('Ton appareil ne propose pas les vibrations.');
  await expect(page.getByRole('switch', { name: 'Vibrations' })).toHaveCount(0);
});

test('animations réduites par l’appareil : appliquées en « Auto »', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
});

test('retour du téléphone : écran → accueil, partie → pause (jamais de sortie), fenêtre → fermée', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile seulement');
  await page.goto('/');
  await page.getByTestId('nav-shop').click();
  await expect(page.getByRole('heading', { name: 'Boutique' })).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('play')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  const help = page.getByTestId('nav-help');
  if (await help.isVisible()) {
    await help.click();
    await expect(page.getByRole('dialog', { name: 'Comment jouer' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Comment jouer' })).toHaveCount(0);
    await expect(page.getByTestId('play')).toBeVisible();
  } else {
    // Sous 360 px : l'aide est dans Réglages ; le retour ferme la fenêtre, puis revient à l'accueil.
    await page.getByTestId('nav-settings').click();
    await page.getByTestId('open-howto').click();
    await expect(page.getByRole('dialog', { name: 'Comment jouer' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Comment jouer' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('play')).toBeVisible();
  }

  await page.getByTestId('play').click();
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('pause')).toBeVisible();
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.goBack(); // un second retour reste dans la partie
  await expect(page.getByTestId('pause')).toBeVisible();
  await page.getByRole('button', { name: 'Reprendre' }).click();
  await expect(page.getByTestId('pause')).toBeHidden();
});

test('vrai moteur : Pause, Reprendre, puis Quitter la partie sans rien enregistrer', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile seulement');
  await page.goto('/');
  await page.getByTestId('play').tap();
  const canvas = page.getByTestId('game-canvas');
  const box = (await canvas.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); // première pose
  const pauseButton = page.getByRole('button', { name: 'Pause' });
  await expect(pauseButton).toBeInViewport({ ratio: 1 });
  await pauseButton.tap();
  const pause = page.getByTestId('pause');
  await expect(pause).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reprendre' })).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Reprendre' }).tap();
  await expect(pause).toBeHidden();
  await pauseButton.tap();
  await page.getByRole('button', { name: 'Quitter la partie' }).tap();
  await expect(page.getByTestId('play')).toBeVisible();
  const names = (await metrics(page)).map((e) => e.name);
  expect(names).not.toContain('run_end');
  expect(await page.evaluate(() => localStorage.getItem('poc:v1:best'))).toBeNull();
  await noHorizontalOverflow(page);
});

test('aucune référence technique dans les parcours joueurs (UTC, ISO, serveur, non vérifié)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile seulement');
  await seeded(page);
  for (const screen of SCREENS) {
    await page.goto('/');
    await screen.open(page);
    const text = await page.locator('body').innerText();
    expect(text, screen.name).not.toMatch(/UTC|\d{4}-\d{2}-\d{2}|serveur|non vérifié|\bXP\b/);
  }
  await page.goto('/');
  await page.getByTestId('daily').click();
  await expect(page.getByTestId('target')).not.toContainText(/UTC|\d{4}-\d{2}-\d{2}/);
});
