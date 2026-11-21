import { expect, test, type Page } from '@playwright/test';
import { lastScore, metrics, noHorizontalOverflow, tapUntilResult, trackErrors } from './helpers';

// Vrai moteur : le score n'est pas prévisible, mais le premier étage ne peut pas être raté
// (src/game/core/README.md), donc toute partie vaut au moins 1 et bat un défi annoncé à 0.
const CHALLENGE = '/?v=1&seed=4242&target=0';

/** Hauteur affichée au résultat, en étages (la cible du lien), pas les points. */
const floorsShown = async (page: Page) => Number.parseInt((await page.getByTestId('score').textContent()) ?? '', 10);

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
  await expect(page.getByTestId('challenge-outcome')).toHaveText(`Défi relevé : ${score} contre 0 !`);
  await expect(page.getByTestId('new-record')).toBeVisible();
  const names = (await metrics(page)).map((e) => e.name);
  expect(names).toEqual(['session_start', 'challenge_open', 'run_start', 'first_placement', 'run_end']);
  expect((await metrics(page)).find((e) => e.name === 'run_end')).toMatchObject({ mode: 'challenge' });

  await page.goto('/');
  await expect(page.getByTestId('record')).toHaveText(`Record : ${floors}`);
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
  await expect(page.getByTestId('share-status')).toHaveText('Lien du défi copié. Colle-le dans un message !');
  const [link] = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied);
  expect(link).toMatch(/\?v=3&seed=\d+&target=\d+$/); // partie v3 (V5) : lien v3, cible en étages
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

test('partage natif sur téléphone : appelé pendant le geste, lien seul, ouvre le bon défi chez l’ami', async ({ page, browser }) => {
  await page.addInitScript(() => {
    // Comme Chrome Android et Safari : refusé hors activation utilisateur.
    const calls: { active: boolean; data: Record<string, unknown> }[] = [];
    Object.defineProperty(window, '__shares', { value: calls });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: Record<string, unknown>) => {
        calls.push({ active: navigator.userActivation.isActive, data });
        if (!navigator.userActivation.isActive) throw new DOMException('geste requis', 'NotAllowedError');
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Jouer', exact: true }).tap();
  await tapUntilResult(page);
  const score = await floorsShown(page);
  await page.getByRole('button', { name: 'Défier un ami' }).tap();
  await expect(page.getByTestId('share-status')).toHaveText('Défi envoyé.');
  const calls = await page.evaluate(() => (window as unknown as { __shares: { active: boolean; data: Record<string, unknown> }[] }).__shares);
  expect(calls).toHaveLength(1);
  expect(calls[0]!.active).toBe(true);
  expect(Object.keys(calls[0]!.data).sort()).toEqual(['text', 'title', 'url']); // aucune image : le lien n'est pas perdu
  const link = String(calls[0]!.data.url);
  expect(link).toMatch(new RegExp(`/\\?v=3&seed=\\d+&target=${score}$`));
  const seed = new URL(link).searchParams.get('seed');

  // L'ami ouvre le lien : bon score à battre, même partie, mêmes règles (son lien de retour le prouve).
  const other = await browser.newContext({ hasTouch: true, isMobile: true });
  await other.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const copied: string[] = [];
    Object.defineProperty(window, '__copied', { value: copied });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => void copied.push(t) } });
  });
  const friend = await other.newPage();
  await friend.goto(link);
  await expect(friend.getByTestId('challenge-invite')).toContainText(`Dépasse ${score} étage`);
  await friend.getByRole('button', { name: 'Relever le défi' }).tap();
  await expect(friend.getByTestId('target')).toBeVisible();
  await tapUntilResult(friend);
  const friendScore = await floorsShown(friend);
  await friend.getByRole('button', { name: 'Copier le lien' }).tap();
  await expect(friend.getByTestId('share-status')).toHaveText('Lien du défi copié. Colle-le dans un message !');
  const [back] = await friend.evaluate(() => (window as unknown as { __copied: string[] }).__copied);
  expect(back).toMatch(new RegExp(`/\\?v=3&seed=${seed}&target=${friendScore}$`));
  await other.close();
});

