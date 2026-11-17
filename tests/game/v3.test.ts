import { describe, expect, it } from 'vitest';
import {
  BOOST_FLOORS,
  COUNTDOWN_TICKS,
  FEVER_STREAK,
  FIELD_WIDTH,
  floorSpeed,
  GAUGE_MAX,
  MAGNET_TOLERANCE,
  PERFECT_TOLERANCE,
  replayRun,
  resolvePlacement,
  SAVE_TICKS,
  SimulationV3,
  slowSpeed,
  verifyRunResult,
  Xorshift32,
  type BoostId,
  type StepEventV3,
} from '../../src/game/core';
import { nextLeftV3, playV3, shrinkThenMissV3, waitResume, type KindV3 } from './bot-v3';
import { stackFingerprint } from './fingerprint';
import golden3 from './golden-v3.json';

type Placed = Extract<StepEventV3, { kind: 'placed' }>;
const run = (seed = 11) => new SimulationV3({ seed, rulesVersion: 3 });
const placedN = (sim: SimulationV3, kinds: KindV3[]) => kinds.map((k) => playV3(sim, k) as Placed);

/** Vitesse v1 (avant Ralenti) de l'étage `floor` : un tirage par étage, depuis l'étage 1. */
function baseSpeedAt(seed: number, floor: number): number {
  const rng = new Xorshift32(seed);
  let draw = 0;
  for (let f = 1; f <= floor; f++) draw = rng.next();
  return floorSpeed(floor, draw);
}

/** Pose aux bords (grosses coupes) jusqu'à ce qu'un raté soit possible, sans rater. */
function narrow(sim: SimulationV3): void {
  for (let guard = 0; guard < 2_000_000; guard++) {
    const w = sim.base.width;
    const max = FIELD_WIDTH - w;
    if (Math.max(sim.base.left, max - sim.base.left) >= w) return;
    const next = nextLeftV3(sim);
    const atEdge = next === 0 || next === max || (sim.direction === 1 ? next + sim.speed > max : next - sim.speed < 0);
    const offset = Math.abs(next - sim.base.left);
    sim.step(atEdge && offset < w && offset > sim.tolerance);
  }
  throw new Error('impossible de rétrécir');
}

/** Parfaits jusqu'au déclenchement du boost demandé (les parfaits ne rétrécissent pas la base). */
function perfectUntil(sim: SimulationV3, boost: BoostId): Placed[] {
  const events: Placed[] = [];
  for (let i = 0; i < 80; i++) {
    const ev = playV3(sim, 'perfect') as Placed;
    events.push(ev);
    if (ev.boostStarted === boost) return events;
  }
  throw new Error(`boost ${boost} jamais déclenché`);
}

