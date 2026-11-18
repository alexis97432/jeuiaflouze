import { expect, test, type Page } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * V5 (règles v3, rendu « Pop Choc ») en vrai Chromium : boosts, Fièvre, Bouclier, fin de partie,
 * animations réduites, mode Fluide, fuites. Auto-vérification (exception V5).
 * V5_CAPTURES=<dossier> : enregistre des séquences d'images (le mouvement s'observe en série).
 */
const URL = pathToFileURL(join(tmpdir(), 'flk-f1-harness', 'harness.html')).href;
const CAPTURES = process.env.V5_CAPTURES;
type Ev = { type: string; [k: string]: unknown };
const flk = (page: Page) => ({
  mount: (o: Record<string, unknown>) => page.evaluate((x) => (window as any).__flk.mount(x), o),
  pilot: (mode: 'align' | 'miss' | 'near' | 'edge', count = 1) => page.evaluate(([m, c]) => (window as any).__flk.pilot(m, c), [mode, count] as const),
  st: () => page.evaluate(() => (window as any).__flk.v2state()),
  fx: () => page.evaluate(() => (window as any).__flk.fx()),
  events: () => page.evaluate(() => (window as any).__flk.events() as Ev[]),
  ends: () => page.evaluate(() => (window as any).__flk.ends()),
  state: () => page.evaluate(() => (window as any).__flk.state()),
  destroy: () => page.evaluate(() => (window as any).__flk.destroy()),
  listeners: () => page.evaluate(() => (window as any).__flk.listeners()),
  pendingRaf: () => page.evaluate(() => (window as any).__flk.pendingRaf()),
  resetDraw: () => page.evaluate(() => (window as any).__flk.resetDrawStats()),
  draw: () => page.evaluate(() => (window as any).__flk.drawStats()),
  gag: (k: 'duck' | 'pigeon') => page.evaluate((x) => (window as any).__flk.forceGag(x), k),
  /** Série d'images (pas une capture isolée) pour juger le mouvement. */
  seq: async (name: string, frames = 6, every = 70) => {
    if (!CAPTURES) return;
    for (let i = 0; i < frames; i++) {
      await page.screenshot({ path: join(CAPTURES, `${name}-${String(i).padStart(2, '0')}.png`) });
      await page.waitForTimeout(every);
    }
  },
});

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

/** Parfaits jusqu'au boost demandé (au plus `max` poses). */
async function alignUntil(g: ReturnType<typeof flk>, boost: string, max = 30) {
  for (let i = 0; i < max; i++) {
    if ((await g.st()).bonus === boost) return;
    await g.pilot('align', 1);
  }
  throw new Error(`boost ${boost} non atteint`);
}

test('v3 : Fièvre au 5e parfait — mot « FIÈVRE ! », monde transformé, points × 2', async ({ page }) => {
  await page.goto(URL);
  const g = flk(page);
  await g.mount({ seed: 5, v3: true, sound: false, theme: 'confiserie' });
  await g.pilot('align', 4);
  expect((await g.st()).fever).toBe(false);
  await g.pilot('align', 1);
  const s = await g.st();
  expect(s.fever).toBe(true);
  expect(s.streak).toBe(5);
  expect((await g.fx()).words).toContain('FIÈVRE !');
  await g.seq('fievre-declenchement', 10, 80);
  await page.waitForTimeout(700);
  expect((await g.fx()).fever).toBeGreaterThan(0.6);
  const placements = (await g.events()).filter((e) => e.type === 'placement');
  expect(placements.at(-1)).toMatchObject({ fever: true, points: 4 });
  // Un parfait de plus : la Fièvre continue (onde de choc et vague dans la tour).
  await g.pilot('align', 1);
  await g.seq('fievre-parfait', 6, 60);
  expect((await g.st()).fever).toBe(true);
});

test('v3 : Ralenti (sillage), Aimant (collage « CLAC »), Bouclier (rattrapage) avec le vrai moteur', async ({ page }) => {
  await page.goto(URL);
  const g = flk(page);
  await g.mount({ seed: 7, v3: true, sound: false, theme: 'orbital' });
  // Deux poses aux extrémités : base étroite, un raté devient possible plus tard.
  await g.pilot('edge', 2);
  await alignUntil(g, 'ralenti');
  await page.waitForTimeout(400);
  expect((await g.fx()).boost).toBeGreaterThan(0.5);
  await g.seq('ralenti', 6, 90);
  await alignUntil(g, 'aimant');
  expect((await g.st()).tolerance).toBe(14000);
  await g.pilot('near', 1);
  const snapped = (await g.events()).filter((e) => e.type === 'placement').at(-1)!;
  expect(snapped).toMatchObject({ perfect: true, snapped: true });
  expect((await g.fx()).words.some((w: string) => ['CLAC !', 'CLIC !', 'ZIP !'].includes(w))).toBe(true);
  await g.seq('aimant-collage', 6, 60);
  await alignUntil(g, 'bouclier');
  await page.waitForTimeout(300);
  await g.seq('bouclier-actif', 3, 120);
  const before = await g.st();
  await g.pilot('miss');
  const after = await g.st();
  expect((await g.events()).some((e) => e.type === 'saved')).toBe(true);
  expect(after).toMatchObject({ status: 'countdown', countdownKind: 'save', saved: 1, bonus: null, stack: before.stack });
  expect((await g.fx()).words).toContain('BOING !');
  await g.seq('bouclier-rattrapage', 8, 60);
  await page.waitForTimeout(900);
  expect((await g.st()).status).toBe('running');
});