test('« Copier le lien » sans presse-papiers : lien affiché, sélectionné, sans débordement', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
  });
  await page.goto('/?v=2&seed=4242&target=0');
  await page.getByRole('button', { name: 'Relever le défi' }).tap();
  await tapUntilResult(page);
  await page.getByRole('button', { name: 'Copier le lien' }).tap();
  const input = page.getByTestId('challenge-link');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(new RegExp(`/\\?v=2&seed=4242&target=${await floorsShown(page)}$`)); // ancien défi : règles v2 gardées
  await noHorizontalOverflow(page);
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
  await expect(page.getByTestId('share-status')).toHaveText('Partage annulé. Tu peux aussi copier le lien.');
  const names = (await metrics(page)).map((e) => e.name);
  expect(names).toContain('share_attempt');
  expect(names).not.toContain('share_success');
});

test('ni partage ni presse-papiers : lien affiché pour copie manuelle', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false }); // aucun repli de copie
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
  await expect(page.getByTestId('record')).toContainText('pas sauvegardé sur cet appareil');
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
  await expect(page.getByTestId('record')).toContainText('(pas sauvegardé sur cet appareil)');
});

test('le réglage du son survit au rechargement', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-settings').tap();
  const toggle = page.getByRole('switch', { name: 'Son' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.tap();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('volume')).toBeDisabled();
  await page.reload();
  await page.getByTestId('nav-settings').tap();
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-checked', 'false');
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

test('Défi du jour : seed de la date UTC, record du jour, missions affichées', async ({ page }) => {
  const { dailySeed, utcDateKey } = await import('../../src/platform/daily');
  await page.goto('/');
  const day = utcDateKey(new Date());
  await expect(page.getByTestId('daily-hint')).toHaveAttribute('data-day', day);
  await expect(page.getByTestId('daily-hint')).toContainText('nouveau à');
  await page.getByTestId('nav-season').tap();
  await page.getByRole('button', { name: 'Missions et cadeau' }).tap();
  await expect(page.getByTestId('goals').locator('li')).toHaveCount(3);
  await page.getByTestId('nav-home').tap();
  await page.getByRole('button', { name: 'Défi du jour' }).tap();
  const { dayInWords } = await import('../../src/game/render/card');
  await expect(page.getByTestId('target')).toHaveText(`Défi du jour · ${dayInWords(day)}`);
  await tapUntilResult(page);
  // Cible du lien = hauteur en étages (pas les points v2, qui comptent double les parfaits).
  const height = Number.parseInt((await page.getByTestId('score').textContent()) ?? '', 10);
  await expect(page.getByTestId('daily-outcome')).toHaveText('Nouveau record du Défi du jour !');
  const starts = (await metrics(page)).filter((e) => e.name === 'run_start');
  expect(starts.at(-1)).toMatchObject({ mode: 'daily', day });
  // Le lien de défi d'un Défi du jour porte la seed explicite du jour.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false }); // aucun repli de copie
  });
  await page.getByRole('button', { name: 'Défier un ami' }).tap();
  await expect(page.getByTestId('challenge-link')).toHaveValue(new RegExp(`seed=${dailySeed(day)}&target=${height}$`));
});

test('collection : onglet dédié, raretés et verrous lisibles, sans débordement', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-collection').tap();
  await expect(page.getByRole('heading', { name: 'Collection' })).toBeFocused();
  await expect(page.getByTestId('nav-collection')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('card-theme-orbital')).toContainText('À obtenir');
  await expect(page.getByTestId('card-skin-gomme')).toContainText('Équipé');
  await expect(page.getByTestId('card-skin-galaxie').locator('.rarity')).toHaveText('Légendaire');
  await noHorizontalOverflow(page);
  await page.getByTestId('nav-home').tap();
  await expect(page.getByTestId('play')).toBeVisible();
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
  await page.getByTestId('nav-collection').tap();
  await page.getByRole('button', { name: 'Équiper Matière Marbré' }).tap();
  await expect(page.getByTestId('card-skin-marbre')).toContainText('Équipé');
  await page.reload();
  await page.getByTestId('nav-collection').tap();
  await expect(page.getByTestId('card-skin-marbre')).toContainText('Équipé');
});

