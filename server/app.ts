/**
 * Serveur de classement (V3-A3) — routes HTTP sans dépendance externe.
 *
 *   GET  /api/v1/health
 *   POST /api/v1/tickets                 { mode: 'free' | 'daily', rulesVersion? }
 *   POST /api/v1/scores                  { ticket, playerId, pseudo, inputTicks, continueTicks? }
 *   GET  /api/v1/leaderboards/:kind      ?rulesVersion=&period=&offset=&limit=&player=
 *
 * Un score n'est jamais pris tel quel : le serveur émet la seed (ticket à usage unique), puis
 * recalcule le résultat par le rejeu partagé avec FLK (`replayRun`). Limites de taille, quotas
 * par adresse, idempotence par ticket. Un rejeu valide ne prouve pas un humain (bots possibles) :
 * limite documentée dans server/README.md.
 */
import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dailySeed, utcDateKey } from '../src/platform/daily';
import {
  boardKey,
  isBetter,
  isoWeek,
  page,
  rank,
  validPlayerId,
  validPseudo,
  type BoardKind,
  type ScoreEntry,
} from './leaderboard';
import { createRateLimiter } from './rate-limit';
import type { Store, Ticket } from './store';

export type ReplayFn = (input: unknown) =>
  | { ok: true; result: { score: number; perfectCount: number; durationTicks: number; height?: number; continues?: number } }
  | { ok: false; error: string; detail: string };

export type AppConfig = {
  allowedOrigins: readonly string[];
  /** Versions de règles acceptées (v1 et v2, F6). */
  rulesVersions: readonly number[];
  demo: boolean;
  maxBodyBytes: number;
  ticketTtlMs: number;
  /** Tolérance (ms) entre durée de partie rejouée et temps réel écoulé depuis le ticket. */
  clockSlackMs: number;
};

export type AppDeps = {
  store: Store;
  replay: ReplayFn;
  now: () => number;
  randomHex: (bytes: number) => string;
  randomSeed: () => number;
  config: AppConfig;
};

export const DEFAULT_CONFIG: AppConfig = {
  allowedOrigins: [],
  rulesVersions: [1, 2],
  demo: false,
  maxBodyBytes: 64 * 1024,
  ticketTtlMs: 2 * 60 * 60 * 1000,
  clockSlackMs: 2000,
};

