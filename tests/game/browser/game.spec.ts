import { expect, test, type Page } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const URL = pathToFileURL(join(tmpdir(), 'flk-f1-harness', 'harness.html')).href;
type State = {
  tick: number; score: number; status: string; frames: number; pause: string; debris: number; sparks: number;
  backing: { width: number; height: number; dpr: number }; audio: string; destroyed: boolean; endReported: boolean;
  inputTicks: number[]; perfectCount: number; reducedMotion: boolean;
};

const state = (page: Page) => page.evaluate(() => (window as any).__flk.state() as State);
const mount = (page: Page, opts: Record<string, unknown> = {}) => page.evaluate((o) => (window as any).__flk.mount(o), opts);
const waitTicks = async (page: Page, n: number) => {
  const t0 = (await state(page)).tick;
  await expect.poll(async () => (await state(page)).tick, { timeout: 5000 }).toBeGreaterThanOrEqual(t0 + n);
};

async function open(page: Page, opts: Record<string, unknown> = {}) {
  await page.goto(URL);
  await mount(page, opts);
  await waitTicks(page, 3);
}

test.describe('canvas : DPR et redimensionnement', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

  test('résolution interne = taille CSS × DPR, recalculée au redimensionnement', async ({ page }) => {
    await open(page);
    expect((await state(page)).backing).toEqual({ width: 780, height: 1688, dpr: 2 });
    await page.setViewportSize({ width: 500, height: 700 });
    await expect.poll(async () => (await state(page)).backing).toEqual({ width: 1000, height: 1400, dpr: 2 });
  });
});

test.describe('entrées tactiles', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

  test('un toucher = exactement une pose (pas de doublon par les événements souris émulés)', async ({ page }) => {
    await open(page);
    for (let i = 1; i <= 3; i++) {
      await page.touchscreen.tap(195, 500);
      await expect.poll(async () => (await state(page)).inputTicks.length).toBe(i);
      await page.waitForTimeout(250);
      expect((await state(page)).inputTicks.length).toBe(i);
    }
    // Les touchers tombent selon le minutage : le 3e étage peut être raté si les deux
    // premières poses ont beaucoup rogné la base. Ce test prouve « une entrée par toucher »,
    // pas un score : 3 poses, ou 2 poses + 1 raté (échec isolé observé une fois avant ce correctif).
    const s = await state(page);
    expect(s.score + (s.status === 'ended' ? 1 : 0)).toBe(3);
    expect(await page.evaluate(() => (window as any).__flk.touchAction())).toBe('none'); // restauré seulement au destroy
  });
});

test.describe('souris et clavier', () => {
  test('clic gauche = une pose, clic droit ignoré', async ({ page }) => {
    await open(page);
    await page.mouse.click(400, 400, { button: 'right' });
    await page.waitForTimeout(150);
    expect((await state(page)).inputTicks).toEqual([]);
    await page.mouse.click(400, 400);
    await expect.poll(async () => (await state(page)).inputTicks.length).toBe(1);
  });

  test('espace pose sans activer le bouton DOM focalisé ; répétition ignorée ; rendu au DOM après la fin', async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      (window as any).btnClicks = 0;
      document.getElementById('btn')!.addEventListener('click', () => { (window as any).btnClicks++; });
    });
    await page.focus('#btn');
    await page.keyboard.press('Space');
    await expect.poll(async () => (await state(page)).inputTicks.length).toBe(1);
    // Maintien : keydown répétés (repeat = true) → une seule pose.
    await page.keyboard.down('Space');
    await page.keyboard.down('Space');
    await page.keyboard.down('Space');
    await page.keyboard.up('Space');
    await page.waitForTimeout(200);
    expect((await state(page)).inputTicks.length).toBe(2);
    expect(await page.evaluate(() => (window as any).btnClicks)).toBe(0);
    // Après la fin, l'espace active de nouveau le bouton focalisé.
    await page.evaluate(() => (window as any).__flk.autoplayToMiss());
    await page.focus('#btn');
    await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => (window as any).btnClicks)).toBe(1);
  });
});

