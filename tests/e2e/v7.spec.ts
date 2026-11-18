/**
 * V7 en vrai navigateur (build de production) : un seul contexte audio sur plusieurs parties,
 * écoute d'une musique arrêtée en quittant l'écran, réglages audio gardés, musique suspendue en
 * arrière-plan, sélection du jour stable puis renouvelée à minuit UTC (horloge contrôlée), achat à
 * la frontière de deux jours, journal de diagnostic après un rechargement pendant une partie.
 * Auto-vérification d'Alexis (pas une revue indépendante). Aucune écoute humaine : seuls les états
 * techniques (contexte, sources, boutons) sont vérifiés.
 */
import { expect, test, type Page } from '@playwright/test';
import { noHorizontalOverflow, tapUntilResult, trackErrors } from './helpers';

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = trackErrors(page);
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

/** Compte les contextes audio créés et garde le dernier (état : suspendu, actif). */
async function watchAudio(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { AudioContext: typeof AudioContext; __audio: { created: number; last: AudioContext | null } };
    const Base = w.AudioContext;
    w.__audio = { created: 0, last: null };
    w.AudioContext = class extends Base {
      constructor(o?: AudioContextOptions) {
        super(o);
        w.__audio.created++;
        w.__audio.last = this;
      }
    } as typeof AudioContext;
  });
}
const audio = (page: Page) => page.evaluate(() => {
  const a = (window as unknown as { __audio: { created: number; last: AudioContext | null } }).__audio;
  return { created: a.created, state: a.last?.state ?? 'none' };
});

const RICH = { version: 5, coins: 2000, xp: 260, grants: ['v2-objectives-backfill'] };
async function seeded(page: Page, doc: Record<string, unknown> = RICH) {
  await page.addInitScript((seed) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('poc:meta:v1:progress', JSON.stringify(seed));
      sessionStorage.setItem('seeded', '1');
    }
  }, doc);
}

test('un seul contexte audio pour trois parties ; écoute en boutique arrêtée en changeant d’écran', async ({ page }) => {
  await watchAudio(page);
  await page.goto('/');
  await page.getByTestId('nav-shop').click();
  const listen = page.locator('button[data-listen]').first();
  await expect(listen).toHaveText('Écouter');
  await listen.click();
  await expect(page.locator('button[data-listen][aria-pressed="true"]')).toHaveText(/Arrêter|Chargement…/);
  await expect(page.locator('button[data-listen][aria-pressed="true"]')).toHaveText('Arrêter', { timeout: 15_000 });
  await page.getByTestId('nav-collection').click();
  await expect(page.locator('button[data-listen][aria-pressed="true"]')).toHaveCount(0);
  await page.getByTestId('nav-home').click();
  await page.getByTestId('play').click();
  await tapUntilResult(page);
  for (let k = 0; k < 2; k++) {
    await page.getByTestId('retry').click();
    await tapUntilResult(page);
  }
  expect((await audio(page)).created).toBe(1);
});

test('réglages audio : musique et effets indépendants, gardés au rechargement', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-settings').click();
  await expect(page.getByTestId('music-toggle')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('music-toggle').click();
  await page.getByTestId('music-source-equipee').click();
  await expect(page.getByTestId('music-volume')).toBeDisabled();
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await page.getByTestId('nav-settings').click();
  await expect(page.getByTestId('music-toggle')).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('music-source-equipee')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-checked', 'true');
  await noHorizontalOverflow(page);
});

test('arrière-plan : le contexte audio est suspendu, puis repris au retour', async ({ page }) => {
  await watchAudio(page);
  await page.goto('/');
  await page.getByTestId('play').click();
  await expect.poll(async () => (await audio(page)).state).toBe('running');
  const setHidden = (hidden: boolean) => page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  await setHidden(true);
  await expect.poll(async () => (await audio(page)).state).toBe('suspended');
  await setHidden(false);
  await expect.poll(async () => (await audio(page)).state).toBe('running');
});

test('sélection du jour : stable dans la journée et après rechargement, renouvelée à minuit UTC sans rien donner', async ({ page }) => {
  await seeded(page, { version: 5, coins: 37, grants: ['v2-objectives-backfill'], inventory: ['graphite'] });
  await page.clock.install({ time: new Date('2026-12-03T23:58:00Z') });
  await page.goto('/');
  await page.getByTestId('nav-shop').click();
  const offers = () => page.locator('[data-testid^="shop-"].item, li[data-testid^="shop-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')).filter((id) => id && !['shop-lives', 'shop-empty'].includes(id)));
  const before = await offers();
  expect(before.length).toBe(6);
  await expect(page.getByTestId('shop-renewal')).toContainText('dans 2 min');
  await page.reload();
  await page.getByTestId('nav-shop').click();
  expect(await offers()).toEqual(before);
  const progress = await page.evaluate(() => localStorage.getItem('poc:meta:v1:progress'));
  await page.clock.fastForward('03:00');
  await expect(page.getByTestId('shop-renewed')).toHaveText('Nouvelle sélection du jour !');
  const after = await offers();
  expect(after).not.toEqual(before);
  expect(await page.evaluate(() => localStorage.getItem('poc:meta:v1:progress'))).toBe(progress);
});

test('achat ouvert à minuit UTC : au-delà du délai de grâce, refusé sans débit', async ({ page }) => {
  await seeded(page);
  await page.clock.install({ time: new Date('2026-12-03T23:59:00Z') });
  await page.goto('/');
  await page.getByTestId('nav-shop').click();
  const buy = page.locator('[data-testid^="buy-"]:not([data-testid="buy-life"])').first();
  await buy.click();
  await expect(page.getByTestId('confirm')).toBeVisible();
  await page.clock.fastForward('07:00'); // minuit + 6 min : l'offre a expiré
  await page.getByTestId('confirm-buy').click();
  await expect(page.getByTestId('shop-expired')).toContainText('Rien n’a été débité');
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('poc:meta:v1:progress')))!).coins).toBe(2000);
});

test('diagnostic : une partie interrompue par un rechargement est notée, le rapport se copie', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByTestId('play').click();
  // Rechargement brutal pendant la partie (pas de fin propre ni de fermeture de page).
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('poc:diag:v1:session')!);
    s.closed = false;
    localStorage.setItem('poc:diag:v1:session', JSON.stringify(s));
  });
  await page.evaluate(() => {
    window.addEventListener('pagehide', (e) => e.stopImmediatePropagation(), { capture: true });
  });
  await page.reload();
  await page.getByTestId('nav-settings').click();
  await expect(page.getByTestId('diag-summary')).toContainText(/\d+ incidents? enregistrés?/);
  await page.getByTestId('diag-copy').click();
  await expect(page.getByTestId('diag-status')).toContainText('Rapport copié');
  const report = await page.evaluate(() => navigator.clipboard.readText());
  expect(report).toContain('rechargement');
  expect(report).toContain('Stack or Crash — rapport de diagnostic local');
});
