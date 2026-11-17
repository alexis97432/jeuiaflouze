/**
 * Types du contrat (docs/CONTRACTS.md v1), importés de l'API publique du moteur de FLK.
 * Aucune copie locale : toute divergence entre le shell et `src/game/index.ts` casse le typecheck.
 */
import type { RunConfig } from '../game';

export type { Appearance, GameEvent, GameHandle, MountOptions, RunConfig, RunResult } from '../game';

/**
 * Règles des liens de défi `?v=1` : inchangées, un ancien lien rejoue toujours la même partie
 * (C7 : « garder les anciens défis », records et liens v1 en étages).
 */
export const RULES_VERSION = 1 as const satisfies RunConfig['rulesVersion'];
/** Règles des nouvelles parties libres et du Tour du jour (F6/F7 : jauge, bonus, reprise). */
export const PLAY_RULES_VERSION = 2 as const satisfies RunConfig['rulesVersion'];
