/**
 * Point unique où le shell obtient le moteur (contrat v1, docs/CONTRACTS.md).
 * Traduit les préférences du shell vers les options de création de `mountGame` et dérive
 * `onFirstPlacement` de `onEvent` (B1). Le son se règle entre les parties (B2) ;
 * `reducedMotion` est omis : le moteur suit alors la préférence système en direct.
 */
import { mountGame } from '../game';
import type { Appearance, GameEvent, GameHandle, MountOptions } from './game-contract';

export type ShellPrefs = { muted: boolean };
export type StartOptions = Pick<MountOptions, 'canvas' | 'config' | 'onEnd'> & {
  prefs: ShellPrefs;
  /** Apparence possédée et choisie par le joueur (validée par le shell) — cosmétique seule. */
  appearance?: Appearance;
  /** Appelé à la première pose réussie de la partie (mesure first_placement). */
  onFirstPlacement?(): void;
  /** Tous les événements du moteur, dans l'ordre (résumé de partie pour les objectifs). */
  onGameEvent?(event: GameEvent): void;
};
export type StartGame = (options: StartOptions) => GameHandle;

/** Adaptateur pur, testable avec un faux `mountGame`. */
export function createStartGame(mount: (options: MountOptions) => GameHandle): StartGame {
  return ({ prefs, appearance, onFirstPlacement, onGameEvent, canvas, config, onEnd }) => {
    let placed = false;
    return mount({
      canvas,
      config,
      onEnd,
      sound: !prefs.muted,
      ...(appearance ? { appearance } : {}),
      onEvent: (event) => {
        onGameEvent?.(event);
        if (event.type !== 'placement' || placed) return; // un raté n'est pas une pose
        placed = true;
        onFirstPlacement?.();
      },
    });
  };
}

export const loadGame = (): StartGame => createStartGame(mountGame);