for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`bandeau d'objectif ${viewport.width}×${viewport.height} : au-dessus du jeu, ne cache ni le score ni les blocs`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto('/');
    await page.getByRole('button', { name: 'Défi du jour' }).tap();
    const pill = page.getByTestId('target');
    const canvas = page.getByTestId('game-canvas');
    await expect(pill).toBeVisible();
    const p = (await pill.boundingBox())!;
    const c = (await canvas.boundingBox())!;
    // V4 : bandeau hors du canvas (au-dessus) : rien de dessiné par le moteur n'est caché.
    expect(p.y + p.height).toBeLessThanOrEqual(c.y + 1);
    expect(c.height).toBeGreaterThan(viewport.height * 0.75);
    // Un toucher sur le jeu pose le premier bloc (impossible à rater).
    await page.waitForTimeout(150);
    await page.touchscreen.tap(c.x + c.width / 2, c.y + c.height / 2);
    await expect.poll(async () => (await metrics(page)).some((e) => e.name === 'first_placement')).toBe(true);
    await context.close();
  });
}

test('E1 : XP, pièces et récompense de connexion conservées après rechargement', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('coins')).toHaveText('0 pièce');
  await page.getByRole('button', { name: 'Jouer', exact: true }).tap();
  await tapUntilResult(page);
  await expect(page.getByTestId('gains')).toContainText('étoile');
  await page.getByRole('button', { name: 'Accueil' }).tap();
  await page.getByTestId('nav-season').tap();
  await page.getByRole('button', { name: 'Missions et cadeau' }).tap();
  await page.getByRole('button', { name: /^Récupérer \+10$/ }).tap();
  await expect(page.getByTestId('calendar')).toContainText('Déjà récupéré');
  const before = {
    coins: await page.getByTestId('coins').textContent(),
    xp: await page.getByTestId('xp').textContent(),
    level: await page.getByTestId('level').textContent(),
  };
  expect(before.coins).not.toBe('0 pièce');
  await page.reload();
  await expect(page.getByTestId('coins')).toHaveText(before.coins!);
  await expect(page.getByTestId('level')).toHaveText(before.level!);
  await page.getByTestId('nav-season').tap();
  await page.getByRole('button', { name: 'Missions et cadeau' }).tap();
  await expect(page.getByTestId('xp')).toHaveText(before.xp!);
  await expect(page.getByTestId('calendar')).toContainText('Déjà récupéré');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('poc:meta:v1:progress') ?? 'null'));
  expect(saved).toMatchObject({ version: 6, grants: ['v2-objectives-backfill'] });
});

test('E1 : deux onglets du même navigateur ne perdent ni gains ni réclamation', async ({ page, context }) => {
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/');
  await page.getByTestId('nav-season').tap();
  await page.getByRole('button', { name: 'Missions et cadeau' }).tap();
  await page.getByRole('button', { name: /^Récupérer \+10$/ }).tap();
  await expect(page.getByTestId('coins')).toHaveText('10 pièces');
  // Vrai événement storage : l'autre onglet se met à jour sans rechargement.
  await expect(other.getByTestId('coins')).toHaveText('10 pièces'); // accueil mis à jour par l'événement storage
  await other.getByTestId('nav-season').tap();
  await other.getByRole('button', { name: 'Missions et cadeau' }).tap();
  await expect(other.getByTestId('calendar')).toContainText('Déjà récupéré');
  await other.getByTestId('nav-home').tap();
  // Partie dans l'autre onglet : la réclamation du premier est conservée.
  await other.getByRole('button', { name: 'Jouer', exact: true }).tap();
  await tapUntilResult(other);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('poc:meta:v1:progress') ?? 'null'));
  expect(saved.calendar.lastClaimDate).not.toBeNull(); // réclamation de l'onglet 1 conservée
  expect(saved.coins).toBeGreaterThanOrEqual(10); // une partie courte peut rapporter 0 pièce
  expect(saved.xp).toBeGreaterThan(0); // mais toujours de l'XP (le 1er étage ne se rate pas)
  await other.close();
});

