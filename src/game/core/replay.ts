import { DEFAULT_REPLAY_LIMITS, RULES_VERSION } from './constants';
import { isValidSeed } from './prng';
import { Simulation, type RunResult } from './simulation';
import { MAX_CONTINUES, RULES_VERSION_2, SimulationV2, type RunResultV2 } from './v2';
import { RULES_VERSION_3, SimulationV3, type RunResultV3 } from './v3';

export type ReplayInput = {
  seed: number;
  rulesVersion: number;
  inputTicks: readonly number[];
  /** v2 et v3 : 0 ou 1 tick de raté repris (absent = []). */
  continueTicks?: readonly number[];
};

/** Résultat rejoué : v1, v2 ou v3 selon `rulesVersion`. */
export type AnyRunResult = RunResult | RunResultV2 | RunResultV3;

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
  | 'bad_continue_ticks'
  | 'input_during_countdown'
  | 'mismatch';

export type ReplayOutcome =
  | { ok: true; result: AnyRunResult }
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
  const { seed, rulesVersion, inputTicks, continueTicks } = input as Record<string, unknown>;
  if (rulesVersion !== RULES_VERSION && rulesVersion !== RULES_VERSION_2 && rulesVersion !== RULES_VERSION_3) {
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

  const ticks = inputTicks as number[];
  if (rulesVersion === RULES_VERSION_2 || rulesVersion === RULES_VERSION_3) {
    return replayWithContinues(rulesVersion, seed, ticks, continueTicks);
  }
  if (continueTicks !== undefined) return fail('bad_continue_ticks', 'continueTicks réservé aux rulesVersion 2 et 3');

  const sim = new Simulation({ seed, rulesVersion: RULES_VERSION });
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
  const keys = r.rulesVersion === RULES_VERSION_3
    ? (['score', 'height', 'perfectCount', 'bestPerfectStreak', 'bonusCount', 'feverCount', 'savedCount', 'continues', 'durationTicks'] as const)
    : r.rulesVersion === RULES_VERSION_2
      ? (['score', 'height', 'perfectCount', 'bestPerfectStreak', 'bonusCount', 'continues', 'durationTicks'] as const)
      : (['score', 'perfectCount', 'durationTicks'] as const);
  for (const key of keys) {
    const value = (r as Record<string, unknown>)[key];
    if (c[key] !== value) {
      return fail('mismatch', `${key} déclaré ${String(c[key])}, rejoué ${String(value)}`);
    }
  }
  return outcome;
}

/**
 * Rejeu v2 et v3. `ticks` est déjà validé (strictement croissant, borné). Règles en plus :
 * - continueTicks : absent ou tableau d'au plus MAX_CONTINUES entier(s) ≥ 1 ;
 * - une reprise doit être égale au tick du premier raté non rattrapé, sinon `bad_continue_ticks` ;
 * - aucune entrée pendant un compte à rebours (reprise : 3 s ; v3, rattrapage du Bouclier : 0,75 s) ;
 * - la dernière entrée est le raté final.
 */
function replayWithContinues(
  version: typeof RULES_VERSION_2 | typeof RULES_VERSION_3,
  seed: number,
  ticks: readonly number[],
  rawContinues: unknown,
): ReplayOutcome {
  let continues: readonly number[] = [];
  if (rawContinues !== undefined) {
    if (!Array.isArray(rawContinues) || rawContinues.length > MAX_CONTINUES) {
      return fail('bad_continue_ticks', `tableau d'au plus ${MAX_CONTINUES} entrée attendu`);
    }
    for (const t of rawContinues as unknown[]) {
      if (typeof t !== 'number' || !Number.isSafeInteger(t) || t < 1) {
        return fail('bad_continue_ticks', 'entier ≥ 1 attendu');
      }
    }
    continues = rawContinues as number[];
  }
  const sim = version === RULES_VERSION_3
    ? new SimulationV3({ seed, rulesVersion: RULES_VERSION_3 })
    : new SimulationV2({ seed, rulesVersion: RULES_VERSION_2 });
  let used = 0;
  for (let i = 0; i < ticks.length; i++) {
    const target = ticks[i]!;
    if (sim.status === 'ended') {
      return fail('input_after_end', `partie finie, ${ticks.length - i} entrée(s) en trop`);
    }
    if (sim.status === 'countdown' && target <= sim.tick + sim.countdownLeft) {
      return fail('input_during_countdown', `entrée au tick ${target} pendant le compte à rebours`);
    }
    while (sim.tick < target - 1) sim.step(false);
    const event = sim.step(true);
    if (event?.kind !== 'missed' || sim.status !== 'fallen') continue;
    if (used < continues.length) {
      if (continues[used] !== target) {
        return fail('bad_continue_ticks', `reprise ${continues[used]} ≠ raté au tick ${target}`);
      }
      sim.continueRun();
      used += 1;
    } else {
      sim.finish();
    }
  }
  if (used < continues.length) return fail('bad_continue_ticks', 'reprise sans raté correspondant');
  const result = sim.result();
  if (!result) return fail('not_ended', 'la dernière entrée ne termine pas la partie');
  return { ok: true, result };
}
