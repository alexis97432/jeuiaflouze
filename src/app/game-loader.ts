/**
 * Point unique où le shell obtient le moteur.
 * Le shell appelle `startGame` avec ses préférences ; l'adaptateur les traduit vers l'API du
 * moteur. Les options de préférences (son, reduced-motion) et l'événement de pose sont encore
 * en discussion dans le contrat (revue C0 B1/B2, propositions F1 `sound`, `onEvent`) : ils ne
 * sortent pas de ce fichier tant que Codex ne les a pas figés.
 *
 * État actuel : MOCK explicite (F1 en CHANGES_REQUESTED, non intégré). Bascule prévue et
 * vérifiée par fusion d'essai : voir A1 dans coordination/status/claude-code-alexis.md.
 */
import type { GameHandle, MountGameOptions } from './game-contract';
import { mockMountGame } from './mock-game';

export type ShellPrefs = { muted: boolean };
export type StartOptions = MountGameOptions & {
  prefs: ShellPrefs;
  /** Appelé à la première pose réussie (mesure first_placement). Interne au shell. */
  onFirstPlacement?(): void;
};
export type StartGame = (options: StartOptions) => GameHandle;

export const IS_MOCK_GAME = true;

export const loadGame = (): StartGame => ({ prefs: _prefs, onFirstPlacement, ...options }) =>
  mockMountGame({ ...options, ...(onFirstPlacement ? { onPlacement: onFirstPlacement } : {}) });
