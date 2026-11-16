import type { Block } from '../../src/game/core';

/** FNV-1a 32 bits sur les (left, width) successifs de la pile. */
export function stackFingerprint(stack: readonly Block[]): number {
  let h = 0x811c9dc5;
  for (const b of stack) {
    for (const v of [b.left, b.width]) {
      for (let i = 0; i < 4; i++) {
        h ^= (v >>> (i * 8)) & 0xff;
        h = Math.imul(h, 0x01000193) >>> 0;
      }
    }
  }
  return h >>> 0;
}
