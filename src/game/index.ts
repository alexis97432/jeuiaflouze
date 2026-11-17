/** API publique du jeu, consommée par le shell (A1, A3/A4). Contrat : docs/CONTRACTS.md. */
export type { RunConfig, RunResult } from './core';
export { replayRun, verifyRunResult, type ReplayOutcome, type ReplayLimits, type ReplayErrorCode } from './core';
export {
  mountGame,
  END_DELAY_MS,
  resolveAppearance,
  type Appearance,
  type GameEvent,
  type GameHandle,
  type MountOptions,
} from './render/mount';
export { THEME_IDS, DEFAULT_THEME, isThemeId, type ThemeId } from './render/themes';
export { SKIN_IDS, DEFAULT_SKIN, isSkinId, type SkinId } from './render/blocks';
export { renderAppearancePreview, type PreviewOptions } from './render/preview';
