/**
 * URL de défi amical `?v=<1|2>&seed=<uint32>&target=<entier>` (docs/CONTRACTS.md § Shell).
 * `v=1` : anciens liens, rejoués en règles v1. `v=2` (V3) : même règles que la partie d'origine.
 * `target` est toujours une hauteur en étages (jamais des points ×2).
 * Validation stricte : entiers décimaux sans signe, sans zéro initial, sans espace.
 * `target` est une déclaration amicale, jamais un score vérifié.
 * Les autres paramètres (ex. utm_*) sont ignorés ; un paramètre du défi répété est refusé.
 */
import { PLAY_RULES_VERSION, RULES_VERSION, RULES_VERSION_V2 } from './game-contract';

export type ChallengeRules = typeof RULES_VERSION | typeof RULES_VERSION_V2 | typeof PLAY_RULES_VERSION;
/** Liens acceptés : v1 et v2 (déjà partagés, joués avec leurs règles) et v3 (V5). */
const ACCEPTED: readonly ChallengeRules[] = [RULES_VERSION, RULES_VERSION_V2, PLAY_RULES_VERSION];

export const MAX_SEED = 0xffffffff;
export const MAX_TARGET = 10_000;

export type Challenge = { seed: number; target: number; rulesVersion: ChallengeRules };

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

  const rulesVersion = ACCEPTED.find((v) => params.get('v') === String(v));
  if (rulesVersion === undefined) return { kind: 'invalid', reason: 'version' };
  const seed = parseInteger(params.get('seed') ?? '', 1, MAX_SEED);
  if (seed === null) return { kind: 'invalid', reason: 'seed' };
  const target = parseInteger(params.get('target') ?? '', 0, MAX_TARGET);
  if (target === null) return { kind: 'invalid', reason: 'target' };
  return { kind: 'challenge', challenge: { seed, target, rulesVersion } };
}

/** Construit le lien de défi à partir de l'origine et du chemin courants, sans autre paramètre. */
export function buildChallengeUrl(base: string, seed: number, score: number, rulesVersion: ChallengeRules = RULES_VERSION): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('v', String(rulesVersion));
  url.searchParams.set('seed', String(seed));
  url.searchParams.set('target', String(Math.min(Math.max(0, Math.trunc(score)), MAX_TARGET)));
  return url.toString();
}

/** Messages pour un enfant (V4) : ce qui ne va pas, et quoi faire, sans mot technique. */
export const INVALID_MESSAGES: Record<InvalidReason, string> = {
  version: 'Ce lien de défi vient d’une autre version du jeu. Lance une nouvelle partie !',
  seed: 'Ce lien de défi est abîmé : la partie à rejouer manque. Demande à ton ami de te le renvoyer.',
  target: 'Ce lien de défi est abîmé : le score à battre manque. Demande à ton ami de te le renvoyer.',
  malformed: 'Ce lien de défi est abîmé. Demande à ton ami de te le renvoyer.',
};
