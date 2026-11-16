import { describe, expect, it } from 'vitest';
import { DEFAULT_REPLAY_LIMITS, replayRun, Simulation, verifyRunResult } from '../../src/game/core';
import { botRun } from './bot';
import { stackFingerprint } from './fingerprint';
import golden from './golden-v1.json';

type Vector = (typeof golden.vectors)[number];

/** Rejoue tick par tick, en lots de `batch` ticks par « image » (cadence simulée). */
function playBatched(v: Vector, batch: number) {
  const sim = new Simulation({ seed: v.seed, rulesVersion: 1 });
  const pending = new Set(v.inputTicks);
  while (sim.status === 'running') {
    for (let i = 0; i < batch && sim.status === 'running'; i++) sim.step(pending.has(sim.tick + 1));
  }
  return sim;
}

describe('vecteurs golden v1', () => {
  it('contient des parties variées (parfaits, aucune pose parfaite, seed maximale)', () => {
    expect(golden.vectors.length).toBeGreaterThanOrEqual(6);
    expect(golden.vectors.some((v) => v.seed === 0xffffffff)).toBe(true);
    expect(golden.vectors.some((v) => v.perfectCount === 0)).toBe(true);
    expect(golden.vectors.some((v) => v.perfectCount >= 30)).toBe(true);
  });

  it.each(golden.vectors)('$name : rejeu identique', (v) => {
    const out = replayRun(v);
    expect(out).toEqual({
      ok: true,
      result: {
        seed: v.seed, rulesVersion: 1, score: v.score, perfectCount: v.perfectCount,
        durationTicks: v.durationTicks, inputTicks: v.inputTicks,
      },
    });
    expect(verifyRunResult(v).ok).toBe(true);
  });

  it.each(golden.vectors)('$name : même pile quelle que soit la cadence (1, 2, 4 ou 7 ticks par image)', (v) => {
    for (const batch of [1, 2, 4, 7]) {
      const sim = playBatched(v, batch);
      expect(sim.result()?.score).toBe(v.score);
      expect(stackFingerprint(sim.stack)).toBe(v.stackFingerprint);
      expect(sim.stack[sim.stack.length - 1]).toEqual(v.topBlock);
      expect(sim.bestPerfectStreak).toBe(v.bestPerfectStreak);
    }
  });

  it('le bot de test reproduit les entrées figées (le générateur n’a pas dérivé)', () => {
    expect(botRun(1, 5, 4000).inputTicks).toEqual(golden.vectors[1]!.inputTicks);
  });
});

describe('validation de rejeu malformé', () => {
  const ok = golden.vectors[1]!;
  const base = { seed: ok.seed, rulesVersion: 1, inputTicks: ok.inputTicks };

  it.each([
    ['null', null, 'malformed'],
    ['chaîne', 'abc', 'malformed'],
    ['nombre', 42, 'malformed'],
    ['rulesVersion 2', { ...base, rulesVersion: 2 }, 'bad_rules_version'],
    ['rulesVersion "1"', { ...base, rulesVersion: '1' }, 'bad_rules_version'],
    ['rulesVersion absente', { seed: 1, inputTicks: [1] }, 'bad_rules_version'],
    ['seed 0', { ...base, seed: 0 }, 'bad_seed'],
    ['seed 2^32', { ...base, seed: 2 ** 32 }, 'bad_seed'],
    ['seed décimale', { ...base, seed: 1.5 }, 'bad_seed'],
    ['seed chaîne', { ...base, seed: '1' }, 'bad_seed'],
    ['inputTicks objet', { ...base, inputTicks: { length: 1, 0: 5 } }, 'bad_input_ticks'],
    ['inputTicks vide', { ...base, inputTicks: [] }, 'not_ended'],
    ['tick 0', { ...base, inputTicks: [0, 5] }, 'bad_input_ticks'],
    ['tick négatif', { ...base, inputTicks: [-3] }, 'bad_input_ticks'],
    ['tick décimal', { ...base, inputTicks: [1.5] }, 'bad_input_ticks'],
    ['tick NaN', { ...base, inputTicks: [NaN] }, 'bad_input_ticks'],
    ['tick Infinity', { ...base, inputTicks: [Infinity] }, 'bad_input_ticks'],
    ['tick hors entier sûr', { ...base, inputTicks: [2 ** 53] }, 'bad_input_ticks'],
    ['tick chaîne', { ...base, inputTicks: ['5'] }, 'bad_input_ticks'],
    ['doublon (input doublé)', { ...base, inputTicks: [10, 10, 20] }, 'bad_input_ticks'],
    ['désordre', { ...base, inputTicks: [20, 10] }, 'bad_input_ticks'],
    ['trop long', { ...base, inputTicks: [DEFAULT_REPLAY_LIMITS.maxTicks + 1] }, 'too_long'],
    ['entrées seulement posées', { ...base, inputTicks: ok.inputTicks.slice(0, -1) }, 'not_ended'],
    ['entrée après le raté', { ...base, inputTicks: [...ok.inputTicks, ok.durationTicks + 5] }, 'input_after_end'],
  ])('%s → %s', (_label, payload, code) => {
    const out = replayRun(payload);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe(code);
  });

  it('rejette trop d’entrées AVANT de simuler', () => {
    const huge = Array.from({ length: DEFAULT_REPLAY_LIMITS.maxInputs + 1 }, (_, i) => i + 1);
    const t0 = performance.now();
    const out = replayRun({ ...base, inputTicks: huge });
    expect(out).toMatchObject({ ok: false, error: 'too_many_inputs' });
    expect(performance.now() - t0).toBeLessThan(50);
  });

  it('respecte des limites serveur plus strictes', () => {
    expect(replayRun(base, { maxTicks: ok.durationTicks - 1, maxInputs: 100 })).toMatchObject({ ok: false, error: 'too_long' });
    expect(replayRun(base, { maxTicks: 10_000, maxInputs: ok.inputTicks.length - 1 })).toMatchObject({ ok: false, error: 'too_many_inputs' });
    expect(replayRun(base, { maxTicks: ok.durationTicks, maxInputs: ok.inputTicks.length }).ok).toBe(true);
  });

  it.each([
    ['score', { score: ok.score + 1 }],
    ['perfectCount', { perfectCount: 0 }],
    ['durationTicks', { durationTicks: ok.durationTicks - 1 }],
    ['score en chaîne', { score: String(ok.score) }],
  ])('verifyRunResult détecte un %s falsifié', (_k, patch) => {
    const claimed = { ...ok, ...patch };
    expect(verifyRunResult(claimed)).toMatchObject({ ok: false, error: 'mismatch' });
  });

  it('ne modifie pas le payload reçu', () => {
    const payload = { ...base, inputTicks: [...ok.inputTicks] };
    const frozen = JSON.stringify(payload);
    replayRun(payload);
    expect(JSON.stringify(payload)).toBe(frozen);
  });
});

describe('coût du rejeu (mesure indicative, pas un benchmark)', () => {
  it('rejoue une partie à la durée maximale par défaut (432000 ticks) en moins de 1 s', () => {
    // Un seul appui à la fin : premier étage toujours posé → not_ended, mais 432000 ticks simulés.
    const t0 = performance.now();
    const out = replayRun({ seed: 3, rulesVersion: 1, inputTicks: [DEFAULT_REPLAY_LIMITS.maxTicks] });
    const ms = performance.now() - t0;
    expect(out).toMatchObject({ ok: false, error: 'not_ended' });
    console.info(`[mesure] rejeu de ${DEFAULT_REPLAY_LIMITS.maxTicks} ticks : ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(1000);
  });
});