test('E1 : sous le vrai verrou Web Locks, un onglet concurrent ne perd pas la réclamation', async ({ page, context }) => {
  await context.addInitScript(() => {
    if (localStorage.getItem('poc:meta:v1:progress') === null) {
      localStorage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 2, coins: 0, xp: 0, grants: ['v2-objectives-backfill'] }));
    }
  });
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/');
  // L'autre onglet prend le verrou, lit, travaille 800 ms, puis écrit +100.
  await other.evaluate(() => {
    void navigator.locks.request('poc:meta:v1:progress', async () => {
      const doc = JSON.parse(localStorage.getItem('poc:meta:v1:progress')!);
      await new Promise((r) => setTimeout(r, 800));
      localStorage.setItem('poc:meta:v1:progress', JSON.stringify({ ...doc, coins: doc.coins + 100 }));
    });
  });
  await page.getByTestId('nav-season').tap();
  await page.getByRole('button', { name: 'Missions et cadeau' }).tap();
  await page.getByRole('button', { name: /^Récupérer \+10$/ }).tap(); // pendant que l'autre tient le verrou
  await expect(page.getByTestId('coins')).toHaveText('110 pièces');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('poc:meta:v1:progress')!));
  expect(saved).toMatchObject({ coins: 110 });
  expect(saved.calendar.lastClaimDate).not.toBeNull();
  await other.close();
});

test('A4 : aperçus de collection dessinés par le moteur, apparence appliquée à la partie', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 2, completed: ['floors-5', 'floors-12'], selected: { theme: 'orbital', skin: 'marbre' }, grants: ['v2-objectives-backfill'] }));
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto('/');
  await page.getByTestId('nav-collection').tap();
  const previews = page.locator('canvas.swatch.preview');
  await expect(previews).toHaveCount(43); // V8 : 30 matières et 13 univers, tous dessinés par le moteur
  const colorsPerPreview = await previews.evaluateAll((canvases) =>
    (canvases as HTMLCanvasElement[]).map((c) => {
      const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
      const set = new Set<number>();
      for (let i = 0; i < data.length; i += 4 * 13) set.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
      return set.size;
    }),
  );
  expect(colorsPerPreview.every((n) => n > 4)).toBe(true); // vrais dessins, pas des cadres vides
  await expect(page.getByTestId('card-theme-orbital')).toContainText('Équipé');
  await page.getByTestId('nav-home').tap();
  await page.getByRole('button', { name: 'Jouer', exact: true }).tap();
  await tapUntilResult(page);
  await expect(page.getByTestId('score')).toBeVisible();
});

for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }, { width: 844, height: 390 }]) {
  test(`menu V3 ${viewport.width}×${viewport.height} : Jouer et le menu visibles sans défiler`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Jouer', exact: true })).toBeInViewport({ ratio: 1 });
    for (const name of ['Défi du jour', 'Boutique', 'Collection', 'Classement', 'Passe', 'Réglages']) {
      await expect(page.getByRole('button', { name }).first()).toBeInViewport({ ratio: 1 });
    }
    await noHorizontalOverflow(page);
    await context.close();
  });
}

