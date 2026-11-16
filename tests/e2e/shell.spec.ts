import { expect, test } from '@playwright/test';
import { metrics, noHorizontalOverflow, playUntilResult, tapUntilResult, trackErrors } from './helpers';

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = trackErrors(page);
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

test('parcours complet au clavier', async ({ page, isMobile }) => {
  test.skip(isMobile, 'parcours clavier testé sur desktop');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Jouer' })).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('game-canvas')).toBeFocused();
  await playUntilResult(page, () => page.keyboard.press('Space'));

  await expect(page.getByText('Score local, non vérifié.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rejouer' })).toBeFocused();
  // Tab atteint les autres actions dans l'ordre visuel.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Défier un ami' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('game-canvas')).toBeVisible();

  const names = (await metrics(page)).map((e) => e.name);
  // first_placement n'existe que si la seed (aléatoire) donne au moins une pose au mock.
  expect(names.filter((n) => n !== 'first_placement')).toEqual([
    'session_start',
    'run_start',
    'run_end',
    'retry',
    'run_start',
  ]);
  expect(names.filter((n) => n === 'first_placement').length).toBeLessThanOrEqual(1);
  if (names.includes('first_placement')) expect(names.indexOf('first_placement')).toBe(2);
});

test('vrai moteur : rendu Canvas adapté à la densité de pixels, sans mock', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Jouer' }).click();
  const canvas = page.getByTestId('game-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId('mock-banner')).toHaveCount(0);
  // Le moteur F1 dimensionne le canvas en pixels physiques et y dessine la pile.
  await expect
    .poll(() =>
      canvas.evaluate((c: HTMLCanvasElement) => {
        const dpr = Math.min(window.devicePixelRatio, 3);
        const ctx = c.getContext('2d');
        if (!ctx || Math.abs(c.width - c.clientWidth * dpr) > 2) return 'taille';
        const { data } = ctx.getImageData(0, 0, c.width, c.height);
        const colors = new Set<number>();
        for (let i = 0; i < data.length; i += 4 * 97) colors.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
        return colors.size > 2 ? 'dessiné' : 'vide';
      }),
    )
    .toBe('dessiné');
});

test('parcours tactile sans débordement horizontal', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'parcours tactile testé sur mobile');
  await page.goto('/');
  await noHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Jouer' }).tap();
  await tapUntilResult(page);
  await expect(page.getByTestId('score')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Défier un ami' })).toBeInViewport();
  await noHorizontalOverflow(page);
});

test('marteler Espace à la fin ne relance pas la partie par accident', async ({ page, isMobile }) => {
  test.skip(isMobile, 'clavier testé sur desktop');
  await page.goto('/');
  await page.keyboard.press('Enter');
  const done = page.getByRole('heading', { name: 'Partie terminée' });
  for (let i = 0; i < 60 && !(await done.isVisible()); i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(30);
  }
  await expect(done).toBeVisible({ timeout: 5_000 });
  for (let i = 0; i < 4; i++) await page.keyboard.press('Space'); // dans le délai de garde
  await expect(done).toBeVisible();
  expect((await metrics(page)).map((e) => e.name)).not.toContain('retry');
});
