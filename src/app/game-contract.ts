/**
 * Types du contrat (docs/CONTRACTS.md v1), importés de l'API publique du moteur de FLK.
 * Aucune copie locale : toute divergence entre le shell et `src/game/index.ts` casse le typecheck.
 */
import type { RunConfig } from '../game';

export type { GameEvent, GameHandle, MountOptions, RunConfig, RunResult } from '../game';

/** `src/game/index.ts` n'exporte pas RULES_VERSION ; le type ci-dessous l'aligne sur RunConfig. */
export const RULES_VERSION: RunConfig['rulesVersion'] = 1;
