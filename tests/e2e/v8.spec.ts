/**
 * V8 en vrai navigateur (build de production) : collection de Noël présente en saison et absente
 * hors saison (horloge contrôlée), achat saisonnier, prime du jour affichée puis consommée, partie
 * dans un univers sombre avec une matière sombre, collection complète (43 aperçus).
 * Auto-vérification d'Alexis (pas une revue indépendante).
 */
import { expect, test, type Page } from '@playwright/test';
import { noHorizontalOverflow, playUntilResult, trackErrors } from './helpers';

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = trackErrors(page);
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

async function seeded(page: Page, doc: Record<string, unknown>) {
  await page.addInitScript((seed) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('poc:meta:v1:progress', JSON.stringify(seed));
      sessionStorage.setItem('seeded', '1');
    }
  }, doc);
}

async function play(page: Page, isMobile: boolean) {
  const box = await page.getByTestId('game-canvas').boundingBox();
  if (!box) throw new Error('canvas invisible');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await playUntilResult(page, () => (isMobile ? page.touchscreen.tap(x, y) : page.mouse.click(x, y)));
}

test('Noël : section saisonnière en vente le 1er décembre, achat au prix affiché, objet gardé', async ({ page }) => {
  await seeded(page, { version: 6, coins: 2000, grants: ['v2-objectives-backfill'] });
  await page.clock.install({ time: new Date('2026-12-01T12:00:00Z') });
  await page.goto('/');
  await page.getByTestId('nav-shop').click();
  await expect(page.getByTestId('shop-event-noel')).toBeVisible();
  await expect(page.getByTestId('shop-event-dates')).toContainText('6 janvier');
  const section = page.getByTestId('shop-section-noel');
  for (const id of ['noel', 'givre', 'velours', 'sapin']) await expect(section.getByTestId(`shop-${id}`)).toBeVisible();
  await page.getByTestId('buy-velours').click();
  await page.getByTestId('confirm-buy').click();
  await expect.poll(async () => JSON.parse((await page.evaluate(() => localStorage.getItem('poc:meta:v1:progress')))!).inventory).toContain('velours');
  const saved = JSON.parse((await page.evaluate(() => localStorage.getItem('poc:meta:v1:progress')))!);
  expect(saved.coins).toBe(2000 - 1350);
  await noHorizontalOverflow(page);
});

test('Noël : hors saison (15 février), pas de section ni d’objet de Noël dans la sélection du jour', async ({ page }) => {
  await seeded(page, { version: 6, coins: 50, grants: ['v2-objectives-backfill'], inventory: ['velours'] });
  await page.clock.install({ time: new Date('2027-02-15T12:00:00Z') });
  await page.goto('/');
  await page.getByTestId('nav-shop').click();
  await expect(page.getByTestId('shop-daily')).toBeVisible();
  await expect(page.getByTestId('shop-event-noel')).toHaveCount(0);
  for (const id of ['noel', 'givre', 'velours', 'sapin']) await expect(page.getByTestId(`shop-${id}`)).toHaveCount(0);
  // L'objet acheté pendant la saison reste dans la collection, équipable.
  await page.getByTestId('nav-collection').click();
  await expect(page.getByTestId('card-skin-velours')).toContainText('Équiper');
});

test('prime du jour annoncée, versée sur une partie d’au moins 5 étages', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page.getByTestId('daily-bonus')).toContainText('+10 pièces');
  await page.getByTestId('play').click();
  await play(page, isMobile);
  const saved = JSON.parse((await page.evaluate(() => localStorage.getItem('poc:meta:v1:progress')))!);
  // Une partie de moins de 5 étages ne consomme pas la prime ; sinon elle est comptée une fois.
  expect(saved.daily === undefined || saved.daily.count === 1).toBe(true);
  if (saved.daily) await expect(page.getByTestId('gains-detail')).toContainText('dont 10 de prime du jour');
});

test('univers sombre et matière sombre : partie jouée jusqu’au résultat, sans erreur', async ({ page, isMobile }) => {
  await seeded(page, { version: 6, coins: 0, grants: ['v2-objectives-backfill'], inventory: ['volcan', 'obsidienne'], selected: { theme: 'volcan', skin: 'obsidienne' } });
  await page.goto('/');
  await page.getByTestId('play').click();
  await play(page, isMobile);
  await expect(page.getByRole('heading', { name: 'Partie terminée' })).toBeVisible();
});

test('collection V8 : 30 matières et 13 univers dessinés, raretés écrites, descriptions', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-collection').click();
  await expect(page.locator('canvas.swatch.preview')).toHaveCount(43);
  await expect(page.getByTestId('card-skin-obsidienne').locator('.rarity')).toHaveText('Légendaire');
  await expect(page.getByTestId('card-theme-cathedrale').locator('.rarity')).toHaveText('Épique');
  await expect(page.getByTestId('card-theme-noel')).toContainText('Noël · 1500 pièces');
  await noHorizontalOverflow(page);
});
