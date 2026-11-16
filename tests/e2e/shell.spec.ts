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
  await expect(page.getByTestId('mock-banner')).toBeVisible();
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
