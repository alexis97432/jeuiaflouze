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

export const heightOf = (r: AnyRunResult): number => (r.rulesVersion === 1 ? r.score : r.height);
export const continuesOf = (r: AnyRunResult): number => (r.rulesVersion === 1 ? 0 : r.continues);
export const continueTicksOf = (r: AnyRunResult): readonly number[] => (r.rulesVersion === 1 ? [] : r.continueTicks);
/** Points des v2 et v3 ; null en v1 (le score v1 est une hauteur). */
export const pointsOf = (r: AnyRunResult): number | null => (r.rulesVersion === 1 ? null : r.score);
/** V5 (v3) : Fièvres déclenchées et ratés rattrapés par le Bouclier ; 0 avant la v3. */
export const feversOf = (r: AnyRunResult): number => (r.rulesVersion === 3 ? r.feverCount : 0);
export const savesOf = (r: AnyRunResult): number => (r.rulesVersion === 3 ? r.savedCount : 0);

/** Noms courts des boosts pour les annonces (jauge « Super »). */
export const BONUS_NAMES = { ralenti: 'Ralenti', double: '×2', aimant: 'Aimant', bouclier: 'Bouclier' } as const;
/** Ce que fait chaque boost, en une phrase d'enfant (annonce et aide). */
export const BONUS_HINTS = {
  ralenti: 'les blocs vont moins vite',
  double: 'les points comptent double',
  aimant: 'les blocs presque bien placés se collent',
  bouclier: 'un raté sera rattrapé',
} as const;
