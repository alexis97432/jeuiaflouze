/** API publique du jeu, consommée par le shell (A1, A3/A4). Contrat : docs/CONTRACTS.md. */
export type { RunConfig as RunConfigV1, RunResult as RunResultV1, RunConfigV2, RunResultV2, BonusId, RunConfigV3, RunResultV3, BoostId } from './core';
export { BONUS_IDS, GAUGE_MAX, BONUS_FLOORS, COUNTDOWN_TICKS } from './core';
export { replayRun, verifyRunResult, type ReplayOutcome, type ReplayLimits, type ReplayErrorCode, type AnyRunResult } from './core';
export {
  mountGame,
  END_DELAY_MS,
  resolveAppearance,
  resolveAnyAppearance,
  type Appearance,
  type AnyAppearance,
  type GameEvent,
  type GameHandle,
  type MountOptions,
  type RunConfig,
  type RunResult,
} from './render/mount';
export { THEME_IDS, DEFAULT_THEME, isThemeId, THEME_RARITY, type ThemeId } from './render/themes';
export { SKIN_IDS, DEFAULT_SKIN, isSkinId, type SkinId } from './render/blocks';
/** V3 (F8b) : huit apparences de plus (boutique, passe). `ALL_SKIN_IDS` = V2 + V3. */
export { SKIN_IDS_V3, ALL_SKIN_IDS, isAnySkinId, type SkinIdV3, type AnySkinId } from './render/blocks';
/** V6 : cinq matières de plus et la rareté de chaque cosmétique (réalisation, jamais un avantage). */
export { SKIN_IDS_V6, SKIN_RARITY, type SkinIdV6 } from './render/blocks';
export { RARITIES, RARITY_INFO, rarityRank, type Rarity, type RarityInfo } from './render/rarity';
export { renderAppearancePreview, type PreviewOptions } from './render/preview';
export {
  summarizeRun,
  renderResultCard,
  GAME_NAME,
  dayInWords,
  CARD_WIDTH,
  CARD_HEIGHT,
  MAX_PATTERN,
  MAX_TOWER,
  type RunSummary,
  type PatternCell,
  type ResultCard,
  type CardMode,
  type CardOptions,
} from './render/card';
