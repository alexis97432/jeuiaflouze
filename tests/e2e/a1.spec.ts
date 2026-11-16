import { expect, test } from '@playwright/test';
import { lastScore, metrics, noHorizontalOverflow, tapUntilResult, trackErrors } from './helpers';

// Vrai moteur : le score n'est pas prévisible, mais le premier étage ne peut pas être raté
// (src/game/core/README.md), donc toute partie vaut au moins 1 et bat un défi annoncé à 0.
const CHALLENGE = '/?v=1&seed=4242&target=0';

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
  await expect(page.getByTestId('challenge-invite')).toContainText('0 étage');
  await page.getByRole('button', { name: 'Relever le défi' }).tap();
  await expect(page.getByTestId('target')).toBeVisible();
  await tapUntilResult(page);
  const score = await lastScore(page);
  expect(score).toBeGreaterThanOrEqual(1);
  const floors = `${score} étage${score > 1 ? 's' : ''}`;
  await expect(page.getByTestId('score')).toHaveText(floors);
  await expect(page.getByTestId('challenge-outcome')).toHaveText(`Défi relevé : ${score} contre 0 annoncés.`);
  await expect(page.getByTestId('new-record')).toBeVisible();
  const names = (await metrics(page)).map((e) => e.name);
  expect(names).toEqual(['session_start', 'challenge_open', 'run_start', 'first_placement', 'run_end']);
  expect((await metrics(page)).find((e) => e.name === 'run_end')).toMatchObject({ mode: 'challenge' });

  await page.goto('/');
  await expect(page.getByTestId('record')).toHaveText(`Record sur cet appareil : ${floors}`);
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
  await page.getByRole('button', { name: 'Jouer', exact: true }).tap();
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
  await page.getByRole('button', { name: 'Jouer', exact: true }).tap();
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
  await expect(input).toHaveValue(new RegExp(`/\\?v=1&seed=4242&target=${await lastScore(page)}$`));
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
  await page.getByRole('button', { name: 'Jouer', exact: true }).tap();
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
  await expect(page.getByTestId('record')).toContainText(`${await lastScore(page)} étage`);
  await expect(page.getByTestId('record')).toContainText('(sauvegarde indisponible)');
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
  await page.getByRole('button', { name: 'Jouer', exact: true }).tap();
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

test('Tour du jour : seed de la date UTC, record du jour, objectifs affichés', async ({ page }) => {
  const { dailySeed, utcDateKey } = await import('../../src/platform/daily');
  await page.goto('/');
  const day = utcDateKey(new Date());
  await expect(page.getByTestId('daily-hint')).toHaveAttribute('data-day', day);
  await expect(page.getByTestId('daily-next')).toContainText('heure locale');
  await expect(page.getByTestId('goals').locator('li')).toHaveCount(3);
  await page.getByRole('button', { name: 'Jouer la tour du jour' }).tap();
  await expect(page.getByTestId('target')).toContainText(`Tour du jour · ${day}`);
  await tapUntilResult(page);
  const score = await lastScore(page);
  await expect(page.getByTestId('daily-outcome')).toHaveText(`Nouveau record du jour (${day}) !`);
  const starts = (await metrics(page)).filter((e) => e.name === 'run_start');
  expect(starts.at(-1)).toMatchObject({ mode: 'daily', day });
  // Le lien de défi d'une Tour du jour porte la seed explicite du jour.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });
  await page.getByRole('button', { name: 'Défier un ami' }).tap();
  await expect(page.getByTestId('challenge-link')).toHaveValue(new RegExp(`seed=${dailySeed(day)}&target=${score}$`));
});

test('collection : ouverture, verrous lisibles, retour, sans débordement', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-collection').tap();
  await expect(page.getByRole('heading', { name: 'Collection' })).toBeFocused();
  await expect(page.getByTestId('card-theme-orbital')).toContainText('À débloquer');
  await expect(page.getByTestId('card-skin-gomme')).toContainText('Sélectionné');
  await noHorizontalOverflow(page);
  await page.getByTestId('collection-back').tap();
  await expect(page.getByTestId('open-collection')).toBeFocused();
});

test('progression : un objectif rempli débloque une apparence choisie et persistante', async ({ page }) => {
  // Progression préparée : seul « 5 étages » reste à faire parmi les actifs simulés n'est pas
  // garanti avec le vrai moteur ; on prépare donc un déblocage déjà acquis pour tester le choix.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('poc:meta:v1:progress', JSON.stringify({ completed: ['floors-5'], selected: { theme: 'confiserie', skin: 'gomme' }, evaluatedRuns: [] }));
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto('/');
  await page.getByTestId('open-collection').tap();
  await page.getByRole('button', { name: 'Choisir Apparence Marbré' }).tap();
  await expect(page.getByTestId('card-skin-marbre')).toContainText('Sélectionné');
  await page.reload();
  await page.getByTestId('open-collection').tap();
  await expect(page.getByTestId('card-skin-marbre')).toContainText('Sélectionné');
});
