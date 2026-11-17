/** Point d'entrée : `npm run server:dev` (source) ou `npm run server:start` (après server:build). */
import { createServer } from 'node:http';
import { randomBytes, randomInt } from 'node:crypto';
import { replayRun } from '../src/game/core';
import { createApp } from './app';
import { readConfig } from './config';
import { seedDemo } from './demo';
import { createMemoryStore } from './store';

const config = readConfig(process.env);
const store = createMemoryStore(config.dataFile);
if (config.demo) for (const v of config.rulesVersions) seedDemo(store, v, Date.now());

const handle = createApp({
  store,
  config,
  replay: (input) => replayRun(input),
  now: Date.now,
  randomHex: (n) => randomBytes(n).toString('hex'),
  randomSeed: () => randomInt(1, 2 ** 32 - 1),
});

setInterval(() => store.purgeTickets(Date.now()), 10 * 60_000).unref();

createServer((req, res) => void handle(req, res)).listen(config.port, config.host, () => {
  console.log(
    `[serveur] classement sur http://${config.host}:${config.port}/api/v1 — ` +
      `règles ${config.rulesVersions.join(',')}${config.demo ? ' — MODE DÉMO' : ''}` +
      `${config.dataFile ? ` — données ${config.dataFile}` : ' — données en mémoire'}`,
  );
});
