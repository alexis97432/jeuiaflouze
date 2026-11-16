import { copyFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { FullConfig } from '@playwright/test';
import { build } from 'vite';

export const HARNESS_DIR = join(tmpdir(), 'flk-f1-harness');

/**
 * Construit le harnais en un seul script IIFE (chargeable en file://) avec Vite,
 * déjà fourni par A0 : aucune dépendance supplémentaire. Le dossier est lu dans
 * la config Playwright, ce qui marche en CommonJS comme en ESM ("type": "module").
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const here = dirname(config.configFile ?? join(process.cwd(), 'tests/game/browser/playwright.config.ts'));
  mkdirSync(HARNESS_DIR, { recursive: true });
  await build({
    configFile: false,
    logLevel: 'warn',
    build: {
      outDir: HARNESS_DIR,
      emptyOutDir: false,
      minify: false,
      sourcemap: 'inline',
      lib: { entry: join(here, 'harness.ts'), formats: ['iife'], name: 'flkHarness', fileName: () => 'harness.js' },
    },
  });
  copyFileSync(join(here, 'harness.html'), join(HARNESS_DIR, 'harness.html'));
}
