/**
 * Résultats v1 et v2 (V3-A6, accord #27 / C7) sous une seule union discriminée.
 * - Gains (étoiles, pièces, objectifs), record local et défis entre amis : sur la **hauteur**
 *   (étages), jamais sur les points ×2 ; un lien de défi v1 reste en étages.
 * - Points : affichés et classés en v2 seulement (classement par version de règles).
 * - Une partie avec reprise n'entre jamais au classement.
 */
import type { RunResult } from './game-contract';
import type { RunResultV2 } from '../game/core';

export type AnyRunResult = RunResult | RunResultV2;

export const heightOf = (r: AnyRunResult): number => (r.rulesVersion === 2 ? r.height : r.score);
export const continuesOf = (r: AnyRunResult): number => (r.rulesVersion === 2 ? r.continues : 0);
export const continueTicksOf = (r: AnyRunResult): readonly number[] => (r.rulesVersion === 2 ? r.continueTicks : []);
/** Points de la v2 ; null en v1 (le score v1 est une hauteur). */
export const pointsOf = (r: AnyRunResult): number | null => (r.rulesVersion === 2 ? r.score : null);

/** Événements v2 attendus de F7 (plan FLK §6), lus de façon défensive tant que F7 n'est pas exporté. */
export type ShellGameEvent =
  | { type: 'continue-offer'; tick: number }
  | { type: 'continue-start'; countdownTicks: number }
  | { type: 'bonus-start'; bonus: 'ralenti' | 'double'; floors: number }
  | { type: 'bonus-end'; bonus: 'ralenti' | 'double' };

export function asShellEvent(event: { type: string }): ShellGameEvent | null {
  const e = event as Record<string, unknown>;
  switch (e.type) {
    case 'continue-offer':
      return typeof e.tick === 'number' ? { type: 'continue-offer', tick: e.tick } : null;
    case 'continue-start':
      return { type: 'continue-start', countdownTicks: typeof e.countdownTicks === 'number' ? e.countdownTicks : 360 };
    case 'bonus-start':
    case 'bonus-end':
      if (e.bonus !== 'ralenti' && e.bonus !== 'double') return null;
      return e.type === 'bonus-start'
        ? { type: 'bonus-start', bonus: e.bonus, floors: typeof e.floors === 'number' ? e.floors : 5 }
        : { type: 'bonus-end', bonus: e.bonus };
    default:
      return null;
  }
}

/** Poignée du moteur avec la reprise de F7 ; méthodes absentes tant que F7 n'est pas livré. */
export type ContinueControls = { continueRun?(): boolean; declineContinue?(): void };

export const BONUS_NAMES = { ralenti: 'Ralenti', double: '×2' } as const;
