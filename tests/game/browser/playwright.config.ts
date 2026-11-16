import { defineConfig, devices } from '@playwright/test';

/** Tests navigateur F1, hors config racine (A0 appartient à Alexis). */
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  globalSetup: './build-harness.ts',
  timeout: 120_000,
  fullyParallel: true,
  reporter: 'list',
  use: { trace: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
