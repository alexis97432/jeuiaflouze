/**
 * Résultats v1 et v2 (V3-A6, accord #27 / C7) sous une seule union discriminée.
 * - Gains (étoiles, pièces, objectifs), record local et défis entre amis : sur la **hauteur**
 *   (étages), jamais sur les points ×2 ; un lien de défi v1 reste en étages.
 * - Points : affichés et classés en v2 seulement (classement par version de règles).
 * - Une partie avec reprise n'entre jamais au classement.
 */
import type { RunResult } from './game-contract';

/** Union v1 | v2 exportée par le moteur (F7). */
export type AnyRunResult = RunResult;

export const heightOf = (r: AnyRunResult): number => (r.rulesVersion === 2 ? r.height : r.score);
export const continuesOf = (r: AnyRunResult): number => (r.rulesVersion === 2 ? r.continues : 0);
export const continueTicksOf = (r: AnyRunResult): readonly number[] => (r.rulesVersion === 2 ? r.continueTicks : []);
/** Points de la v2 ; null en v1 (le score v1 est une hauteur). */
export const pointsOf = (r: AnyRunResult): number | null => (r.rulesVersion === 2 ? r.score : null);

/** Noms courts des bonus pour les annonces (jauge « Super », plan FLK). */
export const BONUS_NAMES = { ralenti: 'Ralenti', double: '×2' } as const;
