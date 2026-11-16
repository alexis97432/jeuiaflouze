import { describe, expect, it } from 'vitest';
import {
  advance,
  FIELD_WIDTH,
  floorSpeed,
  isValidSeed,
  PERFECT_TOLERANCE,
  resolvePlacement,
  Simulation,
  START_LEFT,
  START_WIDTH,
  xorshift32,
  Xorshift32,
} from '../../src/game/core';

/** Avance jusqu'au tick `t` (exclu) sans appuyer, puis appuie au tick `t`. */
function pressAt(sim: Simulation, t: number) {
  while (sim.tick < t - 1) sim.step(false);
  return sim.step(true);
}

describe('PRNG xorshift32', () => {
  it('reproduit la séquence de référence de Marsaglia pour la seed 1', () => {
    // Valeurs calculées à la main : 1 → 8193 → 8193 → 8193 ^ (8193 << 5) = 270369.
    const rng = new Xorshift32(1);
    expect([rng.next(), rng.next(), rng.next()]).toEqual([270369, 67634689, 2647435461]);
  });

  it('reste uint32 non nul et ne renvoie jamais 0 sur 100000 tirages', () => {
    let x = 0xffffffff;
    for (let i = 0; i < 100000; i++) {
      x = xorshift32(x);
      expect(x > 0 && x <= 0xffffffff && Number.isInteger(x)).toBe(true);
    }
  });

  it.each([0, -1, 1.5, 2 ** 32, NaN, Infinity, '1', null, undefined])('rejette la seed %s', (s) => {
    expect(isValidSeed(s)).toBe(false);
    expect(() => new Simulation({ seed: s as number, rulesVersion: 1 })).toThrow(RangeError);
  });

  it('accepte les bornes 1 et 2^32 − 1', () => {
    expect(isValidSeed(1)).toBe(true);
    expect(isValidSeed(0xffffffff)).toBe(true);
  });
});

describe('vitesse par étage', () => {
  it('donne 675 milli/tick au premier étage de la seed 1 (calcul manuel)', () => {
    // 90 × (0.9 + 0.2 × 270369 / 2^32) = 81.00113… u/s → × 1000 / 120 = 675.009 → 675.
    expect(floorSpeed(1, 270369)).toBe(675);
  });

  it('applique +3 u/s par étage puis le plafond 210 avant la modulation', () => {
    const minDraw = 1; // facteur ≈ 0.9
    expect(floorSpeed(1, minDraw)).toBe(675); // 81 u/s
    expect(floorSpeed(2, minDraw)).toBe(698); // 83.7 u/s → 697.5 → 698 (demi vers +∞)
    expect(floorSpeed(41, minDraw)).toBe(1575); // 210 × 0.9
    expect(floorSpeed(500, minDraw)).toBe(1575);
    expect(floorSpeed(500, 0xffffffff)).toBe(1925); // 210 × 1.1 − ε → 1924.99… → 1925
  });
});

