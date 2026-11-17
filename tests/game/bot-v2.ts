import { FIELD_WIDTH, PERFECT_TOLERANCE, SimulationV2, type StepEventV2 } from '../../src/game/core';

/** Joueur de test déterministe pour la v2 (règles : src/game/core/v2.ts). */
export type Kind = 'perfect' | 'placed' | 'miss';
type MissedEvent = Extract<StepEventV2, { kind: 'missed' }>;

/** Position du bloc mobile après le prochain déplacement. */
export function nextLeft(sim: SimulationV2): number {
  const max = FIELD_WIDTH - sim.base.width;
  const n = sim.moving.left + sim.direction * sim.speed;
  return n > max ? 2 * max - n : n < 0 ? -n : n;
}

/**
 * Avance sans appuyer jusqu'à pouvoir poser comme demandé, puis appuie.
 * perfect : écart ≤ tolérance ; placed : écart dans ]tolérance, 6500] (la base reste large) ;
 * miss : rétrécit la base par des poses extrêmes jusqu'à ce qu'un raté soit possible.
 */
export function play(sim: SimulationV2, kind: Kind): StepEventV2 {
  for (let guard = 0; guard < 200_000; guard++) {
    if (sim.status === 'countdown') { sim.step(true); continue; } // appuis ignorés
    if (sim.status !== 'running') throw new Error(`état ${sim.status}`);
    const offset = Math.abs(nextLeft(sim) - sim.base.left);
    const w = sim.base.width;
    let press: boolean;
    if (kind === 'perfect') press = offset <= PERFECT_TOLERANCE;
    else if (kind === 'placed') press = offset > PERFECT_TOLERANCE && offset <= 6500;
    else press = offset >= w;
    const ev = sim.step(press);
    if (ev && ev.kind !== 'resumed') {
      if (kind !== 'miss' && ev.kind !== 'placed') throw new Error('raté inattendu');
      return ev;
    }
  }
  throw new Error(`impossible de jouer ${kind}`);
}

/** Pose large jusqu'à ce qu'un raté soit géométriquement possible, puis rate. */
export function shrinkThenMiss(sim: SimulationV2): MissedEvent {
  for (let guard = 0; guard < 2_000_000; guard++) {
    if (sim.status === 'countdown') { sim.step(false); continue; }
    const w = sim.base.width;
    const max = FIELD_WIDTH - w;
    const canMiss = Math.max(sim.base.left, max - sim.base.left) >= w;
    if (canMiss) return play(sim, 'miss') as MissedEvent;
    const next = nextLeft(sim);
    const atEdge = next === 0 || next === max ||
      (sim.direction === 1 ? next + sim.speed > max : next - sim.speed < 0);
    const ev = sim.step(atEdge && Math.abs(next - sim.base.left) < w);
    if (ev?.kind === 'missed') return ev;
  }
  throw new Error('raté impossible');
}