const TICK_RATE = 120;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function readJson(req: IncomingMessage, max: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > max) throw new HttpError(413, 'payload_too_large', `corps > ${max} octets`);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null') as unknown;
  } catch {
    throw new HttpError(400, 'bad_json', 'JSON invalide');
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

export function createApp(deps: AppDeps) {
  const { store, config } = deps;
  const ticketLimiter = createRateLimiter(30, 30);
  const scoreLimiter = createRateLimiter(10, 10);
  const readLimiter = createRateLimiter(120, 120);

  const clientKey = (req: IncomingMessage) =>
    (req.socket.remoteAddress ?? 'inconnu').replace(/^::ffff:/, '');

  const limit = (limiter: { take(k: string, n: number): boolean }, req: IncomingMessage, action: string) => {
    if (!limiter.take(`${clientKey(req)}:${action}`, deps.now())) {
      throw new HttpError(429, 'rate_limited', 'trop de requêtes, réessaie dans un moment');
    }
  };

  const issueTicket = (body: unknown): Ticket => {
    const b = (body ?? {}) as Record<string, unknown>;
    const mode = b.mode === 'daily' ? 'daily' : b.mode === 'free' || b.mode === undefined ? 'free' : null;
    if (!mode) throw new HttpError(400, 'bad_mode', "mode 'free' ou 'daily' attendu");
    const rulesVersion = b.rulesVersion ?? config.rulesVersions[0];
    if (typeof rulesVersion !== 'number' || !config.rulesVersions.includes(rulesVersion)) {
      throw new HttpError(400, 'bad_rules_version', `versions acceptées : ${config.rulesVersions.join(', ')}`);
    }
    const now = deps.now();
    const day = mode === 'daily' ? utcDateKey(new Date(now)) : undefined;
    const ticket: Ticket = {
      id: deps.randomHex(16),
      seed: day ? dailySeed(day) : deps.randomSeed(),
      rulesVersion,
      mode,
      ...(day ? { day } : {}),
      issuedAt: now,
      expiresAt: now + config.ticketTtlMs,
    };
    store.putTicket(ticket);
    return ticket;
  };

  const submitScore = (body: unknown) => {
    const b = (body ?? {}) as Record<string, unknown>;
    if (typeof b.ticket !== 'string' || !/^[0-9a-f]{32}$/.test(b.ticket)) throw new HttpError(400, 'bad_ticket', 'ticket invalide');
    const playerId = validPlayerId(b.playerId);
    if (!playerId) throw new HttpError(400, 'bad_player', 'identifiant joueur invalide');
    const pseudo = validPseudo(b.pseudo);
    if (!pseudo) throw new HttpError(400, 'bad_pseudo', 'pseudo : 3 à 16 lettres, chiffres, espace, - ou _');

    const ticket = store.getTicket(b.ticket);
    const now = deps.now();
    if (!ticket || ticket.expiresAt < now) throw new HttpError(404, 'unknown_ticket', 'ticket inconnu ou expiré');

    const payload = { playerId, pseudo, inputTicks: b.inputTicks, continueTicks: b.continueTicks ?? [] };
    const payloadHash = hash(payload);
    if (ticket.consumed) {
      // Idempotence : même soumission → même réponse ; autre contenu → refus.
      if (ticket.consumed.payloadHash === payloadHash) return { status: 200, body: ticket.consumed.response };
      throw new HttpError(409, 'ticket_used', 'ce ticket a déjà servi pour une autre partie');
    }

    const outcome = deps.replay({
      seed: ticket.seed,
      rulesVersion: ticket.rulesVersion,
      inputTicks: b.inputTicks,
      ...(ticket.rulesVersion >= 2 ? { continueTicks: b.continueTicks ?? [] } : {}),
    });
    if (!outcome.ok) throw new HttpError(422, `replay_${outcome.error}`, outcome.detail);
    const r = outcome.result;
    const height = typeof r.height === 'number' ? r.height : r.score;
    const continues = r.continues ?? 0;

    // Vraisemblance : la partie rejouée ne peut pas avoir duré plus que le temps écoulé.
    const playedMs = (r.durationTicks / TICK_RATE) * 1000;
    if (playedMs > now - ticket.issuedAt + config.clockSlackMs) {
      throw new HttpError(422, 'too_fast', 'durée de partie impossible depuis l’émission du ticket');
    }

    let response: unknown;
    if (continues > 0) {
      response = { ranked: false, reason: 'continued', score: r.score, height };
    } else {
      const entry: ScoreEntry = { playerId, pseudo, score: r.score, height, perfectCount: r.perfectCount, achievedAt: now };
      const boards: { kind: BoardKind; key: string }[] =
        ticket.mode === 'daily'
          ? [{ kind: 'daily', key: boardKey('daily', ticket.rulesVersion, ticket.day) }]
          : [
              { kind: 'global', key: boardKey('global', ticket.rulesVersion) },
              { kind: 'weekly', key: boardKey('weekly', ticket.rulesVersion, isoWeek(new Date(now))) },
            ];
      const placements: Record<string, { rank: number; total: number; improved: boolean }> = {};
      for (const { kind, key } of boards) {
        const improved = isBetter(entry, store.getBest(key, playerId));
        if (improved) store.putBest(key, entry);
        const ranked = rank(store.listBoard(key));
        placements[kind] = { rank: ranked.find((e) => e.playerId === playerId)!.rank, total: ranked.length, improved };
      }
      response = { ranked: true, score: r.score, height, perfectCount: r.perfectCount, placements };
    }
    store.putTicket({ ...ticket, consumed: { payloadHash, response } });
    return { status: 200, body: response };
  };

  const readBoard = (kind: string, url: URL) => {
    if (kind !== 'global' && kind !== 'weekly' && kind !== 'daily') throw new HttpError(404, 'unknown_board', 'tableau inconnu');
    const rv = Number(url.searchParams.get('rulesVersion') ?? config.rulesVersions[0]);
    if (!config.rulesVersions.includes(rv)) throw new HttpError(400, 'bad_rules_version', 'version de règles inconnue');
    const now = new Date(deps.now());
    const rawPeriod = url.searchParams.get('period');
    let period: string | undefined;
    if (kind === 'weekly') {
      period = rawPeriod ?? isoWeek(now);
      if (!/^\d{4}-W\d{2}$/.test(period)) throw new HttpError(400, 'bad_period', 'semaine AAAA-Wss attendue');
    } else if (kind === 'daily') {
      period = rawPeriod ?? utcDateKey(now);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) throw new HttpError(400, 'bad_period', 'date AAAA-MM-JJ attendue');
    }
    const key = boardKey(kind, rv, period);
    const ranked = rank(store.listBoard(key));
    const offset = Number(url.searchParams.get('offset') ?? 0) || 0;
    const lim = Number(url.searchParams.get('limit') ?? 20) || 20;
    const p = page(ranked, offset, lim);
    const player = validPlayerId(url.searchParams.get('player'));
    const you = player ? ranked.find((e) => e.playerId === player) : undefined;
    return {
      board: key,
      kind,
      rulesVersion: rv,
      ...(period ? { period } : {}),
      demo: ranked.some((e) => e.demo),
      total: p.total,
      nextOffset: p.nextOffset,
      // Jamais l'identifiant des autres joueurs : seulement pseudo, rang et résultat.
      entries: p.entries.map(({ playerId, ...e }) => ({ ...e, ...(playerId === player ? { you: true } : {}) })),
      ...(you ? { you: { rank: you.rank, score: you.score } } : {}),
    };
  };

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    try {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }
      const url = new URL(req.url ?? '/', 'http://local');
      const path = url.pathname.replace(/\/+$/, '');
      if (path === '/api/v1/health' && req.method === 'GET') {
        return send(res, 200, { ok: true, rulesVersions: config.rulesVersions, demo: config.demo });
      }
      if (path === '/api/v1/tickets') {
        if (req.method !== 'POST') throw new HttpError(405, 'method', 'POST attendu');
        limit(ticketLimiter, req, 'ticket');
        const t = issueTicket(await readJson(req, config.maxBodyBytes));
        return send(res, 201, { ticket: t.id, seed: t.seed, rulesVersion: t.rulesVersion, mode: t.mode, ...(t.day ? { day: t.day } : {}), expiresAt: t.expiresAt });
      }
      if (path === '/api/v1/scores') {
        if (req.method !== 'POST') throw new HttpError(405, 'method', 'POST attendu');
        limit(scoreLimiter, req, 'score');
        const { status, body } = submitScore(await readJson(req, config.maxBodyBytes));
        return send(res, status, body);
      }
      const m = /^\/api\/v1\/leaderboards\/([a-z]+)$/.exec(path);
      if (m && req.method === 'GET') {
        limit(readLimiter, req, 'read');
        return send(res, 200, readBoard(m[1]!, url));
      }
      throw new HttpError(404, 'not_found', 'route inconnue');
    } catch (error) {
      if (error instanceof HttpError) return send(res, error.status, { error: error.code, message: error.message });
      console.error('[serveur] erreur interne', error);
      return send(res, 500, { error: 'internal', message: 'erreur interne' });
    }
  };
}
