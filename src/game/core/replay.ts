import { DEFAULT_REPLAY_LIMITS, RULES_VERSION } from './constants';
import { isValidSeed } from './prng';
import { Simulation, type RunResult } from './simulation';

export type ReplayInput = {
  seed: number;
  rulesVersion: number;
  inputTicks: readonly number[];
};

export type ReplayLimits = {
  /** Durée maximale acceptée, en ticks. */
  maxTicks: number;
  /** Nombre maximal d'entrées acceptées. */
  maxInputs: number;
};

export type ReplayErrorCode =
  | 'malformed'
  | 'bad_seed'
  | 'bad_rules_version'
  | 'bad_input_ticks'
  | 'too_many_inputs'
  | 'too_long'
  | 'not_ended'
  | 'input_after_end'
  | 'mismatch';

export type ReplayOutcome =
  | { ok: true; result: RunResult }
  | { ok: false; error: ReplayErrorCode; detail: string };

function fail(error: ReplayErrorCode, detail: string): ReplayOutcome {
  return { ok: false, error, detail };
}

/**
 * Rejoue une partie à partir de seed + rulesVersion + inputTicks.
 *
 * Accepte une valeur `unknown` (payload JSON non fiable). Une partie valide :
 * - inputTicks : tableau d'entiers ≥ 1, strictement croissants (pas de doublon) ;
 * - chaque entrée sauf la dernière pose un étage, la dernière est un raté ;
 * - durée = tick de la dernière entrée ≤ limits.maxTicks.
 * Les limites sont vérifiées AVANT la simulation pour borner le CPU.
 */
export function replayRun(
  input: unknown,
  limits: ReplayLimits = DEFAULT_REPLAY_LIMITS,
): ReplayOutcome {
  if (typeof input !== 'object' || input === null) return fail('malformed', 'objet attendu');
  const { seed, rulesVersion, inputTicks } = input as Record<string, unknown>;
  if (rulesVersion !== RULES_VERSION) {
    return fail('bad_rules_version', `rulesVersion ${String(rulesVersion)} non supportée`);
  }
  if (!isValidSeed(seed)) return fail('bad_seed', 'uint32 non nul attendu');
  if (!Array.isArray(inputTicks)) return fail('bad_input_ticks', 'tableau attendu');
  if (inputTicks.length === 0) return fail('not_ended', 'aucune entrée : la partie ne finit pas');
  if (inputTicks.length > limits.maxInputs) {
    return fail('too_many_inputs', `${inputTicks.length} > ${limits.maxInputs}`);
  }
  let previous = 0;
  for (let i = 0; i < inputTicks.length; i++) {
    const t: unknown = inputTicks[i];
    if (typeof t !== 'number' || !Number.isSafeInteger(t) || t <= previous) {
      return fail('bad_input_ticks', `index ${i} : entier strictement croissant ≥ 1 attendu`);
    }
    previous = t;
  }
  if (previous > limits.maxTicks) return fail('too_long', `${previous} > ${limits.maxTicks} ticks`);

  const sim = new Simulation({ seed, rulesVersion: RULES_VERSION });
  const ticks = inputTicks as number[];
  for (let i = 0; i < ticks.length; i++) {
    const target = ticks[i]!;
    while (sim.tick < target - 1) sim.step(false);
    const event = sim.step(true);
    if (event?.kind === 'missed' && i < ticks.length - 1) {
      return fail('input_after_end', `raté au tick ${target}, ${ticks.length - 1 - i} entrée(s) en trop`);
    }
  }
  const result = sim.result();
  if (!result) return fail('not_ended', 'la dernière entrée ne termine pas la partie');
  return { ok: true, result };
}

/**
 * Vérifie un RunResult déclaré : rejoue et compare score, parfaits et durée.
 * Ne prouve pas qu'un humain a joué (un bot peut produire un rejeu valide).
 */
export function verifyRunResult(
  claimed: unknown,
  limits: ReplayLimits = DEFAULT_REPLAY_LIMITS,
): ReplayOutcome {
  const outcome = replayRun(claimed, limits);
  if (!outcome.ok) return outcome;
  const c = claimed as Record<string, unknown>;
  const r = outcome.result;
  for (const key of ['score', 'perfectCount', 'durationTicks'] as const) {
    if (c[key] !== r[key]) {
      return fail('mismatch', `${key} déclaré ${String(c[key])}, rejoué ${r[key]}`);
    }
  }
  return outcome;
}