describe('v3 : cycle des boosts de la jauge', () => {
  it('Ralenti → Aimant → Bouclier → Ralenti, chacun pour sa durée, sans remplir la jauge pendant', () => {
    const sim = run(7);
    const order: BoostId[] = [];
    const lengths: Partial<Record<BoostId, number>> = {};
    let current: BoostId | null = null;
    let covered = 0;
    for (let i = 0; i < 120 && order.length < 4; i++) {
      // Hors boost : deux parfaits puis une pose coupée (la jauge se remplit, la base reste large) ;
      // pendant un boost : parfaits seulement (ils ne coupent rien).
      const ev = playV3(sim, sim.boost === null && i % 3 === 2 ? 'placed' : 'perfect') as Placed;
      if (current) {
        expect(ev.boost).toBe(current);
        expect(ev.gauge).toBe(0); // pas de cumul pendant un boost
        covered++;
        if (ev.boostEnded) {
          lengths[current] = covered;
          current = null;
        }
      }
      if (ev.boostStarted) {
        order.push(ev.boostStarted);
        current = ev.boostStarted;
        covered = 0;
        expect(sim.boostFloorsLeft).toBe(BOOST_FLOORS[current]);
      }
    }
    expect(order).toEqual(['ralenti', 'aimant', 'bouclier', 'ralenti']);
    expect(lengths).toEqual({ ralenti: 5, aimant: 5, bouclier: 6 });
    expect(sim.boostCount).toBe(4);
  });

  it('Ralenti : vitesse v1 × 3/5 sur les étages couverts, puis vitesse v1', () => {
    const sim = run(9);
    perfectUntil(sim, 'ralenti');
    expect(sim.speed).toBe(slowSpeed(baseSpeedAt(9, sim.floor)));
    for (let i = 0; i < 5; i++) {
      expect(sim.speed).toBe(slowSpeed(baseSpeedAt(9, sim.floor)));
      playV3(sim, 'placed');
    }
    expect(sim.boost).toBeNull();
    expect(sim.speed).toBe(baseSpeedAt(9, sim.floor));
  });

  it('Aimant : un écart de 4 à 14 unités devient un parfait « collé » ; hors Aimant, c’est une coupe', () => {
    const sim = run(13);
    perfectUntil(sim, 'ralenti');
    for (let i = 0; i < 5; i++) playV3(sim, 'perfect');
    perfectUntil(sim, 'aimant');
    expect(sim.tolerance).toBe(MAGNET_TOLERANCE);
    const width = sim.base.width;
    const ev = playV3(sim, 'snap') as Placed;
    expect(ev.perfect).toBe(true);
    expect(ev.snapped).toBe(true);
    expect(ev.cut).toBeNull();
    expect(ev.placed.width).toBe(width);
    // Hors Aimant, le même écart coupe le bloc (règle des v1/v2).
    const base = { left: 100_000, width: 120_000 };
    const out = resolvePlacement(base, { left: 110_000, width: 120_000 });
    expect(out.kind === 'placed' && out.perfect).toBe(false);
    expect(resolvePlacement(base, { left: 110_000, width: 120_000 }, MAGNET_TOLERANCE)).toMatchObject({ perfect: true });
  });
});

describe('v3 : Bouclier', () => {
  it('raté rattrapé : la tour reste, le même étage repart du bord après 0,75 s, appuis ignorés', () => {
    const sim = run(21);
    narrow(sim);
    perfectUntil(sim, 'ralenti');
    for (let i = 0; i < 5; i++) playV3(sim, 'perfect');
    perfectUntil(sim, 'aimant');
    for (let i = 0; i < 5; i++) playV3(sim, 'perfect');
    perfectUntil(sim, 'bouclier');
    const floor = sim.floor;
    const height = sim.height;
    const stack = sim.stack.length;
    const score = sim.score;
    const ev = playV3(sim, 'miss');
    expect(ev.kind).toBe('saved');
    expect(sim.status).toBe('countdown');
    expect(sim.countdownKind).toBe('save');
    expect(sim.countdownLeft).toBe(SAVE_TICKS);
    expect(sim.boost).toBeNull();
    expect(sim.fever).toBe(false);
    expect(sim.perfectStreak).toBe(0);
    expect(sim.savedCount).toBe(1);
    expect([sim.floor, sim.height, sim.stack.length, sim.score]).toEqual([floor, height, stack, score]);
    const inputs = sim.inputTicks.length;
    for (let i = 0; i < SAVE_TICKS - 1; i++) expect(sim.step(true)).toBeNull();
    expect(sim.inputTicks.length).toBe(inputs);
    expect(sim.step(false)).toEqual({ kind: 'resumed', tick: sim.tick, cause: 'save' });
    expect(sim.status).toBe('running');
    // Bouclier consommé : le raté suivant est normal (reprise possible).
    const miss = shrinkThenMissV3(sim);
    expect(miss.kind).toBe('missed');
    expect(sim.status).toBe('fallen');
  });

  it('6 poses sans raté : le Bouclier s’éteint (fin visible), sans rattrapage', () => {
    const sim = run(5);
    perfectUntil(sim, 'ralenti');
    for (let i = 0; i < 5; i++) playV3(sim, 'perfect');
    perfectUntil(sim, 'aimant');
    for (let i = 0; i < 5; i++) playV3(sim, 'perfect');
    perfectUntil(sim, 'bouclier');
    const events = placedN(sim, ['perfect', 'perfect', 'perfect', 'perfect', 'perfect', 'perfect']);
    expect(events.map((e) => e.boostEnded)).toEqual([null, null, null, null, null, 'bouclier']);
    expect(sim.savedCount).toBe(0);
  });
});

