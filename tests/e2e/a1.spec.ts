import { expect, test } from '@playwright/test';
import { metrics, noHorizontalOverflow, tapUntilResult, trackErrors } from './helpers';

// Moteur simulé : score = seed % 5. Seed 4242 → 2 étages.
const CHALLENGE = '/?v=1&seed=4242&target=1';

let errors: string[] = [];
test.beforeEach(({ page, isMobile }) => {
  test.skip(!isMobile, 'A1 : parcours mobiles en priorité');
  errors = trackErrors(page);
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

test('défi par lien : même seed, comparaison, record persistant', async ({ page }) => {
  await page.goto(CHALLENGE);
  await expect(page.getByTestId('challenge-invite')).toContainText('1 étage');
  await page.getByRole('button', { name: 'Relever le défi' }).tap();
  await expect(page.getByTestId('target')).toBeVisible();
  await tapUntilResult(page);
  await expect(page.getByTestId('score')).toHaveText('2 étages');
  await expect(page.getByTestId('challenge-outcome')).toHaveText('Défi relevé : 2 contre 1 annoncés.');
  await expect(page.getByTestId('new-record')).toBeVisible();
  const names = (await metrics(page)).map((e) => e.name);
  expect(names).toEqual(['session_start', 'challenge_open', 'run_start', 'first_placement', 'run_end']);
  expect((await metrics(page)).find((e) => e.name === 'run_end')).toMatchObject({ mode: 'challenge', score: 2 });

  await page.goto('/');
  await expect(page.getByTestId('record')).toHaveText('Record sur cet appareil : 2 étages');
});

test('le lien partagé ouvre le même défi dans un autre navigateur', async ({ page, browser }) => {
  await page.addInitScript(() => {
    // Web Share absent : copie dans le presse-papiers (simulé pour lire la valeur).
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const copied: string[] = [];
    Object.defineProperty(window, '__copied', { value: copied });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (t: string) => void copied.push(t) },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Jouer' }).tap();
  await tapUntilResult(page);
  const score = Number.parseInt((await page.getByTestId('score').textContent()) ?? '', 10);
  await page.getByRole('button', { name: 'Défier un ami' }).tap();
  await expect(page.getByTestId('share-status')).toHaveText('Lien du défi copié.');
  const [link] = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied);
  expect(link).toMatch(/\?v=1&seed=\d+&target=\d+$/);
  const run = (await metrics(page)).find((e) => e.name === 'run_end');
  expect(link).toContain(`target=${score}`);
  expect((await metrics(page)).map((e) => e.name).slice(-2)).toEqual(['share_attempt', 'share_success']);
  expect(run).toBeDefined();

  // Autre contexte = autre navigateur : aucun stockage partagé.
  const other = await browser.newContext({ hasTouch: true, isMobile: true });
  const friend = await other.newPage();
  await friend.goto(link!);
  await expect(friend.getByTestId('challenge-invite')).toContainText(`${score} étage`);
  await expect(friend.getByTestId('record')).toContainText('0 étage');
  await other.close();
});

test('partage annulé : pas de succès compté', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        throw new DOMException('annulé', 'AbortError');
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Jouer' }).tap();
  await tapUntilResult(page);
  await page.getByRole('button', { name: 'Défier un ami' }).tap();
  await expect(page.getByTestId('share-status')).toHaveText('Partage annulé.');
  const names = (await metrics(page)).map((e) => e.name);
  expect(names).toContain('share_attempt');
  expect(names).not.toContain('share_success');
});

test('ni partage ni presse-papiers : lien affiché pour copie manuelle', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });
  await page.goto(CHALLENGE);
  await page.getByRole('button', { name: 'Relever le défi' }).tap();
  await tapUntilResult(page);
  await page.getByRole('button', { name: 'Défier un ami' }).tap();
  const input = page.getByTestId('challenge-link');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(/\/\?v=1&seed=4242&target=2$/);
  await noHorizontalOverflow(page);
});

test('lien invalide : message, aucun script injecté, nouvelle partie', async ({ page }) => {
  const evil = encodeURIComponent('<img src=x onerror="window.__pwned=1">');
  await page.goto(`/?v=1&seed=${evil}&target=3`);
  await expect(page.getByTestId('invalid-link')).toBeVisible();
  expect(await page.locator('img').count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  await page.getByRole('button', { name: 'Nouvelle partie' }).tap();
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
});

test('stockage bloqué : le jeu reste jouable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('bloqué', 'SecurityError');
      },
    });
  });
  await page.goto('/');
  await expect(page.getByTestId('record')).toContainText('sauvegarde indisponible');
  await page.getByRole('button', { name: 'Jouer' }).tap();
  await tapUntilResult(page);
  await page.getByRole('button', { name: 'Rejouer' }).tap();
  await expect(page.getByTestId('game-canvas')).toBeVisible();
});

test('stockage corrompu ou plein : le jeu reste jouable', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('poc:v1:best', '{pas du json');
    localStorage.setItem('poc:v1:prefs', '"muted"');
    Storage.prototype.setItem = () => {
      throw new DOMException('plein', 'QuotaExceededError');
    };
  });
  await page.goto(CHALLENGE);
  await expect(page.getByTestId('record')).toContainText('0 étage');
  await page.getByRole('button', { name: 'Relever le défi' }).tap();
  await tapUntilResult(page);
  await expect(page.getByTestId('new-record')).toBeVisible();
  await expect(page.getByTestId('record')).toContainText('2 étages (sauvegarde indisponible)');
});

test('le réglage du son survit au rechargement', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByTestId('sound-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.tap();
  await expect(toggle).toHaveText('Son : coupé');
  await page.reload();
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-pressed', 'false');
});

test('onglet caché : pause puis reprise explicite', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Jouer' }).tap();
  const setVisibility = (state: 'hidden' | 'visible') =>
    page.evaluate((s) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await setVisibility('hidden');
  await setVisibility('visible');
  const resume = page.getByRole('button', { name: 'Reprendre' });
  await expect(resume).toBeVisible();
  await expect(resume).toBeFocused();
  await resume.tap();
  await expect(page.getByTestId('pause')).toBeHidden();
  await tapUntilResult(page);
});
