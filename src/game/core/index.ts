/** Moteur pur PILE OU CRASH — aucune dépendance DOM, réseau, stockage ou horloge. */
export * from './constants';
export { isValidSeed, xorshift32, Xorshift32 } from './prng';
export { advance, resolvePlacement, type Block, type PlacementOutcome } from './geometry';
export {
  floorSpeed,
  Simulation,
  type RunConfig,
  type RunResult,
  type RunStatus,
  type StepEvent,
} from './simulation';
export {
  replayRun,
  verifyRunResult,
  type ReplayErrorCode,
  type ReplayInput,
  type ReplayLimits,
  type ReplayOutcome,
} from './replay';
