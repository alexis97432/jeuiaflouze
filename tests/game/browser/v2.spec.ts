import { expect, test, type Page } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** F7 (V3) en vrai Chromium : jauge, bonus, offre de reprise, compte à rebours, fin unique. */
const URL = pathToFileURL(join(tmpdir(), 'flk-f1-harness', 'harness.html')).href;
const CAPTURES = process.env.F7_CAPTURES; // dossier de captures (facultatif)
const flk = (page: Page) => ({
  mount: (o: Record<string, unknown>) => page.evaluate((x) => (window as any).__flk.mount(x), o),
  pilot: (mode: 'align' | 'miss', count = 1) => page.evaluate(([m, c]) => (window as any).__flk.pilot(m, c), [mode, count] as const),
  v2: () => page.evaluate(() => (window as any).__flk.v2state()),
  events: () => page.evaluate(() => (window as any).__flk.events() as { type: string }[]),
  ends: () => page.evaluate(() => (window as any).__flk.ends()),
  continueRun: () => page.evaluate(() => (window as any).__flk.continueRun()),
  shot: async (name: string) => { if (CAPTURES) await page.screenshot({ path: join(CAPTURES, `${name}.png`) }); },
});

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test('v2 : jauge, bonus Ralenti, offre, compte à rebours, reprise et fin unique « avec reprise »', async ({ page }) => {
  await page.goto(URL);
  const g = flk(page);
  await g.mount({ seed: 5, v2: true, allowContinue: true, sound: false, theme: 'confiserie' });
  await g.pilot('align', 2);
  let s = await g.v2();
  expect(s.height).toBe(2);
  expect(s.gauge).toBeGreaterThan(0);
  await g.shot('1-jauge-390x844');
  // Pose une à une jusqu'au déclenchement du bonus (≤ 10 poses par la règle de la jauge).
  for (let i = 0; i < 10 && !(await g.v2()).bonus; i++) await g.pilot('align', 1);
  const evs = await g.events();
  expect(evs.some((e) => e.type === 'bonus-start')).toBe(true);
  s = await g.v2();
  expect(s.bonus).toBe('ralenti');
  await g.shot('2-bonus-actif-390x844');
  expect(s.score).toBeGreaterThan(s.height); // les parfaits valent 2 points : points ≠ étages
  await g.pilot('miss');
  await page.waitForTimeout(400);
  s = await g.v2();
  expect(s.status).toBe('fallen');
  expect((await g.events()).some((e) => e.type === 'continue-offer')).toBe(true);
  // Attente : aucun tick, aucune fin, même après 1,5 s ; un clic sur le canvas ne pose rien.
  const tick = s.tick;
  await page.mouse.click(195, 500);
  await page.waitForTimeout(1500);
  s = await g.v2();
  expect(s.tick).toBe(tick);
  expect(await g.ends()).toHaveLength(0);
  await g.shot('3-attente-offre-390x844');
  expect(await g.continueRun()).toBe(true);
  expect(await g.continueRun()).toBe(false);
  await page.waitForTimeout(300);
  s = await g.v2();
  expect(s.status).toBe('countdown');
  expect(s.bonus).toBeNull();
  expect(s.gauge).toBe(0);
  const left = s.moving.left;
  const inputs = s.inputs;
  await page.mouse.click(195, 500); // geste pendant le décompte : refusé
  await g.shot('4-compte-a-rebours-390x844');
  await page.waitForTimeout(1500);
  s = await g.v2();
  expect(s.moving.left).toBe(left);
  expect(s.inputs).toBe(inputs);
  await page.waitForTimeout(1600);
  s = await g.v2();
  expect(s.status).toBe('running');
  await g.pilot('miss');
  await page.waitForTimeout(1200);
  const ends = await g.ends();
  expect(ends).toHaveLength(1);
  expect(ends[0]).toMatchObject({ rulesVersion: 2, continues: 1, verified: true });
});

test('v2 sans allowContinue : le raté termine normalement, sans offre (Tour du jour, défis)', async ({ page }) => {
  await page.goto(URL);
  const g = flk(page);
  await g.mount({ seed: 9, v2: true, sound: false, theme: 'orbital', reducedMotion: true });
  await g.pilot('align', 3);
  await g.shot('5-orbital-reduced-motion-390x844');
  await g.pilot('miss');
  await page.waitForTimeout(1200);
  expect((await g.events()).some((e) => e.type === 'continue-offer')).toBe(false);
  const ends = await g.ends();
  expect(ends).toHaveLength(1);
  expect(ends[0]).toMatchObject({ rulesVersion: 2, continues: 0, verified: true });
});