describe('v3 : Fièvre', () => {
  it('5e parfait d’affilée : Fièvre, points × 2 tant que les poses restent parfaites, fin au premier non-parfait', () => {
    const sim = run(3);
    const evs = placedN(sim, ['perfect', 'perfect', 'perfect', 'perfect', 'perfect', 'perfect', 'placed', 'perfect']);
    expect(evs.map((e) => e.fever)).toEqual([false, false, false, false, true, true, false, false]);
    expect(evs.map((e) => e.feverStarted)).toEqual([false, false, false, false, true, false, false, false]);
    expect(evs.map((e) => e.feverEnded)).toEqual([false, false, false, false, false, false, true, false]);
    expect(evs.map((e) => e.points)).toEqual([2, 2, 2, 2, 4, 4, 1, 2]);
    expect(FEVER_STREAK).toBe(5);
    expect(sim.feverCount).toBe(1);
    expect(sim.bestPerfectStreak).toBe(6);
  });

  it('Fièvre et boost de jauge se combinent ; un raté éteint la Fièvre', () => {
    const sim = run(17);
    narrow(sim);
    const evs = placedN(sim, ['perfect', 'perfect', 'perfect', 'perfect', 'perfect']);
    expect(evs[4]!.fever).toBe(true);
    expect(sim.boost).not.toBeNull(); // la jauge a donné le Ralenti en route
    const miss = playV3(sim, 'miss');
    expect(miss).toMatchObject({ kind: 'missed', fever: true, canContinue: true });
    expect(sim.fever).toBe(false);
  });
});

describe('v3 : reprise (vie)', () => {
  it('continueRun : 3 s de compte à rebours « continue », jauge et boost remis à zéro, fin unique au 2e raté', () => {
    const sim = run(29);
    narrow(sim);
    perfectUntil(sim, 'ralenti');
    playV3(sim, 'miss');
    expect(sim.status).toBe('fallen');
    expect(sim.continueRun()).toBe(true);
    expect(sim.continueRun()).toBe(false);
    expect([sim.countdownKind, sim.countdownLeft, sim.boost, sim.gauge]).toEqual(['continue', COUNTDOWN_TICKS, null, 0]);
    expect(waitResume(sim)).toMatchObject({ kind: 'resumed', cause: 'continue' });
    playV3(sim, 'miss');
    expect(sim.status).toBe('ended');
    expect(sim.result()).toMatchObject({ continues: 1, rulesVersion: 3 });
  });
});