test('v3 : chute finale — « CRASH », recul de caméra, une seule fin, rien qui traîne après destroy', async ({ page }) => {
  await page.goto(URL);
  const g = flk(page);
  await g.mount({ seed: 3, v3: true, sound: false, theme: 'jardin' });
  await g.pilot('align', 6);
  await g.pilot('edge', 2);
  await g.pilot('miss');
  expect((await g.fx()).words.some((w: string) => ['CRASH !', 'BADABOUM !', 'PATATRAS !'].includes(w))).toBe(true);
  await g.seq('chute-recul', 12, 80);
  // Fin unique après END_DELAY_MS (1 s : chute et recul de caméra), avec ou sans captures.
  await expect.poll(async () => (await g.ends()).length, { timeout: 4000 }).toBe(1);
  const ends = await g.ends();
  expect(ends).toHaveLength(1);
  expect(ends[0]).toMatchObject({ rulesVersion: 3, verified: true });
  expect((await g.fx()).reveal).toBeGreaterThan(0.9);
  await g.destroy();
  expect(await g.listeners()).toEqual({});
  expect(await g.pendingRaf()).toBe(0);
});

test('absurdités (forcées pour la capture) : canard géant, pigeon qui s’envole au parfait', async ({ page }) => {
  await page.goto(URL);
  const g = flk(page);
  await g.mount({ seed: 11, v3: true, sound: false, theme: 'confiserie' });
  await g.pilot('align', 6);
  await g.gag('duck');
  await g.seq('canard', 8, 220);
  await g.gag('pigeon');
  await page.waitForTimeout(100);
  expect((await g.fx()).pigeon).toBe(true);
  await g.pilot('align', 1);
  await g.seq('pigeon-envol', 6, 80);
  await page.waitForTimeout(1500);
  expect((await g.fx()).pigeon).toBe(false);
});

test('animations réduites : aucune particule ni mouvement, ambiances immédiates, annonces lisibles', async ({ page }) => {
  await page.goto(URL);
  const g = flk(page);
  await g.mount({ seed: 5, v3: true, sound: false, reducedMotion: true });
  await g.pilot('align', 5);
  await page.waitForTimeout(50);
  const fx = await g.fx();
  expect(fx.particles).toBe(0);
  expect(fx.fever).toBe(1);
  expect(fx.words).toContain('FIÈVRE !');
  expect((await g.state()).sparks).toBe(0);
  await g.seq('mouvement-reduit-fievre', 2, 200);
});

test('mode Fluide : moitié des particules au plus, ambiance conservée', async ({ page }) => {
  await page.goto(URL);
  const g = flk(page);
  await g.mount({ seed: 5, v3: true, sound: false, effects: 'light' });
  let peak = 0;
  for (let i = 0; i < 8; i++) {
    await g.pilot('align', 1);
    peak = Math.max(peak, (await g.fx()).particles);
  }
  expect(peak).toBeLessThanOrEqual(32);
  expect((await g.st()).fever).toBe(true);
  await page.waitForTimeout(500);
  expect((await g.fx()).fever).toBeGreaterThan(0.5);
});

test('8 parties v3 enchaînées : pas d’écouteur ni de RAF restants, coût de dessin borné (mesure headless)', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(URL);
  const g = flk(page);
  await g.resetDraw();
  for (let i = 0; i < 8; i++) {
    await g.mount({ seed: 100 + i, v3: true, sound: false });
    await g.pilot('align', 6);
    await g.pilot('edge', 2);
    await g.pilot('miss');
    await page.waitForTimeout(1150);
  }
  await g.destroy();
  expect(await g.listeners()).toEqual({});
  expect(await g.pendingRaf()).toBe(0);
  const stats = await g.draw();
  console.log(`[mesure Chromium headless, conteneur cloud] draw() V5 : ${stats.n} images, médiane ${stats.median.toFixed(2)} ms, p95 ${stats.p95.toFixed(2)} ms`);
  expect(stats.p95).toBeLessThan(16);
  expect((await g.ends())).toHaveLength(8);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`onomatopées ${viewport.width}×${viewport.height} : jamais sur la zone de pose ni sur le HUD`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(URL);
    const g = flk(page);
    await g.mount({ seed: 5, v3: true, sound: false });
    let checked = 0;
    for (let i = 0; i < 7; i++) {
      await g.pilot('align', 1);
      const fx = await g.fx();
      for (let k = 0; k < fx.boxes.length; k++) {
        const b = fx.boxes[k];
        const landscape = fx.fieldLeft > 150;
        if (landscape) {
          const half = (b.size * fx.words[k].length * 0.62) / 2;
          expect(b.x + half < fx.fieldLeft || b.x - half > fx.fieldRight, `${fx.words[k]} à côté de la tour`).toBe(true);
        } else {
          expect(b.y + b.size * 0.65, `${fx.words[k]} au-dessus du bloc mobile`).toBeLessThanOrEqual(fx.activeTop);
          expect(b.y - b.size * 0.65, `${fx.words[k]} sous le HUD`).toBeGreaterThanOrEqual(fx.hudBottom - 4);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(3);
    await g.seq(`mots-${viewport.width}x${viewport.height}`, 2, 120);
  });
}
