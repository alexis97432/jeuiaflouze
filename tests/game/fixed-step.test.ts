import { describe, expect, it } from 'vitest';
import { Simulation, verifyRunResult, type StepEvent } from '../../src/game/core';
import { FixedStepDriver, MAX_CATCHUP_TICKS, TICK_MS } from '../../src/game/input/fixed-step';

/** Avance de `from` à `to` en images de 60 Hz (une seule grosse image serait bornée par le rattrapage). */
function run(d: FixedStepDriver, from: number, to: number) {
  for (let t = from; t < to; t += 1000 / 60) d.advance(t);
  d.advance(to);
}

/**
 * Joue une partie avec des appuis horodatés (ms) et des images à `hz`, avec une
 * gigue facultative. Les appuis sont délivrés à la première image qui suit leur
 * horodatage, comme dans un navigateur (les événements sont traités entre deux images).
 */
function play(seed: number, pressTimes: number[], hz: number, jitter = 0) {
  const sim = new Simulation({ seed, rulesVersion: 1 });
  const events: StepEvent[] = [];
  const driver = new FixedStepDriver(sim, (e) => events.push(e));
  const start = 1000;
  driver.resume(start);
  let now = start;
  let r = 12345;
  let i = 0;
  while (sim.status === 'running' && now < start + 120_000) {
    r = (r * 1103515245 + 12345) & 0x7fffffff;
    now += 1000 / hz + (jitter ? ((r / 0x7fffffff) - 0.5) * 2 * jitter : 0);
    while (i < pressTimes.length && start + pressTimes[i]! <= now) driver.press(start + pressTimes[i++]!);
    driver.advance(now);
  }
  return { sim, events, result: sim.result() };
}

// Appuis réalistes : ~1,1 s entre poses, avec des appuis très rapprochés pour tester la fusion.
const PRESSES = [740, 1810, 2930, 4012, 5140, 6230, 7301, 8420, 9512, 10601, 11733, 12800, 13950, 15020, 16100, 17240, 18300, 19410, 20555, 21600];

describe('pas fixe : indépendance à la cadence', () => {
  const reference = play(2026, PRESSES, 120);

  it('la partie de référence se termine et son rejeu est valide', () => {
    expect(reference.result).not.toBeNull();
    expect(verifyRunResult(reference.result).ok).toBe(true);
  });

  it.each([30, 60, 75, 90, 144, 240])('%i Hz donne exactement les mêmes inputTicks qu’à 120 Hz', (hz) => {
    expect(play(2026, PRESSES, hz).result).toEqual(reference.result);
  });

  it.each([30, 60, 144])('%i Hz avec gigue de ±4 ms : même résultat', (hz) => {
    expect(play(2026, PRESSES, hz, 4).result).toEqual(reference.result);
  });

  it('l’appui est attribué au premier tick ≥ son horodatage', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    const d = new FixedStepDriver(sim);
    d.resume(0);
    expect(d.press(0.1)).toBe(1);
    const sim2 = new Simulation({ seed: 1, rulesVersion: 1 });
    const d2 = new FixedStepDriver(sim2);
    d2.resume(0);
    expect(d2.press(100)).toBe(12); // pile sur le tick 12 (100 ms × 120 / 1000)
    expect(d2.press(100.01)).toBe(13);
  });
});

describe('pas fixe : appuis', () => {
  it('deux appuis dans le même tick (tactile + souris émulée) ne font qu’une pose', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    const d = new FixedStepDriver(sim);
    d.resume(0);
    // 101 ms et 104 ms tombent dans le même tick 13 (tick 12 = 100 ms, tick 13 = 108,33 ms).
    expect(d.press(101)).toBe(13);
    expect(d.press(104)).toBeNull();
    d.advance(200);
    expect(sim.inputTicks).toEqual([13]);
  });

  it('deux appuis à des ticks différents dans la même image (30 Hz) donnent deux poses, dans l’ordre', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    const d = new FixedStepDriver(sim);
    d.resume(0);
    d.press(100);
    d.press(120);
    d.advance(133.4);
    expect(sim.inputTicks).toEqual([12, 15]);
  });

  it('un appui horodaté dans le passé simulé est reporté au tick suivant, jamais réécrit', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    const d = new FixedStepDriver(sim);
    d.resume(0);
    run(d, 0, 500);
    const t = sim.tick;
    expect(d.press(10)).toBe(t + 1);
  });

  it('ignore les appuis en pause et après la fin', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    const d = new FixedStepDriver(sim);
    expect(d.press(0)).toBeNull(); // pas encore démarré
    d.resume(0);
    d.pause();
    expect(d.press(5)).toBeNull();
  });
});

