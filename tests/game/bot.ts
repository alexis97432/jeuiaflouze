import { FIELD_WIDTH, Simulation, type RunResult } from '../../src/game/core';

/**
 * Joueur déterministe pour produire des rejeux de test.
 * Phase 1 : `aligned` placements au premier tick où |écart| ≤ `tolerance` milli.
 * Phase 2 : pose au plus grand écart atteignable pour rétrécir la base,
 * puis rate dès qu'un raté est géométriquement possible.
 */
export function botRun(seed: number, aligned: number, tolerance: number, maxTicks = 2_000_000): RunResult {
  const sim = new Simulation({ seed, rulesVersion: 1 });
  let placedAligned = 0;
  while (sim.status === 'running') {
    if (sim.tick >= maxTicks) throw new Error('bot bloqué');
    const base = sim.base;
    const w = base.width;
    const max = FIELD_WIDTH - w;
    // Prévoir la position après le déplacement du prochain tick.
    let next = sim.moving.left + sim.direction * sim.speed;
    if (next > max) next = 2 * max - next;
    else if (next < 0) next = -next;
    const offset = Math.abs(next - base.left);
    let press: boolean;
    if (placedAligned < aligned) {
      press = offset <= tolerance;
    } else {
      const canMiss = Math.max(base.left, max - base.left) >= w;
      const atEdge = next === 0 || next === max ||
        (sim.direction === 1 ? next + sim.speed > max : next - sim.speed < 0);
      press = canMiss ? offset >= w : atEdge;
    }
    const ev = sim.step(press);
    if (ev?.kind === 'placed' && placedAligned < aligned) placedAligned++;
  }
  return sim.result()!;
}
