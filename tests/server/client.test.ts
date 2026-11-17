import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { replayRun } from '../../src/game/core';
import { createLeaderboardService, cleanPseudo, isPlayerIdentity, unavailableLeaderboard } from '../../src/platform/services/leaderboard';
import { createApp, DEFAULT_CONFIG } from '../../server/app';
import { createMemoryStore } from '../../server/store';
import { botRun } from '../game/bot';

let server: Server;
let base: string;
let now = Date.UTC(2026, 10, 17, 12);
let seq = 0;

beforeAll(async () => {
  const handle = createApp({
    store: createMemoryStore(),
    replay: (i) => replayRun(i),
    now: () => now,
    randomHex: () => (++seq).toString(16).padStart(32, '0'),
    randomSeed: () => 99,
    config: DEFAULT_CONFIG,
  });
  server = createServer((req, res) => void handle(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('client du classement contre le vrai serveur', () => {
  it('ticket → partie → envoi → lecture du tableau', async () => {
    const svc = createLeaderboardService(base);
    expect(svc.available).toBe(true);
    const t = await svc.issueTicket('free', 1);
    if (!t.ok) throw new Error(t.error);
    const run = botRun(t.value.seed, 4, 300);
    now += 60 * 60_000;
    const r = await svc.submit({ ticket: t.value.ticket, playerId: 'e'.repeat(32), pseudo: 'Kiwi', inputTicks: run.inputTicks });
    expect(r).toEqual({
      ok: true,
      value: {
        ranked: true,
        score: run.score,
        placements: { global: { rank: 1, total: 1, improved: true }, weekly: { rank: 1, total: 1, improved: true } },
      },
    });
    const board = await svc.read('global', { rulesVersion: 1, player: 'e'.repeat(32) });
    expect(board).toMatchObject({ ok: true, value: { total: 1, demo: false, you: { rank: 1 }, entries: [{ pseudo: 'Kiwi', you: true, rank: 1 }] } });
  });

  it('erreurs typées : refus, hors ligne, délai dépassé, quota, réponse malformée', async () => {
    const svc = createLeaderboardService(base);
    expect(await svc.submit({ ticket: 'f'.repeat(32), playerId: 'e'.repeat(32), pseudo: 'Kiwi', inputTicks: [1] }))
      .toEqual({ ok: false, error: 'rejected', code: 'unknown_ticket' });
    const offline = createLeaderboardService('https://x.test', () => Promise.reject(new TypeError('Failed to fetch')));
    expect(await offline.read('global', { rulesVersion: 1 })).toEqual({ ok: false, error: 'offline' });
    const slow = createLeaderboardService('https://x.test', (_u, init) => new Promise((_r, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('abort', 'AbortError')));
    }), 20);
    expect(await slow.read('global', { rulesVersion: 1 })).toEqual({ ok: false, error: 'offline' });
    const busy = createLeaderboardService('https://x.test', async () => new Response('{"error":"rate_limited"}', { status: 429 }));
    expect(await busy.issueTicket('free', 1)).toEqual({ ok: false, error: 'busy', code: 'rate_limited' });
    const junk = createLeaderboardService('https://x.test', async () => new Response('{"entries":[{"rank":"1"}],"total":1}'));
    expect(await junk.read('global', { rulesVersion: 1 })).toEqual({ ok: false, error: 'server', code: 'bad_response' });
  });

  it('sans adresse configurée : indisponible, aucune requête possible', async () => {
    expect(createLeaderboardService(undefined)).toBe(unavailableLeaderboard);
    expect(createLeaderboardService('  ')).toBe(unavailableLeaderboard);
    expect(createLeaderboardService('ftp://x')).toBe(unavailableLeaderboard);
    expect(await unavailableLeaderboard.read('global', { rulesVersion: 1 })).toEqual({ ok: false, error: 'unavailable' });
  });

  it('pseudo et identité', () => {
    expect(cleanPseudo('  Ab   cd ')).toBe('Ab cd');
    expect(cleanPseudo('ab')).toBeNull();
    expect(cleanPseudo('a'.repeat(17))).toBeNull();
    expect(cleanPseudo('<script>')).toBeNull();
    expect(isPlayerIdentity({ id: 'a'.repeat(32), pseudo: null })).toBe(true);
    expect(isPlayerIdentity({ id: 'a'.repeat(31), pseudo: null })).toBe(false);
    expect(isPlayerIdentity({ id: 'a'.repeat(32), pseudo: ' x' })).toBe(false);
  });
});
