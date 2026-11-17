import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { replayRun } from '../../src/game/core';
import { botRun } from '../game/bot';
import { dailySeed } from '../../src/platform/daily';
import { createApp, DEFAULT_CONFIG, type AppConfig } from '../../server/app';
import { seedDemo } from '../../server/demo';
import { createMemoryStore, type Store } from '../../server/store';

/** Partie valide produite par le bot de test de FLK (n placements alignés, puis raté). */
const run = (seed: number, aligned: number) => botRun(seed, aligned, 300);
const play = (seed: number, aligned: number) => run(seed, aligned).inputTicks;

const PLAYER = 'a'.repeat(32);
const OTHER = 'b'.repeat(32);

let now = Date.UTC(2026, 10, 17, 12, 0, 0);
let store: Store;
let server: Server;
let base: string;
let seq = 0;

async function start(config: Partial<AppConfig> = {}) {
  const handle = createApp({
    store,
    replay: (input) => replayRun(input),
    now: () => now,
    randomHex: () => (++seq).toString(16).padStart(32, '0'),
    randomSeed: () => 12345,
    config: { ...DEFAULT_CONFIG, allowedOrigins: ['https://exemple.test'], ...config },
  });
  server = createServer((req, res) => void handle(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

async function ticket(mode: 'free' | 'daily' = 'free') {
  const r = await post('/tickets', { mode });
  expect(r.status).toBe(201);
  return (await r.json()) as { ticket: string; seed: number; day?: string };
}

beforeEach(async () => {
  now = Date.UTC(2026, 10, 17, 12, 0, 0);
  seq = 0;
  store = createMemoryStore();
  await start();
});
afterEach(() => new Promise<void>((r) => server.close(() => r())));

describe('serveur de classement', () => {
  it('santé', async () => {
    const r = await fetch(base + '/health');
    expect(await r.json()).toEqual({ ok: true, rulesVersions: [1], demo: false });
  });

  it('ticket → rejeu → classement global et hebdomadaire ; score recalculé, pas déclaré', async () => {
    const t = await ticket();
    const { inputTicks, score } = run(t.seed, 3);
    now += 60 * 60_000;
    const r = await post('/scores', { ticket: t.ticket, playerId: PLAYER, pseudo: 'Alex', inputTicks, score: 9999 });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { ranked: boolean; score: number; placements: Record<string, { rank: number }> };
    expect(body).toMatchObject({ ranked: true, score, height: score });
    expect(score).not.toBe(9999);
    expect(body.placements.global!.rank).toBe(1);
    expect(body.placements.weekly!.rank).toBe(1);

    const board = (await (await fetch(`${base}/leaderboards/global?player=${PLAYER}`)).json()) as Record<string, unknown>;
    expect(board).toMatchObject({ board: 'global:v1', total: 1, demo: false, you: { rank: 1, score } });
    expect(JSON.stringify(board)).not.toContain(PLAYER); // identifiant jamais exposé
    const weekly = (await (await fetch(`${base}/leaderboards/weekly`)).json()) as { period: string };
    expect(weekly.period).toBe('2026-W47');
  });

  it('idempotence : même soumission rejouée → même réponse, un seul enregistrement ; autre partie refusée', async () => {
    const t = await ticket();
    const inputTicks = play(t.seed, 2);
    now += 60 * 60_000;
    const payload = { ticket: t.ticket, playerId: PLAYER, pseudo: 'Alex', inputTicks };
    const [a, b] = await Promise.all([post('/scores', payload), post('/scores', payload)]);
    expect(await a.json()).toEqual(await b.json());
    const other = await post('/scores', { ...payload, inputTicks: play(t.seed, 8) });
    expect(other.status).toBe(409);
    expect(store.listBoard('global:v1')).toHaveLength(1);
  });

  it('meilleur score par joueur : un score plus faible ne remplace pas le record', async () => {
    const scores: number[] = [];
    for (const floors of [8, 1]) {
      const t = await ticket();
      const r = run(t.seed, floors);
      scores.push(r.score);
      now += 60 * 60_000;
      await post('/scores', { ticket: t.ticket, playerId: PLAYER, pseudo: 'Alex', inputTicks: r.inputTicks });
    }
    expect(scores[0]).toBeGreaterThan(scores[1]!);
    expect(store.listBoard('global:v1').map((e) => e.score)).toEqual([scores[0]]);
  });

  it('ex æquo : même rang partagé, le plus ancien affiché d’abord', async () => {
    for (const id of [PLAYER, OTHER]) {
      const t = await ticket();
      const inputTicks = play(t.seed, 2);
      now += 60 * 60_000;
      await post('/scores', { ticket: t.ticket, playerId: id, pseudo: id === PLAYER ? 'Alex' : 'Flk', inputTicks });
    }
    const board = (await (await fetch(`${base}/leaderboards/global`)).json()) as { entries: { pseudo: string; rank: number }[] };
    expect(board.entries.map((e) => [e.pseudo, e.rank])).toEqual([['Alex', 1], ['Flk', 1]]);
  });

  it('défi du jour : seed du jour imposée et tableau du jour séparé', async () => {
    const t = await ticket('daily');
    expect(t).toMatchObject({ day: '2026-11-17', seed: dailySeed('2026-11-17') });
    const inputTicks = play(t.seed, 2);
    now += 60 * 60_000;
    await post('/scores', { ticket: t.ticket, playerId: PLAYER, pseudo: 'Alex', inputTicks });
    expect(store.listBoard('daily:v1:2026-11-17')).toHaveLength(1);
    expect(store.listBoard('global:v1')).toHaveLength(0);
  });

  it('refuse : partie trafiquée, trop rapide, ticket inconnu ou expiré, pseudo invalide', async () => {
    const t = await ticket();
    const inputTicks = play(t.seed, 3);
    // Trop rapide : la partie rejouée dure plus que le temps écoulé depuis le ticket.
    expect((await post('/scores', { ticket: t.ticket, playerId: PLAYER, pseudo: 'Alex', inputTicks })).status).toBe(422);
    now += 60 * 60_000;
    const bad = await post('/scores', { ticket: t.ticket, playerId: PLAYER, pseudo: 'Alex', inputTicks: [3, 2, 1] });
    expect(((await bad.json()) as { error: string }).error).toBe('replay_bad_input_ticks');
    expect((await post('/scores', { ticket: 'f'.repeat(32), playerId: PLAYER, pseudo: 'Alex', inputTicks })).status).toBe(404);
    expect((await post('/scores', { ticket: t.ticket, playerId: PLAYER, pseudo: '<b>', inputTicks })).status).toBe(400);
    expect((await post('/scores', { ticket: t.ticket, playerId: 'x', pseudo: 'Alex', inputTicks })).status).toBe(400);
    now += 2 * 60 * 60 * 1000;
    expect((await post('/scores', { ticket: t.ticket, playerId: PLAYER, pseudo: 'Alex', inputTicks })).status).toBe(404);
  });

  it('limites : corps trop gros, JSON invalide, version de règles inconnue, quotas', async () => {
    const big = await post('/scores', { pad: 'x'.repeat(70_000) });
    expect(big.status).toBe(413);
    const bad = await fetch(base + '/tickets', { method: 'POST', body: '{' });
    expect(bad.status).toBe(400);
    expect((await post('/tickets', { rulesVersion: 99 })).status).toBe(400);
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) statuses.push((await post('/tickets', {})).status);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
  });

  it('pagination bornée et CORS limité aux origines configurées', async () => {
    for (let i = 0; i < 5; i++) {
      store.putBest('global:v1', { playerId: i.toString(16).padStart(32, '0'), pseudo: `Joueur ${i}`, score: 10 - i, height: 10 - i, perfectCount: 0, achievedAt: i });
    }
    const p1 = (await (await fetch(`${base}/leaderboards/global?limit=2`)).json()) as { entries: unknown[]; nextOffset: number };
    expect(p1.entries).toHaveLength(2);
    expect(p1.nextOffset).toBe(2);
    const last = (await (await fetch(`${base}/leaderboards/global?offset=4&limit=999`)).json()) as { entries: unknown[]; nextOffset: null };
    expect(last).toMatchObject({ nextOffset: null });
    expect(last.entries).toHaveLength(1);

    const ok = await fetch(`${base}/health`, { headers: { Origin: 'https://exemple.test' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://exemple.test');
    const ko = await fetch(`${base}/health`, { headers: { Origin: 'https://pirate.test' } });
    expect(ko.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('démo : entrées marquées démo, tableau signalé comme démo', async () => {
    seedDemo(store, 1, now);
    const board = (await (await fetch(`${base}/leaderboards/global`)).json()) as { demo: boolean; entries: { pseudo: string; demo?: boolean; rank: number }[] };
    expect(board.demo).toBe(true);
    expect(board.entries.every((e) => e.demo && e.pseudo.startsWith('Démo '))).toBe(true);
    expect(board.entries.filter((e) => e.rank === board.entries[3]!.rank).length).toBe(2);
  });

  it('partie reprise (continues > 0) : jamais classée', async () => {
    server.close();
    await start({ rulesVersions: [1] });
    const handle = createApp({
      store,
      replay: () => ({ ok: true, result: { score: 50, perfectCount: 0, durationTicks: 10, height: 50, continues: 1 } }),
      now: () => now,
      randomHex: () => (++seq).toString(16).padStart(32, '0'),
      randomSeed: () => 7,
      config: DEFAULT_CONFIG,
    });
    server.close();
    server = createServer((req, res) => void handle(req, res));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    const t = await ticket();
    now += 60 * 60_000;
    const r = (await (await post('/scores', { ticket: t.ticket, playerId: PLAYER, pseudo: 'Alex', inputTicks: [1] })).json()) as { ranked: boolean };
    expect(r).toMatchObject({ ranked: false, reason: 'continued' });
    expect(store.listBoard('global:v1')).toHaveLength(0);
  });
});

describe('persistance fichier', () => {
  it('relit les tableaux après redémarrage', async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const file = join(mkdtempSync(join(tmpdir(), 'poc-')), 'data.json');
    const a = createMemoryStore(file);
    a.putBest('global:v1', { playerId: PLAYER, pseudo: 'Alex', score: 4, height: 4, perfectCount: 1, achievedAt: 1 });
    expect(createMemoryStore(file).listBoard('global:v1')).toHaveLength(1);
  });
});
