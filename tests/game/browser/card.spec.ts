import { expect, test } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** F9 en vrai Chromium : cartes v1, v2, v2 avec reprise, longue partie ; résultat faux refusé. */
const URL = pathToFileURL(join(tmpdir(), 'flk-f1-harness', 'harness.html')).href;
const CAPTURES = process.env.F9_CAPTURES;

test.use({ viewport: { width: 540, height: 675 }, deviceScaleFactor: 2 });

test('cartes de résultat : rendu réel, toutes différentes, faux résultat refusé', async ({ page }) => {
  await page.goto(URL);
  const cases: [string, string, Record<string, string>][] = [
    ['v1-defi-orbital', 'v1', { theme: 'orbital', mode: 'challenge' }],
    ['v2-libre-confiserie', 'v2', { theme: 'confiserie', mode: 'free', skin: 'holographique' }],
    ['v2-reprise-jardin', 'v2-reprise', { theme: 'jardin', mode: 'free', skin: 'lave' }],
    ['long-tour-du-jour', 'long', { theme: 'orbital', mode: 'daily', day: '2026-11-17', skin: 'galaxie' }],
  ];
  const prints = new Set<number>();
  for (const [name, which, opts] of cases) {
    const r = await page.evaluate(([w, o]) => (window as any).__flk.card(w, o), [which, opts] as const);
    expect(r, name).toMatchObject({ ok: true, w: 1080, h: 1350 });
    prints.add(r.print);
    if (CAPTURES) await page.locator('#card').screenshot({ path: join(CAPTURES, `carte-${name}.png`) });
  }
  expect(prints.size).toBe(cases.length);
  // F8b R1 : une apparence V3 passée par l'entrée publique change réellement la carte.
  const gomme = await page.evaluate(() => (window as any).__flk.card('v2', { theme: 'orbital', skin: 'gomme' }));
  const graphite = await page.evaluate(() => (window as any).__flk.card('v2', { theme: 'orbital', skin: 'graphite' }));
  const inconnu = await page.evaluate(() => (window as any).__flk.card('v2', { theme: 'orbital', skin: 'inconnu' }));
  expect(graphite.print).not.toBe(gomme.print);
  expect(inconnu.print).toBe(gomme.print);
  const bad = await page.evaluate(() => (window as any).__flk.card('faux'));
  expect(bad.ok).toBe(false);
});
