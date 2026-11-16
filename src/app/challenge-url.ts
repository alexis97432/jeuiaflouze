/**
 * URL de défi amical `?v=1&seed=<uint32>&target=<entier>` (docs/CONTRACTS.md § Shell).
 * Validation stricte : entiers décimaux sans signe, sans zéro initial, sans espace.
 * `target` est une déclaration amicale, jamais un score vérifié.
 * Les autres paramètres (ex. utm_*) sont ignorés ; un paramètre du défi répété est refusé.
 */
import { RULES_VERSION } from './game-contract';

export const MAX_SEED = 0xffffffff;
export const MAX_TARGET = 10_000;

export type Challenge = { seed: number; target: number; rulesVersion: typeof RULES_VERSION };

export type ChallengeParse =
  | { kind: 'none' }
  | { kind: 'challenge'; challenge: Challenge }
  | { kind: 'invalid'; reason: InvalidReason };

export type InvalidReason = 'version' | 'seed' | 'target' | 'malformed';

const KEYS = ['v', 'seed', 'target'] as const;
const DECIMAL = /^(0|[1-9][0-9]{0,9})$/;

function parseInteger(raw: string, min: number, max: number): number | null {
  if (!DECIMAL.test(raw)) return null;
  const value = Number(raw);
  return value >= min && value <= max ? value : null;
}

export function parseChallenge(search: string): ChallengeParse {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return { kind: 'invalid', reason: 'malformed' };
  }
  if (KEYS.every((k) => !params.has(k))) return { kind: 'none' };
  if (KEYS.some((k) => params.getAll(k).length !== 1)) return { kind: 'invalid', reason: 'malformed' };

  if (params.get('v') !== String(RULES_VERSION)) return { kind: 'invalid', reason: 'version' };
  const seed = parseInteger(params.get('seed') ?? '', 1, MAX_SEED);
  if (seed === null) return { kind: 'invalid', reason: 'seed' };
  const target = parseInteger(params.get('target') ?? '', 0, MAX_TARGET);
  if (target === null) return { kind: 'invalid', reason: 'target' };
  return { kind: 'challenge', challenge: { seed, target, rulesVersion: RULES_VERSION } };
}

/** Construit le lien de défi à partir de l'origine et du chemin courants, sans autre paramètre. */
export function buildChallengeUrl(base: string, seed: number, score: number): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('v', String(RULES_VERSION));
  url.searchParams.set('seed', String(seed));
  url.searchParams.set('target', String(Math.min(Math.max(0, Math.trunc(score)), MAX_TARGET)));
  return url.toString();
}

export const INVALID_MESSAGES: Record<InvalidReason, string> = {
  version: 'Ce lien de défi vient d’une autre version du jeu.',
  seed: 'Ce lien de défi est incomplet ou abîmé (séquence invalide).',
  target: 'Ce lien de défi est incomplet ou abîmé (score invalide).',
  malformed: 'Ce lien de défi est mal formé.',
};