test.describe('boucle complète', () => {
  test('jouer jusqu’au raté : onEnd une seule fois, résultat rejouable, RAF arrêté ensuite', async ({ page }) => {
    await open(page, { seed: 4242 });
    await page.evaluate(() => (window as any).__flk.autoplayToMiss());
    const s = await state(page);
    expect(s.status).toBe('ended');
    expect(s.endReported).toBe(false); // onEnd attend END_DELAY_MS
    await expect.poll(async () => (await page.evaluate(() => (window as any).__flk.ends())).length).toBe(1);
    await page.waitForTimeout(1500);
    const ends = await page.evaluate(() => (window as any).__flk.ends());
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ seed: 4242, rulesVersion: 1, score: s.score, verified: true });
    expect(ends[0].inputTicks).toEqual(s.inputTicks);
    // onEvent : une entrée par pose, puis un raté, dans l'ordre des ticks.
    const events = await page.evaluate(() => (window as any).__flk.events());
    expect(events.map((e: { tick: number }) => e.tick)).toEqual(s.inputTicks);
    expect(events.at(-1)).toMatchObject({ type: 'miss', floor: s.score + 1 });
    expect(events.slice(0, -1).every((e: { type: string }) => e.type === 'placement')).toBe(true);
    await expect.poll(() => page.evaluate(() => (window as any).__flk.pendingRaf()), { timeout: 5000 }).toBe(0);
  });

  test('longue série : 20 poses, effets bornés, rejeu valide', async ({ page }) => {
    await open(page, { seed: 77 });
    await page.evaluate(() => (window as any).__flk.resetDrawStats());
    let maxSparks = 0;
    let maxDebris = 0;
    const play = page.evaluate(() => (window as any).__flk.autoplay(20, 3000));
    let done = false;
    void play.then(() => { done = true; });
    while (!done) {
      const s = await state(page);
      maxSparks = Math.max(maxSparks, s.sparks);
      maxDebris = Math.max(maxDebris, s.debris);
      await page.waitForTimeout(30);
    }
    const s = await state(page);
    expect(s.score).toBeGreaterThanOrEqual(20);
    expect(s.perfectCount).toBeGreaterThan(0);
    expect(maxSparks).toBeGreaterThan(0);
    expect(maxSparks).toBeLessThanOrEqual(48);
    expect(maxDebris).toBeLessThanOrEqual(16);
    const stats = await page.evaluate(() => (window as any).__flk.drawStats());
    console.info(`[mesure Chromium headless, conteneur cloud] draw() : ${stats.n} images, médiane ${stats.median.toFixed(3)} ms, p95 ${stats.p95.toFixed(3)} ms`);
    await page.evaluate(() => (window as any).__flk.autoplayToMiss());
    await expect.poll(async () => (await page.evaluate(() => (window as any).__flk.ends())).length).toBe(1);
    expect((await page.evaluate(() => (window as any).__flk.ends()))[0].verified).toBe(true);
  });
});

test.describe('pause et visibilité', () => {
  test('pause()/resume() : temps gelé, appuis ignorés, reprise sans saut', async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as any).__flk.pause());
    const frozen = (await state(page)).tick;
    await page.mouse.click(400, 400);
    await page.waitForTimeout(500);
    let s = await state(page);
    expect(s.tick).toBe(frozen);
    expect(s.inputTicks).toEqual([]);
    expect(s.pause).toBe('shell');
    expect(await page.evaluate(() => (window as any).__flk.pendingRaf())).toBe(0);
    await page.evaluate(() => (window as any).__flk.resume());
    await page.waitForTimeout(100);
    s = await state(page);
    expect(s.tick).toBeGreaterThan(frozen);
    expect(s.tick - frozen).toBeLessThan(40); // ~12 ticks attendus pour 100 ms, pas 60+ de rattrapage
  });

  test('onglet caché : pause automatique ; au retour, toucher reprend sans poser', async ({ page }) => {
    await open(page);
    const setHidden = (hidden: boolean) => page.evaluate((h) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
    await setHidden(true);
    const frozen = (await state(page)).tick;
    await page.waitForTimeout(400);
    expect((await state(page)).tick).toBe(frozen);
    expect((await state(page)).pause).toBe('hidden');
    await setHidden(false);
    await page.waitForTimeout(200);
    expect((await state(page)).tick).toBe(frozen); // reprise explicite, pas automatique
    await page.mouse.click(400, 400);
    await page.waitForTimeout(120);
    const s = await state(page);
    expect(s.pause).toBe('none');
    expect(s.inputTicks).toEqual([]);
    expect(s.tick - frozen).toBeLessThan(40);
  });
});

