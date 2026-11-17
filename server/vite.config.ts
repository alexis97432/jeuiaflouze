import { defineConfig } from 'vite';

// Construit le serveur Node (ESM) dans dist-server/ : le code du moteur (rejeu) est inclus.
export default defineConfig({
  build: {
    ssr: 'server/main.ts',
    outDir: 'dist-server',
    target: 'node22',
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'main.mjs' } },
  },
});
