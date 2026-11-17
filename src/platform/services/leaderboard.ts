/**
 * Client du service de classement (server/, V3-A3). Le jeu fonctionne sans lui :
 * - aucune adresse configurée (`VITE_LEADERBOARD_URL` vide, cas de GitHub Pages) → `unavailable` ;
 * - réseau coupé, délai dépassé → `offline` ; quotas → `busy` ; refus du serveur → `rejected`.
 * Aucune réponse n'est inventée : une erreur reste une erreur affichée comme telle.
 */

export type BoardKind = 'global' | 'weekly' | 'daily';
export type ServiceError = 'unavailable' | 'offline' | 'busy' | 'rejected' | 'server';
export type ServiceResult<T> = { ok: true; value: T } | { ok: false; error: ServiceError; code?: string };

export type RankTicket = {
  ticket: string;
  seed: number;
  rulesVersion: number;
  mode: 'free' | 'daily';
  day?: string;
  expiresAt: number;
};

export type BoardEntry = {
  rank: number;
  pseudo: string;
  score: number;
  height: number;
  perfectCount: number;
  demo?: boolean;
  you?: boolean;
};

export type BoardPage = {
  kind: BoardKind;
  period?: string;
  demo: boolean;
  total: number;
  nextOffset: number | null;
  entries: BoardEntry[];
  you?: { rank: number; score: number };
};

export type Placement = { rank: number; total: number; improved: boolean };
export type SubmitResponse =
  | { ranked: true; score: number; placements: Partial<Record<BoardKind, Placement>> }
  | { ranked: false; reason: string; score: number };

export type Submission = {
  ticket: string;
  playerId: string;
  pseudo: string;
  inputTicks: readonly number[];
  continueTicks?: readonly number[];
};

export type LeaderboardService = {
  /** `unavailable` : aucun serveur relié à cette version du jeu. */
  readonly available: boolean;
  issueTicket(mode: 'free' | 'daily', rulesVersion: number): Promise<ServiceResult<RankTicket>>;
  submit(submission: Submission): Promise<ServiceResult<SubmitResponse>>;
  read(kind: BoardKind, query: { rulesVersion: number; offset?: number; limit?: number; player?: string }): Promise<ServiceResult<BoardPage>>;
};

const UNAVAILABLE = { ok: false, error: 'unavailable' } as const;

export const unavailableLeaderboard: LeaderboardService = {
  available: false,
  issueTicket: () => Promise.resolve(UNAVAILABLE),
  submit: () => Promise.resolve(UNAVAILABLE),
  read: () => Promise.resolve(UNAVAILABLE),
};

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNat = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

function parseTicket(v: unknown): RankTicket | null {
  if (!isObj(v) || typeof v.ticket !== 'string' || !/^[0-9a-f]{32}$/.test(v.ticket)) return null;
  if (!isNat(v.seed) || v.seed === 0 || !isNat(v.rulesVersion) || !isNat(v.expiresAt)) return null;
  if (v.mode !== 'free' && v.mode !== 'daily') return null;
  if (v.mode === 'daily' && (typeof v.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.day))) return null;
  return {
    ticket: v.ticket,
    seed: v.seed,
    rulesVersion: v.rulesVersion,
    mode: v.mode,
    ...(v.mode === 'daily' ? { day: v.day as string } : {}),
    expiresAt: v.expiresAt,
  };
}

function parseEntry(v: unknown): BoardEntry | null {
  if (!isObj(v) || !isNat(v.rank) || typeof v.pseudo !== 'string' || v.pseudo.length > 32) return null;
  if (!isNat(v.score) || !isNat(v.height) || !isNat(v.perfectCount)) return null;
  return {
    rank: v.rank,
    pseudo: v.pseudo,
    score: v.score,
    height: v.height,
    perfectCount: v.perfectCount,
    ...(v.demo === true ? { demo: true } : {}),
    ...(v.you === true ? { you: true } : {}),
  };
}

