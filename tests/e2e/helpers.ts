import { expect, type Page } from '@playwright/test';

export type Metric = { name: string; [key: string]: unknown };

export const metrics = (page: Page) =>
  page.evaluate(() => (window as unknown as { __metrics: Metric[] }).__metrics.map((e) => ({ ...e })));

/**
 * Joue jusqu'à l'écran de résultat. Ne suppose pas que onEnd arrive dans le geste :
 * le vrai moteur l'appelle END_DELAY_MS (650 ms) après le raté. Les appuis ne visent jamais
 * un élément qui peut être détaché (coordonnées ou clavier global).
 */
export async function playUntilResult(page: Page, place: () => Promise<void>, maxPresses = 40) {
  const done = page.getByRole('heading', { name: 'Partie terminée' });
  for (let i = 0; i < maxPresses; i++) {
    if (await done.isVisible()) return resultReady(page);
    await page.waitForTimeout(60); // laisse avancer au moins un tick
    if (await done.isVisible()) return resultReady(page);
    await place();
  }
  await expect(done).toBeVisible({ timeout: 5_000 });
  await resultReady(page);
}

/** Attend la fin du délai de garde de l'écran de résultat (boutons actifs). */
export const resultReady = (page: Page) =>
  expect(page.locator('[data-screen="result"][data-input-ready="true"]')).toBeAttached();

export async function tapUntilResult(page: Page) {
  const box = await page.getByTestId('game-canvas').boundingBox();
  if (!box) throw new Error('canvas invisible');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await playUntilResult(page, () => page.touchscreen.tap(x, y));
}

/** Collecte les erreurs JS et console de la page ; à vérifier en fin de test. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}