describe('v3 : rejeu et déterminisme', () => {
  function fullRun(seed: number) {
    const sim = run(seed);
    narrow(sim);
    perfectUntil(sim, 'ralenti');
    for (let i = 0; i < 5; i++) playV3(sim, 'perfect');
    perfectUntil(sim, 'aimant');
    placedN(sim, ['snap', 'perfect', 'snap', 'perfect', 'perfect']);
    perfectUntil(sim, 'bouclier');
    playV3(sim, 'miss'); // rattrapé
    placedN(sim, ['placed', 'perfect']);
    shrinkThenMissV3(sim);
    sim.continueRun();
    waitResume(sim);
    placedN(sim, ['perfect']);
    shrinkThenMissV3(sim);
    return sim.result()!;
  }

  it('rejeu = simulation (rattrapage, reprise, Fièvre), verifyRunResult accepte', () => {
    const r = fullRun(42);
    expect(r.savedCount).toBe(1);
    expect(r.continues).toBe(1);
    expect(r.feverCount).toBeGreaterThanOrEqual(1);
    expect(r.bonusCount).toBe(3);
    const out = replayRun({ seed: r.seed, rulesVersion: 3, inputTicks: r.inputTicks, continueTicks: r.continueTicks });
    expect(out).toEqual({ ok: true, result: r });
    expect(verifyRunResult(r).ok).toBe(true);
  });

  it('même résultat quelle que soit la cadence (1, 2, 4, 7 ou 30 ticks par image)', () => {
    const r = fullRun(42);
    const presses = new Set(r.inputTicks);
    for (const batch of [1, 2, 4, 7, 30]) {
      const sim = run(42);
      while (sim.status !== 'ended') {
        if (sim.status === 'fallen') { sim.continueRun(); continue; }
        for (let i = 0; i < batch && (sim.status === 'running' || sim.status === 'countdown'); i++) {
          sim.step(presses.has(sim.tick + 1));
        }
      }
      expect(sim.result()).toEqual(r);
    }
  });

  it('rejette une entrée pendant le rattrapage, et des compteurs v3 falsifiés', () => {
    const r = fullRun(42);
    const saved = (() => {
      const sim = run(42);
      const presses = new Set(r.inputTicks);
      while (sim.status !== 'countdown' || sim.countdownKind !== 'save') sim.step(presses.has(sim.tick + 1));
      return sim.tick;
    })();
    const ticks = [...r.inputTicks];
    const at = ticks.indexOf(saved);
    expect(at).toBeGreaterThanOrEqual(0);
    const bad = [...ticks.slice(0, at + 1), saved + 10, ...ticks.slice(at + 1)];
    expect(replayRun({ seed: 42, rulesVersion: 3, inputTicks: bad, continueTicks: r.continueTicks })).toMatchObject({ ok: false, error: 'input_during_countdown' });
    for (const key of ['feverCount', 'savedCount', 'bonusCount', 'score', 'height'] as const) {
      expect(verifyRunResult({ ...r, [key]: (r[key] as number) + 1 })).toMatchObject({ ok: false, error: 'mismatch' });
    }
  });

  it('v1 et v2 inchangées : tolérance par défaut, version 4 refusée', () => {
    expect(PERFECT_TOLERANCE).toBe(4000);
    expect(GAUGE_MAX).toBe(10);
    expect(replayRun({ seed: 1, rulesVersion: 4, inputTicks: [1] })).toMatchObject({ ok: false, error: 'bad_rules_version' });
  });
});

describe('vecteurs golden v3', () => {
  it.each(golden3.vectors)('$name : rejeu identique et pile identique', (v) => {
    const { name, stackFingerprint: fp, ...result } = v;
    void name;
    const out = replayRun({ seed: v.seed, rulesVersion: 3, inputTicks: v.inputTicks, continueTicks: v.continueTicks });
    expect(out).toEqual({ ok: true, result });
    const sim = new SimulationV3({ seed: v.seed, rulesVersion: 3 });
    const presses = new Set(v.inputTicks);
    while (sim.status !== 'ended') {
      if (sim.status === 'fallen') { if (v.continues === 1 && sim.continues === 0) sim.continueRun(); else sim.finish(); continue; }
      sim.step(presses.has(sim.tick + 1));
    }
    expect(stackFingerprint(sim.stack)).toBe(fp);
  });

  it('couvre Fièvre, rattrapage, reprise et seed maximale', () => {
    expect(golden3.vectors.some((v) => v.feverCount >= 1)).toBe(true);
    expect(golden3.vectors.some((v) => v.savedCount === 1)).toBe(true);
    expect(golden3.vectors.some((v) => v.continues === 1)).toBe(true);
    expect(golden3.vectors.some((v) => v.seed === 0xffffffff)).toBe(true);
  });
});
