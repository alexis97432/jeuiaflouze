/**
 * Vies de reprise (V3) gagnées **en jeu** : achetées avec des pièces, qui se gagnent en jouant et
 * ne s'achètent pas. Aucune vie n'est vendue contre de l'argent réel dans cette version.
 * - Stock borné (MAX_LIVES) ;
 * - une vie n'est retirée qu'une fois par reprise (`requestId`) : double appui, rappel répété ou
 *   deux onglets ne la retirent pas deux fois ;
 * - une vie retirée pour une reprise qui n'a pas eu lieu est rendue, une seule fois.
 * Fonctions pures, appelées sur le document relu sous verrou (withProgressLock + updateDoc).
 */
import type { ProgressDoc } from './economy';

export const LIFE_PRICE = 30;
export const MAX_LIVES = 5;
/** Reprises récentes mémorisées pour l'idempotence (borné). */
export const MAX_SPENT = 50;

export const livesOf = (doc: ProgressDoc): number => doc.lives ?? 0;

export type BuyLife = { ok: true; doc: ProgressDoc } | { ok: false; doc: ProgressDoc; reason: 'full' | 'insufficient'; missing?: number };

export function buyLife(doc: ProgressDoc): BuyLife {
  const lives = livesOf(doc);
  if (lives >= MAX_LIVES) return { ok: false, doc, reason: 'full' };
  if (doc.coins < LIFE_PRICE) return { ok: false, doc, reason: 'insufficient', missing: LIFE_PRICE - doc.coins };
  return { ok: true, doc: { ...doc, coins: doc.coins - LIFE_PRICE, lives: lives + 1 } };
}

export type UseLife = { ok: true; doc: ProgressDoc; already: boolean } | { ok: false; doc: ProgressDoc };

export function useLife(doc: ProgressDoc, requestId: string): UseLife {
  const spent = doc.livesSpent ?? [];
  if (spent.includes(requestId)) return { ok: true, doc, already: true };
  const lives = livesOf(doc);
  if (lives <= 0) return { ok: false, doc };
  return { ok: true, already: false, doc: { ...doc, lives: lives - 1, livesSpent: [...spent, requestId].slice(-MAX_SPENT) } };
}

export function returnLife(doc: ProgressDoc, requestId: string): ProgressDoc {
  const spent = doc.livesSpent ?? [];
  if (!spent.includes(requestId)) return doc;
  return { ...doc, lives: Math.min(MAX_LIVES, livesOf(doc) + 1), livesSpent: spent.filter((id) => id !== requestId) };
}

const SPENT_ID = /^[A-Za-z0-9:_-]{1,80}$/;
export function sanitizeLives(raw: Record<string, unknown>): { lives?: number; livesSpent?: string[] } {
  const lives = typeof raw.lives === 'number' && Number.isInteger(raw.lives) ? Math.max(0, Math.min(MAX_LIVES, raw.lives)) : 0;
  const spent = Array.isArray(raw.livesSpent)
    ? [...new Set(raw.livesSpent.filter((x): x is string => typeof x === 'string' && SPENT_ID.test(x)))].slice(-MAX_SPENT)
    : [];
  return { ...(lives > 0 ? { lives } : {}), ...(spent.length > 0 ? { livesSpent: spent } : {}) };
}