test.describe('cycle de vie', () => {
  test('25 montages/destructions : aucun écouteur ni RAF restant, audio fermé, touch-action restauré', async ({ page }) => {
    await page.goto(URL);
    const baseline = await page.evaluate(() => (window as any).__flk.listeners());
    for (let i = 0; i < 25; i++) {
      await mount(page, { seed: i + 1 });
      if (i % 5 === 0) await page.mouse.click(400, 400);
    }
    await page.mouse.click(400, 400); // geste → contexte audio du dernier montage
    expect(await page.evaluate(() => (window as any).__flk.holdAudio())).not.toBe('none');
    await page.evaluate(() => (window as any).__flk.destroy());
    const framesAfter = (await state(page)).frames;
    await page.waitForTimeout(300);
    const s = await state(page);
    expect(s.destroyed).toBe(true);
    expect(s.frames).toBe(framesAfter);
    expect(await page.evaluate(() => (window as any).__flk.pendingRaf())).toBe(0);
    expect(await page.evaluate(() => (window as any).__flk.listeners())).toEqual(baseline);
    expect(await page.evaluate(() => (window as any).__flk.touchAction())).toBe('');
    await expect.poll(() => page.evaluate(() => (window as any).__flk.heldAudioState())).toBe('closed');
    // Appui après destroy : aucun effet.
    await page.mouse.click(400, 400);
    expect((await state(page)).inputTicks.length).toBe(s.inputTicks.length);
  });

  test('audio créé seulement après un geste ; jamais si sound:false', async ({ page }) => {
    await open(page);
    expect((await state(page)).audio).toBe('none');
    await page.mouse.click(400, 400);
    await expect.poll(async () => (await state(page)).audio).not.toBe('none');
    await mount(page, { sound: false });
    await page.mouse.click(400, 400);
    await page.waitForTimeout(100);
    expect((await state(page)).audio).toBe('none');
  });

  test('Canvas 2D indisponible : erreur synchrone, aucun écouteur laissé', async ({ page }) => {
    await page.goto(URL);
    const before = await page.evaluate(() => (window as any).__flk.listeners());
    expect(await page.evaluate(() => (window as any).__flk.mountWithoutContext())).toContain('Canvas 2D indisponible');
    expect(await page.evaluate(() => (window as any).__flk.listeners())).toEqual(before);
    expect(await page.evaluate(() => (window as any).__flk.pendingRaf())).toBe(0);
  });

  test('config invalide : mount lève une erreur explicite', async ({ page }) => {
    await page.goto(URL);
    const err = await page.evaluate(() => { try { (window as any).__flk.mount({ seed: 0 }); return null; } catch (e) { return String(e); } });
    expect(err).toContain('seed invalide');
  });
});

test.describe('reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('préférence système respectée : aucune étincelle même sur des parfaits', async ({ page }) => {
    await open(page, { seed: 77 });
    expect((await state(page)).reducedMotion).toBe(true);
    let maxSparks = 0;
    const play = page.evaluate(() => (window as any).__flk.autoplay(4, 3000));
    let done = false;
    void play.then(() => { done = true; });
    while (!done) { maxSparks = Math.max(maxSparks, (await state(page)).sparks); await page.waitForTimeout(30); }
    expect((await state(page)).perfectCount).toBeGreaterThan(0);
    expect(maxSparks).toBe(0);
  });
});
