/**
 * Point unique où le shell obtient mountGame.
 * A0 : mock explicite. A1 : remplacer par `export { mountGame } from '../game'` et
 * supprimer mock-game.ts du parcours réel (le test e2e « pas de mock » deviendra obligatoire).
 */
import type { MountGame } from './game-contract';
import { mockMountGame } from './mock-game';

export const IS_MOCK_GAME = true;
export const loadMountGame = (): MountGame => mockMountGame;