test('boutique : pièces du jeu distinctes de l’argent réel, prix dans les boutons, solde insuffisant', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-shop').tap();
  await expect(page.getByRole('heading', { name: 'Boutique' })).toBeFocused();
  await expect(page.getByTestId('wallet')).toContainText('0 pièce du jeu');
  await expect(page.getByTestId('wallet')).toContainText('ne s’achètent pas avec de l’argent réel');
  // Sans pièces : chaque bouton dit ce qui manque et ne peut pas être appuyé. V7 : les offres
  // changent chaque jour (sélection du jour), on vérifie donc celles qui sont affichées.
  const firstBuy = page.locator('[data-testid^="buy-"]:not([data-testid="buy-life"])').first();
  await expect(firstBuy).toHaveText(/^Il manque \d+$/);
  await expect(firstBuy).toBeDisabled();
  await expect(page.getByTestId('shop-section-theme').locator('.rarity').first()).toHaveText(/^(Commun|Rare|Épique|Légendaire)$/);
  await expect(page.getByTestId('shop-renewal')).toContainText('heure de ton appareil');
  await noHorizontalOverflow(page);
});

test('classement : sans serveur configuré (build Pages), « Indisponible » et jeu entier', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost') && !r.url().startsWith('http://127.0.0.1')) requests.push(r.url());
  });
  await page.goto('/');
  await page.getByTestId('nav-leaderboard').tap();
  await expect(page.getByRole('heading', { name: 'Classement' })).toBeFocused();
  await expect(page.getByTestId('board-unavailable')).toContainText('indisponible');
  await noHorizontalOverflow(page);
  await page.getByTestId('nav-home').tap();
  await page.getByRole('button', { name: 'Jouer', exact: true }).tap();
  await tapUntilResult(page);
  await expect(page.getByTestId('rank-status')).toHaveText('Score gardé sur cet appareil.');
  expect(requests).toEqual([]);
});

test('passe de saison : 30 niveaux lisibles sans débordement, premium détaillé mais pas en vente', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-season').tap();
  await expect(page.getByTestId('season-level')).toContainText('/ 30');
  await expect(page.locator('ol.tiers > li')).toHaveCount(30);
  await expect(page.getByTestId('premium-note')).toContainText('Argent réel');
  await expect(page.getByTestId('premium-note')).toContainText('rien n’est en vente');
  await expect(page.getByTestId('premium-soon')).toBeDisabled();
  await expect(page.getByTestId('tier-30-premium')).toContainText('Abysse');
  await expect(page.getByTestId('tier-30-premium')).toContainText('Premium');
  await noHorizontalOverflow(page);
});

test('sauvegarde V2 publiée : migrée en v3 sans perte (XP, pièces, objectifs, apparence)', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('poc:meta:v1:progress', JSON.stringify({
      version: 2, xp: 140, coins: 37, completed: ['floors-5'], grants: ['v2-objectives-backfill'],
      calendar: { lastClaimDate: '2026-11-10', cycle: 0, index: 2 },
    }));
  });
  await page.goto('/');
  await expect(page.getByTestId('coins')).toHaveText('37 pièces');
  await expect(page.getByTestId('level')).toHaveText('Niveau 3');
  await page.getByRole('button', { name: 'Jouer', exact: true }).tap();
  await tapUntilResult(page);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('poc:meta:v1:progress') ?? 'null'));
  expect(saved).toMatchObject({ version: 6, completed: expect.arrayContaining(['floors-5']) });
  expect(saved.xp).toBeGreaterThanOrEqual(140);
  expect(saved.coins).toBeGreaterThanOrEqual(37);
});

