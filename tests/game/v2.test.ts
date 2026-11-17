import { describe, expect, it } from 'vitest';
import {
  BONUS_FLOORS,
  COUNTDOWN_TICKS,
  FIELD_WIDTH,
  GAUGE_MAX,
  PERFECT_TOLERANCE,
  replayRun,
  Simulation,
  SimulationV2,
  slowSpeed,
  verifyRunResult,
  type StepEventV2,
} from '../../src/game/core';
import { play, shrinkThenMiss, type Kind } from './bot-v2';
import { stackFingerprint } from './fingerprint';
import golden2 from './golden-v2.json';

type PlacedEvent = Extract<StepEventV2, { kind: 'placed' }>;

const run = (seed = 11) => new SimulationV2({ seed, rulesVersion: 2 });
const placedN = (sim: SimulationV2, kinds: Kind[]) => kinds.map((k) => play(sim, k) as PlacedEvent);

describe('v2 : jauge et déclenchement', () => {
  it('10 poses non parfaites : la jauge vaut 9 à la 9e, le bonus part à la 10e', () => {
    const sim = run();
    const evs = placedN(sim, Array<Kind>(10).fill('placed'));
    expect(evs.map((e) => e.gauge)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
    expect(evs.slice(0, 9).every((e) => e.bonusStarted === null)).toBe(true);
    expect(evs[9]!.bonusStarted).toBe('ralenti');
    expect(sim.bonus).toBe('ralenti');
    expect(sim.bonusFloorsLeft).toBe(BONUS_FLOORS);
    expect(sim.bonusCount).toBe(1);
  });

  it('série de parfaits : +2, +2, puis +3 dès la 3e — bonus en 4 poses', () => {
    const sim = run(5);
    const evs = placedN(sim, ['perfect', 'perfect', 'perfect', 'perfect']);
    expect(evs.map((e) => e.gauge)).toEqual([2, 4, 7, 0]);
    expect(evs[3]!.bonusStarted).toBe('ralenti');
  });

  it('un raté de série ramène le gain à +2 (pas de +3 sans série de 3)', () => {
    const sim = run(5);
    const evs = placedN(sim, ['perfect', 'perfect', 'placed', 'perfect', 'perfect']);
    expect(evs.map((e) => e.gauge)).toEqual([2, 4, 5, 7, 9]);
  });

  it('excédent perdu : 8 puis +3 déclenche et remet la jauge à 0, pas à 1', () => {
    const sim = run(5);
    const evs = placedN(sim, ['placed', 'placed', 'placed', 'placed', 'placed', 'perfect', 'perfect', 'perfect']);
    // 1,2,3,4,5 puis +2=7, +2=9, +3=12 ≥ 10
    expect(evs.map((e) => e.gauge)).toEqual([1, 2, 3, 4, 5, 7, 9, 0]);
    expect(evs[7]!.bonusStarted).not.toBeNull();
    expect(sim.gauge).toBe(0);
  });
});

describe('v2 : bonus Ralenti et ×2', () => {
  it('Ralenti : les 5 étages suivants vont aux 3/5 de la vitesse v1, puis la vitesse v1 revient', () => {
    const seed = 21;
    const sim = run(seed);
    // Vitesses v1 de référence, étage par étage (un tirage par étage, identique en v1 et v2).
    const ref = speedsWithoutBonus(seed, 16);
    expect(sim.speed).toBe(ref[0]);
    placedN(sim, Array<Kind>(10).fill('placed'));
    expect(sim.bonus).toBe('ralenti');
    const slowed: number[] = [];
    const bases: number[] = [];
    for (let i = 0; i < BONUS_FLOORS; i++) {
      slowed.push(sim.speed);
      const e = play(sim, 'placed') as PlacedEvent;
      expect(e.bonus).toBe('ralenti');
      expect(e.gauge).toBe(0); // pas de remplissage pendant le bonus
      if (i < BONUS_FLOORS - 1) expect(e.bonusEnded).toBeNull();
      else expect(e.bonusEnded).toBe('ralenti');
    }
    expect(sim.bonus).toBeNull();
    bases.push(sim.speed);
    for (let i = 0; i < BONUS_FLOORS; i++) {
      expect(slowed[i]).toBe(slowSpeed(ref[10 + i]!));
      expect(slowed[i]).toBeLessThan(ref[10 + i]!);
    }
    expect(bases[0]).toBe(ref[15]);
  });

  it('×2 : le deuxième bonus double les points (1→2, 2→4) pendant 5 poses', () => {
    const sim = run(8);
    placedN(sim, Array<Kind>(10).fill('placed')); // Ralenti
    placedN(sim, Array<Kind>(BONUS_FLOORS).fill('placed'));
    const before = placedN(sim, Array<Kind>(10).fill('placed'));
    expect(before[9]!.bonusStarted).toBe('double');
    const doubled = placedN(sim, ['placed', 'perfect', 'placed', 'perfect', 'placed']);
    expect(doubled.map((e) => e.points)).toEqual([2, 4, 2, 4, 2]);
    expect(doubled[4]!.bonusEnded).toBe('double');
    const after = placedN(sim, ['placed', 'perfect']);
    expect(after.map((e) => e.points)).toEqual([1, 2]);
    expect(sim.nextBonus).toBe('ralenti'); // alternance
  });

  it('score (points) et hauteur (étages) sont distincts', () => {
    const sim = run(8);
    const evs = placedN(sim, ['perfect', 'placed', 'perfect']);
    expect(sim.height).toBe(3);
    expect(sim.score).toBe(5);
    expect(evs.map((e) => e.score)).toEqual([2, 3, 5]);
    expect(evs.map((e) => e.height)).toEqual([1, 2, 3]);
  });
});

describe('v2 : reprise', () => {
  it('raté → attente : aucun tick ne passe, quelle que soit la durée de la décision', () => {
    const sim = run(3);
    placedN(sim, ['placed', 'placed']);
    const miss = shrinkThenMiss(sim);
    expect(miss.canContinue).toBe(true);
    expect(sim.status).toBe('fallen');
    const t = sim.tick;
    for (let i = 0; i < 5000; i++) expect(sim.step(true)).toBeNull();
    expect(sim.tick).toBe(t);
    expect(sim.result()).toBeNull();
  });

  it('continueRun : base, score et hauteur conservés, même étage au départ, jauge et bonus annulés', () => {
    const sim = run(3);
    placedN(sim, Array<Kind>(10).fill('placed')); // bonus Ralenti actif
    expect(sim.bonus).toBe('ralenti');
    const miss = shrinkThenMiss(sim);
    expect(miss.bonus).toBe('ralenti');
    const { score, height, floor } = sim;
    const base = sim.base;
    expect(sim.continueRun()).toBe(true);
    expect(sim.continueRun()).toBe(false); // double appel sans effet
    expect(sim.finish()).toBe(false);
    expect(sim.status).toBe('countdown');
    expect([sim.score, sim.height, sim.floor]).toEqual([score, height, floor]);
    expect(sim.base).toEqual(base);
    expect(sim.moving.width).toBe(base.width);
    expect(sim.moving.left).toBe(floor % 2 === 1 ? 0 : FIELD_WIDTH - base.width);
    expect(sim.bonus).toBeNull();
    expect(sim.gauge).toBe(0);
    expect(sim.nextBonus).toBe('double'); // l'alternance continue
    expect(sim.continueTicks).toEqual([miss.tick]);
  });

  it('compte à rebours : 360 ticks immobiles, appuis ignorés, reprise au tick t+360', () => {
    const sim = run(3);
    placedN(sim, ['placed']);
    const miss = shrinkThenMiss(sim);
    sim.continueRun();
    const left = sim.moving.left;
    const inputs = sim.inputTicks.length;
    for (let i = 1; i < COUNTDOWN_TICKS; i++) {
      expect(sim.step(true)).toBeNull();
      expect(sim.moving.left).toBe(left);
      expect(sim.countdownLeft).toBe(COUNTDOWN_TICKS - i);
    }
    expect(sim.step(true)).toEqual({ kind: 'resumed', tick: miss.tick + COUNTDOWN_TICKS });
    expect(sim.moving.left).toBe(left);
    expect(sim.inputTicks.length).toBe(inputs); // aucun appui fantôme enregistré
    expect(sim.status).toBe('running');
    sim.step(false);
    expect(sim.moving.left).not.toBe(left); // ça repart au tick suivant
  });

  it('second raté : fin définitive, sans nouvelle offre', () => {
    const sim = run(3);
    shrinkThenMiss(sim);
    sim.continueRun();
    const second = shrinkThenMiss(sim);
    expect(second.canContinue).toBe(false);
    expect(sim.status).toBe('ended');
    expect(sim.continueRun()).toBe(false);
    const r = sim.result()!;
    expect(r.continues).toBe(1);
    expect(r.continueTicks).toHaveLength(1);
  });

  it('Terminer (finish) : fin normale sans reprise', () => {
    const sim = run(3);
    shrinkThenMiss(sim);
    expect(sim.finish()).toBe(true);
    expect(sim.result()).toMatchObject({ rulesVersion: 2, continues: 0, continueTicks: [] });
  });
});

describe('v2 : rejeu', () => {
  function fullRun(seed: number, withContinue: boolean) {
    const sim = run(seed);
    placedN(sim, ['perfect', 'perfect', 'perfect', 'perfect', 'placed', 'placed', 'placed', 'placed', 'placed']);
    shrinkThenMiss(sim);
    if (withContinue) {
      sim.continueRun();
      placedN(sim, ['perfect', 'placed']);
      shrinkThenMiss(sim);
    } else {
      sim.finish();
    }
    return sim.result()!;
  }

  it.each([false, true])('rejeu = simulation (reprise : %s), et verifyRunResult accepte', (withContinue) => {
    const r = fullRun(42, withContinue);
    expect(r.bonusCount).toBeGreaterThanOrEqual(1);
    const out = replayRun({ seed: r.seed, rulesVersion: 2, inputTicks: r.inputTicks, continueTicks: r.continueTicks });
    expect(out).toEqual({ ok: true, result: r });
    expect(verifyRunResult(r).ok).toBe(true);
  });

  it('continueTicks absent = aucune reprise', () => {
    const r = fullRun(42, false);
    expect(replayRun({ seed: r.seed, rulesVersion: 2, inputTicks: r.inputTicks })).toEqual({ ok: true, result: r });
  });

  it('même résultat quelle que soit la cadence (1, 2, 4, 7 ou 30 ticks par image)', () => {
    const r = fullRun(42, true);
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

  it('rejette les reprises invalides', () => {
    const r = fullRun(42, true);
    const t = r.continueTicks[0]!;
    const base = { seed: r.seed, rulesVersion: 2, inputTicks: r.inputTicks };
    const err = (x: unknown) => { const o = replayRun(x); return o.ok ? 'ok' : o.error; };
    expect(err({ ...base, continueTicks: [t + 1] })).toBe('bad_continue_ticks');
    expect(err({ ...base, continueTicks: [t, t] })).toBe('bad_continue_ticks');
    expect(err({ ...base, continueTicks: 'x' })).toBe('bad_continue_ticks');
    expect(err({ ...base, continueTicks: [0] })).toBe('bad_continue_ticks');
    // Sans reprise déclarée, le premier raté termine : entrées suivantes en trop.
    expect(err({ ...base, continueTicks: [] })).toBe('input_after_end');
    // Reprise déclarée sans raté correspondant.
    const plain = fullRun(42, false);
    expect(err({ seed: plain.seed, rulesVersion: 2, inputTicks: plain.inputTicks.slice(0, -1), continueTicks: [5] }))
      .toBe('bad_continue_ticks');
    // continueTicks interdit en v1.
    expect(err({ seed: 1, rulesVersion: 1, inputTicks: [1], continueTicks: [] })).toBe('bad_continue_ticks');
    // Version inconnue.
    expect(err({ ...base, rulesVersion: 3 })).toBe('bad_rules_version');
  });

  it('rejette une entrée pendant le compte à rebours (bornes t+1 et t+360), accepte t+361', () => {
    const sim = run(9);
    placedN(sim, ['placed']);
    const miss = shrinkThenMiss(sim);
    const t = miss.tick;
    const head = [...sim.inputTicks];
    const err = (next: number) => {
      const o = replayRun({ seed: 9, rulesVersion: 2, inputTicks: [...head, next], continueTicks: [t] });
      return o.ok ? 'ok' : o.error;
    };
    expect(err(t + 1)).toBe('input_during_countdown');
    expect(err(t + COUNTDOWN_TICKS)).toBe('input_during_countdown');
    // t+361 : premier tick jouable ; l'entrée est traitée (raté final ici : base étroite).
    expect(['ok', 'not_ended']).toContain(err(t + COUNTDOWN_TICKS + 1));
  });

  it('verifyRunResult détecte un score ou une hauteur falsifiés', () => {
    const r = fullRun(42, true);
    expect(verifyRunResult({ ...r, score: r.score + 1 })).toMatchObject({ ok: false, error: 'mismatch' });
    expect(verifyRunResult({ ...r, height: r.height + 1 })).toMatchObject({ ok: false, error: 'mismatch' });
    expect(verifyRunResult({ ...r, continues: 0 })).toMatchObject({ ok: false, error: 'mismatch' });
  });
});

/** Vitesses v1 des étages 1..n d'une partie v2 sans bonus (poses parfaites espacées par des imparfaites). */
function speedsWithoutBonus(seed: number, n: number): number[] {
  // La vitesse d'un étage ne dépend que de (étage, tirage) : on la lit sur une v1 posée n fois.
  const v1 = new Simulation({ seed, rulesVersion: 1 });
  const speeds: number[] = [];
  while (speeds.length < n) {
    speeds.push(v1.speed);
    const max = FIELD_WIDTH - v1.base.width;
    for (;;) {
      let next = v1.moving.left + v1.direction * v1.speed;
      if (next > max) next = 2 * max - next; else if (next < 0) next = -next;
      const ev = v1.step(Math.abs(next - v1.base.left) <= PERFECT_TOLERANCE);
      if (ev) break;
    }
  }
  return speeds;
}

it('constantes v2 exposées', () => {
  expect(GAUGE_MAX).toBe(10);
});

describe('vecteurs golden v2', () => {
  it.each(golden2.vectors)('$name : rejeu identique et pile identique', (v) => {
    const { name, stackFingerprint: fp, ...result } = v;
    void name;
    const out = replayRun({ seed: v.seed, rulesVersion: 2, inputTicks: v.inputTicks, continueTicks: v.continueTicks });
    expect(out).toEqual({ ok: true, result });
    expect(verifyRunResult(result).ok).toBe(true);
    // Reconstitution tick par tick : même pile.
    const sim = new SimulationV2({ seed: v.seed, rulesVersion: 2 });
    const presses = new Set(v.inputTicks);
    while (sim.status !== 'ended') {
      if (sim.status === 'fallen') { if (v.continues === 1 && sim.continues === 0) sim.continueRun(); else sim.finish(); continue; }
      sim.step(presses.has(sim.tick + 1));
    }
    expect(stackFingerprint(sim.stack)).toBe(fp);
  });

  it('couvre bonus multiples, reprise et seed maximale', () => {
    expect(golden2.vectors.some((v) => v.bonusCount >= 2 && v.continues === 0)).toBe(true);
    expect(golden2.vectors.some((v) => v.continues === 1)).toBe(true);
    expect(golden2.vectors.some((v) => v.seed === 0xffffffff)).toBe(true);
    // Le score n'est pas la hauteur dès qu'il y a des parfaits.
    expect(golden2.vectors.every((v) => v.score > v.height)).toBe(true);
  });
});