describe('géométrie de pose', () => {
  const base = { left: 100_000, width: 50_000 };

  it('garde exactement l’intersection et fait tomber le débord du bon côté', () => {
    expect(resolvePlacement(base, { left: 110_000, width: 50_000 })).toEqual({
      kind: 'placed', placed: { left: 110_000, width: 40_000 }, cut: { left: 150_000, width: 10_000 }, perfect: false,
    });
    expect(resolvePlacement(base, { left: 90_000, width: 50_000 })).toEqual({
      kind: 'placed', placed: { left: 100_000, width: 40_000 }, cut: { left: 90_000, width: 10_000 }, perfect: false,
    });
  });

  it('parfait à exactement 4 unités, pas à 4 unités + 1 milli', () => {
    const at = resolvePlacement(base, { left: base.left + PERFECT_TOLERANCE, width: base.width });
    expect(at).toEqual({ kind: 'placed', placed: base, cut: null, perfect: true });
    const atNeg = resolvePlacement(base, { left: base.left - PERFECT_TOLERANCE, width: base.width });
    expect(atNeg).toMatchObject({ perfect: true, placed: base });
    const after = resolvePlacement(base, { left: base.left + PERFECT_TOLERANCE + 1, width: base.width });
    expect(after).toMatchObject({ perfect: false, placed: { width: base.width - PERFECT_TOLERANCE - 1 } });
  });

  it('bords qui se touchent = raté ; 1 milli de chevauchement = posé', () => {
    expect(resolvePlacement(base, { left: 150_000, width: 50_000 })).toEqual({ kind: 'missed' });
    expect(resolvePlacement(base, { left: 50_000, width: 50_000 })).toEqual({ kind: 'missed' });
    expect(resolvePlacement(base, { left: 149_999, width: 50_000 })).toMatchObject({
      kind: 'placed', placed: { left: 149_999, width: 1 }, cut: { left: 150_000, width: 49_999 },
    });
  });

  it('raté prioritaire sur la tolérance parfait pour une base plus étroite que 4 unités', () => {
    const tiny = { left: 100_000, width: 2_000 };
    expect(resolvePlacement(tiny, { left: 103_000, width: 2_000 })).toEqual({ kind: 'missed' });
    expect(resolvePlacement(tiny, { left: 101_000, width: 2_000 })).toMatchObject({ kind: 'placed', perfect: true, placed: tiny });
  });

  it('réfléchit le trajet triangulaire au milli près', () => {
    const w = 240_000; // course max 120000
    expect(advance(119_000, 1, 675, w)).toEqual({ left: 119_675, dir: 1 });
    expect(advance(119_500, 1, 675, w)).toEqual({ left: 119_825, dir: -1 }); // 120175 → 2×120000 − 120175
    expect(advance(119_825, -1, 675, w)).toEqual({ left: 119_150, dir: -1 });
    expect(advance(120_000 - 675, 1, 675, w)).toEqual({ left: 120_000, dir: 1 });
    expect(advance(300, -1, 675, w)).toEqual({ left: 375, dir: 1 });
    // Vitesse supérieure à la course (hors règles v1) : reste dans les bornes.
    const far = advance(0, 1, 1_000_000, w);
    expect(far.left).toBeGreaterThanOrEqual(0);
    expect(far.left).toBeLessThanOrEqual(120_000);
  });
});

