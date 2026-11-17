/**
 * Configuration du serveur par variables d'environnement. Aucun secret n'est nécessaire :
 * le classement n'utilise ni clé de paiement ni clé publicitaire.
 *
 *   PORT              port d'écoute (8787)
 *   HOST              interface (127.0.0.1 ; 0.0.0.0 derrière un proxy)
 *   ALLOWED_ORIGINS   origines CORS autorisées, séparées par des virgules
 *                     (ex. https://alexis97432.github.io,http://localhost:5173)
 *   DATA_FILE         fichier JSON de persistance (absent : mémoire seule, perdue au redémarrage)
 *   DEMO              « 1 » : remplit des tableaux de démonstration marqués `demo: true`
 *   RULES_VERSIONS    versions de règles acceptées, ex. « 1 » ou « 1,2 » (défaut : 1,2)
 */
import { DEFAULT_CONFIG, type AppConfig } from './app';

export type ServerEnv = AppConfig & { port: number; host: string; dataFile?: string };

export function readConfig(env: Record<string, string | undefined>): ServerEnv {
  const port = Number(env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`PORT invalide : ${env.PORT}`);
  const origins = (env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  for (const o of origins) {
    if (!/^https?:\/\/[^/\s]+$/.test(o)) throw new Error(`origine invalide (schéma://hôte, sans chemin) : ${o}`);
  }
  const versions = (env.RULES_VERSIONS ?? '1,2').split(',').map((v) => Number(v.trim()));
  if (versions.some((v) => !Number.isInteger(v) || v < 1)) throw new Error(`RULES_VERSIONS invalide : ${env.RULES_VERSIONS}`);
  return {
    ...DEFAULT_CONFIG,
    port,
    host: env.HOST ?? '127.0.0.1',
    allowedOrigins: origins,
    rulesVersions: versions,
    demo: env.DEMO === '1',
    ...(env.DATA_FILE ? { dataFile: env.DATA_FILE } : {}),
  };
}
