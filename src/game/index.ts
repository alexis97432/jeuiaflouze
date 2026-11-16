/** API publique du jeu, consommée par le shell (A1). Contrat : docs/CONTRACTS.md. */
export type { RunConfig, RunResult } from './core';
export { replayRun, verifyRunResult, type ReplayOutcome, type ReplayLimits, type ReplayErrorCode } from './core';
export { mountGame, END_DELAY_MS, type GameEvent, type GameHandle, type MountOptions } from './render/mount';