/** Polices larges (repli Android, runner CI) : la CI échouait à 320 px avec DejaVu Sans. */
for (const viewport of [{ width: 320, height: 568 }, { width: 412, height: 839 }, { width: 568, height: 320 }]) {
  test(`polices larges ${viewport.width}×${viewport.height} : aucun débordement, menu visible, aucun mot coupé`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = '*{font-family:"DejaVu Sans",Verdana,sans-serif !important}';
        document.head.append(s);
      });
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Jouer', exact: true })).toBeInViewport({ ratio: 1 });
    const tabs = await page.locator('.dock .dock-btn, .topbar .icon-btn:visible').all();
    expect(tabs.length).toBeGreaterThanOrEqual(5); // le contrôle porte bien sur les vrais boutons V4
    for (const tab of tabs) {
      await expect(tab).toBeInViewport({ ratio: 1 });
      // Un mot coupé ajoute une ligne : le texte de l'onglet tient sur une seule ligne.
      const lines = await tab.evaluate((b) => {
        const range = document.createRange();
        range.selectNodeContents(b.querySelector('.label') ?? b); // le texte seul (l'icône est au-dessus)
        return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
      });
      expect(lines).toBe(1);
    }
    await noHorizontalOverflow(page);
    for (const nav of await page.locator('.dock .dock-btn, .topbar .icon-btn:visible').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-testid')))) {
      await page.goto('/');
      await page.getByTestId(nav!).tap();
      await noHorizontalOverflow(page);
    }
    // Section Missions du passe (textes longs).
    await page.goto('/');
    await page.getByTestId('nav-season').tap();
    await page.getByRole('button', { name: 'Missions et cadeau' }).tap();
    await noHorizontalOverflow(page);
    await context.close();
  });
}

test('ancien lien de défi ?v=1 : toujours accepté et joué en règles v1', async ({ page }) => {
  await page.goto('/?v=1&seed=4242&target=6');
  await expect(page.getByTestId('challenge-invite')).toContainText('6 étages');
  await page.getByRole('button', { name: 'Relever le défi' }).tap();
  await tapUntilResult(page);
  await expect(page.getByTestId('challenge-outcome')).toBeVisible();
  await expect(page.getByTestId('points')).toHaveCount(0); // v1 : pas de points ×2
});

test('vie de reprise (build de production, vrai moteur) : achat en pièces, offre après la chute, décompte, vidéo indisponible', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('poc:meta:v1:progress', JSON.stringify({ version: 3, coins: 40, grants: ['v2-objectives-backfill'] }));
  });
  await page.goto('/');
  await expect(page.getByTestId('lives')).toHaveText('0 vie');
  await page.getByTestId('nav-shop').tap();
  await page.getByTestId('buy-life').tap();
  await page.getByTestId('confirm-life').tap();
  await expect(page.getByTestId('life-success')).toContainText('1 vie');
  await page.getByTestId('nav-home').tap();
  await expect(page.getByTestId('lives')).toHaveText('1 vie');
  await expect(page.getByTestId('coins')).toHaveText('10 pièces');

  await page.getByRole('button', { name: 'Jouer', exact: true }).tap();
  const box = (await page.getByTestId('game-canvas').boundingBox())!;
  const offer = page.getByTestId('revive');
  for (let i = 0; i < 400 && !(await offer.isVisible()); i++) {
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(i % 4 ? 90 : 400);
  }
  await expect(offer).toBeVisible();
  const life = page.getByTestId('revive-life');
  await expect(life).toHaveText('Utiliser une vie (1)');
  await expect(life).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('revive-ad-unavailable')).toHaveText('Vidéo indisponible');
  await expect(page.getByTestId('revive-ad-unavailable')).toBeDisabled();
  await expect(page.getByText('Mode démo')).toHaveCount(0);
  await noHorizontalOverflow(page);
  // V4 : délai de garde de 0,5 s (un appui en rafale au moment de la chute ne dépense rien).
  await expect(page.locator('[data-testid="revive"][data-input-ready="true"]')).toBeAttached();
  await life.tap();
  await expect(offer).toHaveCount(0);
  await expect(page.getByTestId('live')).toContainText('C’est reparti');
  // Après le compte à rebours, jouer jusqu'au second raté (définitif).
  await page.waitForTimeout(3200);
  await tapUntilResult(page);
  await expect(page.getByTestId('revived')).toContainText('reprise');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('poc:meta:v1:progress') ?? 'null'));
  expect(saved.lives ?? 0).toBe(0); // 0 vie : champ omis
  expect(saved.livesSpent).toHaveLength(1);
  expect(saved.coins).toBeGreaterThanOrEqual(10); // 40 − 30 + gains de la partie
  await page.reload();
  await expect(page.getByTestId('lives')).toHaveText('0 vie');
});
