/**
 * Résume une partie à partir des événements du moteur (contrat v1 `GameEvent`), sans recalculer
 * aucune règle : meilleure série de parfaits et motif borné des dernières poses.
 */
import type { GameEvent } from './game-contract';

export const PATTERN_LENGTH = 20;

/** Motif d'une pose : 'perfect' ou 'placed' (GameEvent ne transporte pas la largeur coupée). */
export type PlacementMark = 'perfect' | 'placed';

export type RunTracker = {
  onEvent(event: GameEvent): void;
  readonly longestStreak: number;
  /** Les PATTERN_LENGTH dernières poses réussies, dans l'ordre. */
  readonly pattern: readonly PlacementMark[];
};

export function createRunTracker(): RunTracker {
  let longestStreak = 0;
  const pattern: PlacementMark[] = [];
  return {
    onEvent(event) {
      if (event.type !== 'placement') return;
      longestStreak = Math.max(longestStreak, event.perfectStreak);
      pattern.push(event.perfect ? 'perfect' : 'placed');
      if (pattern.length > PATTERN_LENGTH) pattern.shift();
    },
    get longestStreak() {
      return longestStreak;
    },
    get pattern() {
      return pattern;
    },
  };
}
