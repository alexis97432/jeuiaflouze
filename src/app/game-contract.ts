/**
 * Copie TEMPORAIRE des types de docs/CONTRACTS.md (API de src/game/index.ts, possédée par FLK).
 * Le shell n'importe que d'ici ; en A1, ce fichier ré-exportera simplement src/game/index.ts
 * et le typecheck signalera toute divergence entre le contrat et l'implémentation réelle.
 */

export type RunConfig = { seed: number; rulesVersion: 1 };

export type RunResult = {
  seed: number;
  rulesVersion: 1;
  score: number;
  perfectCount: number;
  durationTicks: number;
  inputTicks: number[];
};

export type GameHandle = {
  pause(): void;
  resume(): void;
  destroy(): void;
};

export type MountGameOptions = {
  canvas: HTMLCanvasElement;
  config: RunConfig;
  onEnd(result: RunResult): void;
};

export type MountGame = (options: MountGameOptions) => GameHandle;

export const RULES_VERSION = 1 as const;
