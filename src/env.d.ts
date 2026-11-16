/** Identifiant de build injecté par vite.config.ts (SHA git court ou BUILD_ID). */
declare const __BUILD_ID__: string;

interface ImportMetaEnv {
  /** '1' uniquement pour le build testé par Playwright : expose window.__metrics. */
  readonly VITE_EXPOSE_METRICS?: string;
}
