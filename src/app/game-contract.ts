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
/**
 * Règles des nouvelles parties libres et du Défi du jour. V5 : v3 (Ralenti, Aimant, Bouclier,
 * Fièvre). Les liens `?v=1` et `?v=2` se jouent toujours avec leurs propres règles.
 */
export const PLAY_RULES_VERSION = 3 as const satisfies RunConfig['rulesVersion'];
/** Règles v2 (V3 : Ralenti, ×2) : seulement pour les liens de défi `?v=2` déjà partagés. */
export const RULES_VERSION_V2 = 2 as const satisfies RunConfig['rulesVersion'];