describe('simulation : ordre des ticks et placements', () => {
  it('état initial : base centrée de 240 u, étage 1 au bord gauche vers la droite, tick 0', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    expect(sim.tick).toBe(0);
    expect(sim.base).toEqual({ left: START_LEFT, width: START_WIDTH });
    expect(START_LEFT).toBe(60_000);
    expect(sim.moving).toEqual({ left: 0, width: START_WIDTH });
    expect(sim.direction).toBe(1);
    expect(sim.speed).toBe(675);
    expect(sim.score).toBe(0);
  });

  it('déplace avant de traiter l’appui du même tick', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    const ev = sim.step(true); // tick 1 : bloc à 675 puis pose
    expect(ev).toMatchObject({ kind: 'placed', tick: 1, floor: 1, placed: { left: 60_000, width: 180_675 } });
  });

  it('parfait au tick 89 (gauche 60075, écart 75 milli) puis étage 2 au bord droit vers la gauche', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    const ev = pressAt(sim, 89);
    expect(ev).toEqual({
      kind: 'placed', tick: 89, floor: 1, placed: { left: 60_000, width: 240_000 }, cut: null, perfect: true, perfectStreak: 1,
    });
    expect(sim.moving).toEqual({ left: FIELD_WIDTH - 240_000, width: 240_000 });
    expect(sim.direction).toBe(-1);
    expect(sim.perfectCount).toBe(1);
    // Le nouvel étage ne bouge qu'au tick suivant.
    sim.step(false);
    expect(sim.moving.left).toBe(120_000 - sim.speed);
  });

  it('pose non parfaite au tick 100 : intersection 232.5 u, débord de 7.5 u à droite', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    expect(pressAt(sim, 100)).toMatchObject({
      placed: { left: 67_500, width: 232_500 }, cut: { left: 300_000, width: 7_500 }, perfect: false, perfectStreak: 0,
    });
  });

  it('rebondit au tick 178 sur le bord droit (120150 → 119850)', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    while (sim.tick < 177) sim.step(false);
    expect(sim.moving.left).toBe(119_475);
    sim.step(false);
    expect(sim.moving.left).toBe(119_850);
    expect(sim.direction).toBe(-1);
  });

  it('séquence calculée à la main : seed 1, appuis 177, 433, 434 → score 2', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    expect(pressAt(sim, 177)).toMatchObject({ placed: { left: 119_475, width: 180_525 } });
    expect(sim.moving.left).toBe(179_475); // 360000 − 180525
    expect(sim.speed).toBe(700); // 93 × (0.9 + 0.2 × 67634689 / 2^32) × 1000 / 120 = 699.94
    expect(pressAt(sim, 433)).toMatchObject({ placed: { left: 119_475, width: 61_325 } }); // 179475 − 256×700 = 275
    expect(pressAt(sim, 434)).toMatchObject({ kind: 'missed', tick: 434, floor: 3 });
    expect(sim.result()).toEqual({
      seed: 1, rulesVersion: 1, score: 2, perfectCount: 0, durationTicks: 434, inputTicks: [177, 433, 434],
    });
  });

  it('le premier étage ne peut pas être raté (240 u toujours au-dessus de la base centrée)', () => {
    for (let t = 1; t <= 400; t++) {
      const sim = new Simulation({ seed: 7, rulesVersion: 1 });
      expect(pressAt(sim, t)?.kind).toBe('placed');
    }
  });

  it('série de parfaits : compte, se remet à zéro sur une pose imparfaite, garde la meilleure', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    // Écart prévu après le déplacement du prochain tick (loin des bords, donc sans rebond).
    const nextOffset = () => Math.abs(advance(sim.moving.left, sim.direction, sim.speed, sim.base.width).left - sim.base.left);
    const pressWhen = (cond: (offset: number) => boolean) => {
      for (;;) {
        const ev = sim.step(cond(nextOffset()));
        if (ev) return ev;
      }
    };
    expect(pressWhen((o) => o <= PERFECT_TOLERANCE)).toMatchObject({ perfect: true, perfectStreak: 1 });
    expect(pressWhen((o) => o <= PERFECT_TOLERANCE)).toMatchObject({ perfect: true, perfectStreak: 2 });
    expect(pressWhen((o) => o > 10_000 && o < 20_000)).toMatchObject({ kind: 'placed', perfect: false, perfectStreak: 0 });
    expect(sim.perfectStreak).toBe(0);
    expect(sim.bestPerfectStreak).toBe(2);
    expect(sim.perfectCount).toBe(2);
  });

  it('après la fin : step renvoie null, le tick et le résultat ne bougent plus', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    pressAt(sim, 177); pressAt(sim, 433); pressAt(sim, 434);
    const r = sim.result();
    expect(sim.step(true)).toBeNull();
    expect(sim.step(false)).toBeNull();
    expect(sim.tick).toBe(434);
    expect(sim.result()).toEqual(r);
  });

  it('result() vaut null tant que la partie continue et renvoie une copie des inputTicks', () => {
    const sim = new Simulation({ seed: 1, rulesVersion: 1 });
    expect(sim.result()).toBeNull();
    pressAt(sim, 177); pressAt(sim, 433); pressAt(sim, 434);
    const r = sim.result()!;
    r.inputTicks.push(9999);
    expect(sim.result()!.inputTicks).toEqual([177, 433, 434]);
  });

  it('rejette une rulesVersion inconnue', () => {
    expect(() => new Simulation({ seed: 1, rulesVersion: 2 as 1 })).toThrow(RangeError);
  });

  it('invariants sur 200 parties de bot : largeur décroissante, bloc dans le terrain, entiers', () => {
    let x = 99;
    for (let run = 0; run < 200; run++) {
      x = xorshift32(x);
      const sim = new Simulation({ seed: x, rulesVersion: 1 });
      let r = x;
      while (sim.status === 'running' && sim.tick < 200_000) {
        r = xorshift32(r);
        const m = sim.moving;
        expect(Number.isInteger(m.left)).toBe(true);
        expect(m.left).toBeGreaterThanOrEqual(0);
        expect(m.left + m.width).toBeLessThanOrEqual(FIELD_WIDTH);
        sim.step(r % 97 === 0);
      }
      const s = sim.stack;
      for (let i = 1; i < s.length; i++) {
        expect(s[i]!.width).toBeGreaterThan(0);
        expect(s[i]!.width).toBeLessThanOrEqual(s[i - 1]!.width);
        expect(s[i]!.left).toBeGreaterThanOrEqual(s[i - 1]!.left);
        expect(s[i]!.left + s[i]!.width).toBeLessThanOrEqual(s[i - 1]!.left + s[i - 1]!.width);
      }
      expect(sim.status).toBe('ended');
    }
  });
});
