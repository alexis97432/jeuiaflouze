/** API publique du jeu, consommée par le shell (A1, A3/A4). Contrat : docs/CONTRACTS.md. */
export type { RunConfig as RunConfigV1, RunResult as RunResultV1, RunConfigV2, RunResultV2, BonusId } from './core';
export { BONUS_IDS, GAUGE_MAX, BONUS_FLOORS, COUNTDOWN_TICKS } from './core';
export { replayRun, verifyRunResult, type ReplayOutcome, type ReplayLimits, type ReplayErrorCode, type AnyRunResult } from './core';
export {
  mountGame,
  END_DELAY_MS,
  resolveAppearance,
  type Appearance,
  type GameEvent,
  type GameHandle,
  type MountOptions,
  type RunConfig,
  type RunResult,
} from './render/mount';
export { THEME_IDS, DEFAULT_THEME, isThemeId, type ThemeId } from './render/themes';
export { SKIN_IDS, DEFAULT_SKIN, isSkinId, type SkinId } from './render/blocks';
export { renderAppearancePreview, type PreviewOptions } from './render/preview';
