/**
 * Image de résultat (V3-A6b) : carte F9 (`renderResultCard`, dérivée du rejeu) convertie en PNG.
 * Renvoie null si la carte ne peut pas être dessinée ou encodée : le shell partage alors le lien
 * seul et le dit (jamais d'image inventée).
 */
import type { Appearance, RunResult } from './game-contract';
import type { CardMode, ResultCard } from '../game';

export type RenderCard = (canvas: HTMLCanvasElement, card: ResultCard, options?: { scale?: number }) => boolean;

/** Échelle 0,5 : 540 × 675 px, assez net pour une messagerie et léger (< ~200 Ko). */
export const CARD_SCALE = 0.5;

export function createResultImage(render: RenderCard, doc: Document = document) {
  return async (result: RunResult, mode: CardMode, day: string | null, appearance?: Appearance): Promise<File | null> => {
    const canvas = doc.createElement('canvas');
    let drawn = false;
    try {
      drawn = render(canvas, { result, mode, ...(day ? { day } : {}), ...(appearance ? { appearance } : {}) }, { scale: CARD_SCALE });
    } catch {
      drawn = false;
    }
    if (!drawn || typeof canvas.toBlob !== 'function') return null;
    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob((b) => resolve(b), 'image/png');
      } catch {
        resolve(null);
      }
    });
    return blob && blob.size > 0 ? new File([blob], 'pile-ou-crash.png', { type: 'image/png' }) : null;
  };
}
