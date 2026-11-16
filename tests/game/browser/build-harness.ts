import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const HARNESS_DIR = join(tmpdir(), 'flk-f1-harness');
// Playwright charge ce fichier en CommonJS tant que package.json n'a pas "type": "module".
const here = __dirname;

/** Construit le harnais (IIFE) hors du dépôt ; chargé ensuite en file://. */
export default async function globalSetup() {
  mkdirSync(HARNESS_DIR, { recursive: true });
  await build({
    entryPoints: [join(here, 'harness.ts')], bundle: true, format: 'iife', target: 'es2022',
    outfile: join(HARNESS_DIR, 'harness.js'), sourcemap: 'inline', logLevel: 'warning',
  });
  copyFileSync(join(here, 'harness.html'), join(HARNESS_DIR, 'harness.html'));
}
