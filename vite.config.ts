import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

// Tests unitaires dans un fuseau très éloigné d'UTC (UTC+14) : une date locale prise pour une
// date UTC (Tour du jour) devient visible. Forcé (pas ??=) pour ne pas dépendre de
// l'environnement de lancement (revue A3a FLK, m1). Hérité par les workers Vitest.
process.env.TZ = 'Pacific/Kiritimati';

function buildId(): string {
  if (process.env.BUILD_ID) return process.env.BUILD_ID;
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  build: { target: 'es2022', sourcemap: true },
  test: {
    // Environnement node par défaut (moteur pur de FLK) ; les tests DOM déclarent
    // `// @vitest-environment jsdom` en tête de fichier.
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