describe('pas fixe : pause, rattrapage et interpolation', () => {
  it('aucun tick ne passe en pause et la reprise ne rattrape pas', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    const d = new FixedStepDriver(sim);
    d.resume(0);
    run(d, 0, 1000);
    expect(sim.tick).toBe(120);
    d.pause();
    expect(d.advance(60_000)).toBe(0);
    expect(sim.tick).toBe(120);
    d.resume(60_000);
    d.advance(60_000 + 100);
    expect(sim.tick).toBe(120 + Math.floor(100 / TICK_MS));
  });

  it('la pause oublie les appuis non traités', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    const d = new FixedStepDriver(sim);
    d.resume(0);
    d.press(50);
    d.pause();
    d.resume(1000);
    run(d, 1000, 2000);
    expect(sim.inputTicks).toEqual([]);
  });

  it(`une image gelée ne simule pas plus de ${MAX_CATCHUP_TICKS} ticks, puis le temps repart normalement`, () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    const d = new FixedStepDriver(sim);
    d.resume(0);
    expect(d.advance(5000)).toBe(MAX_CATCHUP_TICKS);
    run(d, 5000, 6000);
    expect(sim.tick).toBe(MAX_CATCHUP_TICKS + 120);
  });

  it('alpha reste dans [0, 1]', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    const d = new FixedStepDriver(sim);
    d.resume(0);
    for (let t = 0; t < 200; t += 0.7) {
      d.advance(t);
      const a = d.alpha(t);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });

  it('s’arrête à la fin et ne simule plus rien', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    const d = new FixedStepDriver(sim);
    d.resume(0);
    for (const t of [177, 433, 434]) d.press((t - 0.5) * TICK_MS); // au milieu du tick précédent
    run(d, 0, 434 * TICK_MS + 1);
    expect(sim.status).toBe('ended');
    expect(d.isRunning).toBe(false);
    expect(d.advance(99_999)).toBe(0);
    expect(sim.result()?.inputTicks).toEqual([177, 433, 434]);
  });
});

describe('pas fixe : appuis pendant une image gelée (revue Codex R1)', () => {
  it('reproduction Codex : appui pendant le gel → une pose dans l’image du recalage, pas une pose fantôme plus tard', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    const d = new FixedStepDriver(sim);
    d.resume(0);
    d.press(1000); // mémorise le tick 120 de l'ancienne échelle
    d.advance(1000); // gel : 30 ticks seulement, recalage de l'ancre
    for (let t = 1010; t <= 1300; t += 10) d.advance(t);
    expect(sim.inputTicks).toEqual([MAX_CATCHUP_TICKS]);
    expect(d.pendingPresses).toEqual([]);
  });

  it('plusieurs appuis pendant un gel : ordre et écarts conservés, temps abandonné retiré', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    const d = new FixedStepDriver(sim);
    d.resume(0);
    expect(d.press(800)).toBe(96);
    expect(d.press(900)).toBe(108);
    expect(d.press(1000)).toBe(120);
    d.advance(1000); // 120 ticks dus, 30 simulés : 90 abandonnés
    expect(sim.inputTicks).toEqual([6, 18, 30]);
  });

  it('appui en tout début de gel : borné au premier tick non simulé, sans fusion abusive', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    const d = new FixedStepDriver(sim);
    d.resume(0);
    d.press(10); // tick 2
    d.press(50); // tick 6
    d.advance(1000); // abandon de 90 ticks : 2−90 et 6−90 bornés à 1 → fusion en une seule pose
    expect(sim.inputTicks).toEqual([1]);
  });

  it('gestes livrés après le gel avec un horodatage ancien : appliqués au tick suivant', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    const d = new FixedStepDriver(sim);
    d.resume(0);
    d.advance(1000); // gel sans geste
    const t = sim.tick;
    expect(d.press(500)).toBe(t + 1); // événement mis en file pendant le gel
    d.advance(1010);
    expect(sim.inputTicks).toEqual([t + 1]);
  });

  it('plusieurs gels successifs avec gestes : rejeu valide et aucun appui orphelin', () => {
    const sim = new Simulation({ seed: 9, rulesVersion: 1 });
    const d = new FixedStepDriver(sim);
    d.resume(0);
    let now = 0;
    for (let k = 0; k < 6 && sim.status === 'running'; k++) {
      for (let i = 0; i < 40; i++) { now += 1000 / 60; d.advance(now); }
      d.press(now + 200);
      d.press(now + 450);
      now += 700; // gel de 700 ms
      d.advance(now);
      expect(d.pendingPresses.every((p) => p > sim.tick)).toBe(true);
    }
    for (let i = 0; i < 60; i++) { now += 1000 / 60; d.advance(now); }
    expect(d.pendingPresses).toEqual([]);
    expect(sim.inputTicks.length).toBeGreaterThanOrEqual(6);
    const ticks = sim.inputTicks;
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]!).toBeGreaterThan(ticks[i - 1]!);
  });
});
