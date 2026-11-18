import { FIELD_WIDTH, MAGNET_TOLERANCE, PERFECT_TOLERANCE, SimulationV3, type StepEventV3 } from '../../src/game/core';

/** Joueur de test déterministe pour la v3 (règles : src/game/core/v3.ts). */
export type KindV3 = 'perfect' | 'snap' | 'placed' | 'miss';
type MissLike = Extract<StepEventV3, { kind: 'missed' | 'saved' }>;

/** Position du bloc mobile après le prochain déplacement. */
export function nextLeftV3(sim: SimulationV3): number {
  const max = FIELD_WIDTH - sim.base.width;
  const n = sim.moving.left + sim.direction * sim.speed;
  return n > max ? 2 * max - n : n < 0 ? -n : n;
}

/**
 * Avance sans appuyer jusqu'à pouvoir poser comme demandé, puis appuie.
 * perfect : écart ≤ 4 unités ; snap : écart dans ]4, 14] unités (parfait seulement sous l'Aimant) ;
 * placed : écart au-delà de la tolérance courante, base encore large ; miss : aucun recouvrement.
 */
export function playV3(sim: SimulationV3, kind: KindV3): StepEventV3 {
  for (let guard = 0; guard < 400_000; guard++) {
    if (sim.status === 'countdown') { sim.step(true); continue; } // appuis ignorés
    if (sim.status !== 'running') throw new Error(`état ${sim.status}`);
    const offset = Math.abs(nextLeftV3(sim) - sim.base.left);
    const w = sim.base.width;
    let press: boolean;
    if (kind === 'perfect') press = offset <= PERFECT_TOLERANCE;
    else if (kind === 'snap') press = offset > PERFECT_TOLERANCE && offset <= MAGNET_TOLERANCE;
    else if (kind === 'placed') press = offset > sim.tolerance && offset <= sim.tolerance + 6500;
    else press = offset >= w;
    const ev = sim.step(press);
    if (ev && ev.kind !== 'resumed') {
      if (kind !== 'miss' && ev.kind !== 'placed') throw new Error(`raté inattendu (${kind})`);
      return ev;
    }
  }
  throw new Error(`impossible de jouer ${kind}`);
}

/** Pose large jusqu'à ce qu'un raté soit géométriquement possible, puis rate. */
export function shrinkThenMissV3(sim: SimulationV3): MissLike {
  for (let guard = 0; guard < 2_000_000; guard++) {
    if (sim.status === 'countdown') { sim.step(false); continue; }
    const w = sim.base.width;
    const max = FIELD_WIDTH - w;
    const canMiss = Math.max(sim.base.left, max - sim.base.left) >= w;
    if (canMiss) return playV3(sim, 'miss') as MissLike;
    const next = nextLeftV3(sim);
    const atEdge = next === 0 || next === max ||
      (sim.direction === 1 ? next + sim.speed > max : next - sim.speed < 0);
    const ev = sim.step(atEdge && Math.abs(next - sim.base.left) < w && Math.abs(next - sim.base.left) > sim.tolerance);
    if (ev?.kind === 'missed' || ev?.kind === 'saved') return ev;
  }
  throw new Error('raté impossible');
}

/** Avance jusqu'au prochain événement (pose, raté, rattrapage, reprise) sans appuyer. */
export function waitResume(sim: SimulationV3): StepEventV3 | null {
  for (let guard = 0; guard < 10_000; guard++) {
    const ev = sim.step(false);
    if (ev) return ev;
  }
  return null;
}
