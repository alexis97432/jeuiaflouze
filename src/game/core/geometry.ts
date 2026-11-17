import { FIELD_WIDTH, PERFECT_TOLERANCE } from './constants';

/** Segment horizontal en milli entiers. `width` > 0. */
export interface Block {
  readonly left: number;
  readonly width: number;
}

export type PlacementOutcome =
  | {
      readonly kind: 'placed';
      /** Nouvelle base. */
      readonly placed: Block;
      /** Partie qui tombe, ou null s'il n'y en a pas. */
      readonly cut: Block | null;
      readonly perfect: boolean;
    }
  | { readonly kind: 'missed' };

/**
 * Résout la pose du bloc mobile sur la base.
 *
 * Ordre des règles :
 * 1. intersection horizontale ≤ 0 (bords qui se touchent inclus) → raté,
 *    même si l'écart des bords gauches est dans la tolérance ;
 * 2. |gauche mobile − gauche base| ≤ tolérance (PERFECT_TOLERANCE par défaut ; plus large
 *    sous l'Aimant des règles v3) → parfait : la nouvelle
 *    base reprend exactement la base (pas d'agrandissement), rien ne tombe ;
 * 3. sinon on garde exactement l'intersection et le reste tombe d'un seul côté
 *    (le bloc mobile a la largeur de la base, donc un seul débord est possible).
 */
export function resolvePlacement(base: Block, moving: Block, tolerance: number = PERFECT_TOLERANCE): PlacementOutcome {
  const left = Math.max(base.left, moving.left);
  const right = Math.min(base.left + base.width, moving.left + moving.width);
  const overlap = right - left;
  if (overlap <= 0) return { kind: 'missed' };

  if (Math.abs(moving.left - base.left) <= tolerance) {
    return { kind: 'placed', placed: { left: base.left, width: base.width }, cut: null, perfect: true };
  }

  const placed: Block = { left, width: overlap };
  const cutWidth = moving.width - overlap;
  let cut: Block | null = null;
  if (cutWidth > 0) {
    cut = moving.left < left
      ? { left: moving.left, width: cutWidth }
      : { left: right, width: cutWidth };
  }
  return { kind: 'placed', placed, cut, perfect: false };
}

/**
 * Avance un bloc sur un trajet triangulaire dans [0, FIELD_WIDTH − width].
 * Le rebond est réfléchi au milli près ; boucle de sécurité si la vitesse
 * dépassait la course (impossible avec les règles v1, mais testé).
 */
export function advance(
  left: number,
  dir: 1 | -1,
  speed: number,
  width: number,
): { left: number; dir: 1 | -1 } {
  const max = FIELD_WIDTH - width;
  if (max <= 0) return { left: 0, dir };
  let pos = left + dir * speed;
  let d = dir;
  for (;;) {
    if (pos > max) {
      pos = 2 * max - pos;
      d = -1;
    } else if (pos < 0) {
      pos = -pos;
      d = 1;
    } else {
      return { left: pos, dir: d };
    }
  }
}
