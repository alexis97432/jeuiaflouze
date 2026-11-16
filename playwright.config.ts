import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // un test instable doit échouer, pas être masqué par une relance
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  // Priorité mobile : deux profils tactiles (Chromium seulement, seul navigateur installé en CI).
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    {
      name: 'mobile-small',
      use: { ...devices['iPhone SE'], defaultBrowserType: 'chromium', viewport: { width: 320, height: 568 } },
    },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  // Teste le bundle de production, pas le serveur de dev.
  webServer: {
    // Build de production + drapeau e2e qui expose seulement window.__metrics.
    command: `npm run build && npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    env: { VITE_EXPOSE_METRICS: '1' },
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
