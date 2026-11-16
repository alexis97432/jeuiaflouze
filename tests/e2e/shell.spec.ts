import { expect, test, type Page } from '@playwright/test';

/** Joue avec le moteur simulé jusqu'à l'écran de résultat (≤ 5 placements). */
async function playUntilResult(page: Page, place: () => Promise<void>) {
  for (let i = 0; i < 10; i++) {
    if (await page.getByRole('heading', { name: 'Partie terminée' }).isVisible()) return;
    await page.waitForTimeout(60); // laisse avancer au moins un tick
    await place();
  }
  await expect(page.getByRole('heading', { name: 'Partie terminée' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  (page as Page & { errors: string[] }).errors = errors;
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { errors: string[] }).errors).toEqual([]);
});

test('parcours complet au clavier', async ({ page, isMobile }) => {
  test.skip(isMobile, 'parcours clavier testé sur desktop');
  await page.goto('/');
  await expect(page.getByTestId('mock-banner')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jouer' })).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('game-canvas')).toBeFocused();
  await playUntilResult(page, () => page.keyboard.press('Space'));

  await expect(page.getByText('Score local, non vérifié.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rejouer' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('game-canvas')).toBeVisible();

  const names = await page.evaluate(() =>
    (window as unknown as { __metrics: { name: string }[] }).__metrics.map((e) => e.name),
  );
  expect(names).toEqual(['session_start', 'run_start', 'run_end', 'retry', 'run_start']);
});

test('parcours tactile sans débordement horizontal', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'parcours tactile testé sur mobile');
  await page.goto('/');
  await page.getByRole('button', { name: 'Jouer' }).tap();
  const canvas = page.getByTestId('game-canvas');
  await playUntilResult(page, () => canvas.tap());
  await expect(page.getByTestId('score')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test('reste utilisable à 320 px de large', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  const play = page.getByRole('button', { name: 'Jouer' });
  await expect(play).toBeInViewport();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
