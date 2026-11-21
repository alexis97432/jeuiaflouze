/**
 * V7 en vrai navigateur (build de production) : un seul contexte audio sur plusieurs parties,
 * écoute d'une musique arrêtée en quittant l'écran, réglages audio gardés, musique suspendue en
 * arrière-plan, sélection du jour stable puis renouvelée à minuit UTC (horloge contrôlée), achat à
 * la frontière de deux jours, journal de diagnostic après un rechargement pendant une partie.
 * Auto-vérification d'Alexis (pas une revue indépendante). Aucune écoute humaine : seuls les états
 * techniques (contexte, sources, boutons) sont vérifiés.
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

/** Joue jusqu'au résultat : toucher sur mobile, clic sur ordinateur. */
async function play(page: Page, isMobile: boolean) {
  const box = await page.getByTestId('game-canvas').boundingBox();
  if (!box) throw new Error('canvas invisible');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await playUntilResult(page, () => (isMobile ? page.touchscreen.tap(x, y) : page.mouse.click(x, y)));
}

const RICH = { version: 6, coins: 2000, xp: 260, grants: ['v2-objectives-backfill'] };
async function seeded(page: Page, doc: Record<string, unknown> = RICH) {
  await page.addInitScript((seed) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('poc:meta:v1:progress', JSON.stringify(seed));
      sessionStorage.setItem('seeded', '1');
    }
  }, doc);
}

test('un seul contexte audio pour trois parties ; écoute en boutique arrêtée en changeant d’écran', async ({ page, isMobile }) => {
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
  await play(page, isMobile);
  for (let k = 0; k < 2; k++) {
    await page.getByTestId('retry').click();
    await play(page, isMobile);
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
  // V8 : seules les sections de la sélection du jour (la collection de Noël a sa section à part).
  const offers = () => page.locator('[data-testid="shop-section-skin"] li[data-testid^="shop-"], [data-testid="shop-section-theme"] li[data-testid^="shop-"], [data-testid="shop-section-music"] li[data-testid^="shop-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')).filter((id) => id && !['shop-lives', 'shop-empty'].includes(id)));
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
  await seeded(page, { ...RICH, coins: 10_000 });
  await page.clock.install({ time: new Date('2026-12-03T23:59:00Z') });
  await page.goto('/');
  await page.getByTestId('nav-shop').click();
  // Une offre de la sélection du jour (pas la collection de Noël, encore en vente le lendemain).
  const buy = page.getByTestId('shop-section-skin').locator('[data-testid^="buy-"]').first();
  await buy.click();
  await expect(page.getByTestId('confirm')).toBeVisible();
  await page.clock.fastForward('07:00'); // minuit + 6 min : l'offre a expiré
  await page.getByTestId('confirm-buy').click();
  await expect(page.getByTestId('shop-expired')).toContainText('Rien n’a été débité');
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('poc:meta:v1:progress')))!).coins).toBe(10_000);
});

test('diagnostic : une partie interrompue par un rechargement est notée, le rapport se copie', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByTestId('play').click();
  // Pendant la partie, le battement de cœur est écrit (partie en cours, onglet visible).
  const live = await page.evaluate(() => JSON.parse(localStorage.getItem('poc:diag:v1:session') ?? 'null'));
  expect(live).toMatchObject({ visible: true, closed: false, info: { mode: 'free' } });
  await page.getByTestId('pause-button').click();
  await page.getByTestId('quit').click();
  // Plantage simulé : la page redémarre alors qu'une partie était ouverte et visible, sans
  // fermeture propre (un vrai plantage n'envoie aucun événement de fermeture).
  await page.evaluate(() => {
    const now = Date.now();
    localStorage.setItem('poc:diag:v1:session', JSON.stringify({ start: now - 40_000, beat: now - 3_000, visible: true, closed: false, info: { mode: 'free', theme: 'cite', skin: 'galaxie', floor: 18 } }));
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