function parsePage(v: unknown, kind: BoardKind): BoardPage | null {
  if (!isObj(v) || !Array.isArray(v.entries) || !isNat(v.total)) return null;
  const entries = v.entries.map(parseEntry);
  if (entries.some((e) => e === null)) return null;
  const you = isObj(v.you) && isNat(v.you.rank) && isNat(v.you.score) ? { rank: v.you.rank, score: v.you.score } : undefined;
  return {
    kind,
    ...(typeof v.period === 'string' ? { period: v.period } : {}),
    demo: v.demo === true,
    total: v.total,
    nextOffset: isNat(v.nextOffset) ? v.nextOffset : null,
    entries: entries as BoardEntry[],
    ...(you ? { you } : {}),
  };
}

function parseSubmit(v: unknown): SubmitResponse | null {
  if (!isObj(v) || !isNat(v.score)) return null;
  if (v.ranked === false) return { ranked: false, reason: typeof v.reason === 'string' ? v.reason : 'inconnu', score: v.score };
  if (v.ranked !== true || !isObj(v.placements)) return null;
  const placements: Partial<Record<BoardKind, Placement>> = {};
  for (const kind of ['global', 'weekly', 'daily'] as const) {
    const p = v.placements[kind];
    if (isObj(p) && isNat(p.rank) && isNat(p.total)) placements[kind] = { rank: p.rank, total: p.total, improved: p.improved === true };
  }
  return { ranked: true, score: v.score, placements };
}

export function createLeaderboardService(
  baseUrl: string | undefined,
  fetchFn: FetchFn = (url, init) => fetch(url, init),
  timeoutMs = 8000,
): LeaderboardService {
  const base = baseUrl?.trim().replace(/\/+$/, '');
  if (!base || !/^https?:\/\//.test(base)) return unavailableLeaderboard;

  async function call<T>(path: string, init: RequestInit, parse: (v: unknown) => T | null): Promise<ServiceResult<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchFn(base + path, { ...init, signal: controller.signal });
    } catch {
      return { ok: false, error: 'offline' };
    } finally {
      clearTimeout(timer);
    }
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      const code = isObj(body) && typeof body.error === 'string' ? body.error : undefined;
      const error: ServiceError = response.status === 429 ? 'busy' : response.status >= 500 ? 'server' : 'rejected';
      return { ok: false, error, ...(code ? { code } : {}) };
    }
    const value = parse(body);
    return value === null ? { ok: false, error: 'server', code: 'bad_response' } : { ok: true, value };
  }

  const post = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return {
    available: true,
    issueTicket: (mode, rulesVersion) => call('/tickets', post({ mode, rulesVersion }), parseTicket),
    submit: (s) => call('/scores', post(s), parseSubmit),
    read(kind, q) {
      const params = new URLSearchParams({ rulesVersion: String(q.rulesVersion) });
      if (q.offset) params.set('offset', String(q.offset));
      if (q.limit) params.set('limit', String(q.limit));
      if (q.player) params.set('player', q.player);
      return call(`/leaderboards/${kind}?${params.toString()}`, { method: 'GET' }, (v) => parsePage(v, kind));
    },
  };
}

// --- Identité de classement (pseudonyme, sur cet appareil) ----------------------------------

export type PlayerIdentity = { id: string; pseudo: string | null };

const PSEUDO = /^[\p{L}\p{N}][\p{L}\p{N} _-]{1,14}[\p{L}\p{N}]$/u;

/** Même règle que le serveur : 3 à 16 caractères, lettres, chiffres, espace, - ou _. */
export function cleanPseudo(raw: string): string | null {
  const p = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  return PSEUDO.test(p) ? p : null;
}

export function isPlayerIdentity(v: unknown): v is PlayerIdentity {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    /^[0-9a-f]{32}$/.test(v.id) &&
    (v.pseudo === null || (typeof v.pseudo === 'string' && cleanPseudo(v.pseudo) === v.pseudo))
  );
}
