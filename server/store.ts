/**
 * Stockage du serveur. Interface + implémentation en mémoire, avec persistance optionnelle dans
 * un fichier JSON (écriture atomique : fichier temporaire puis renommage). Pour la production,
 * une base gérée est à choisir (dépendance externe documentée dans server/README.md) : il suffit
 * d'implémenter `Store`.
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { ScoreEntry } from './leaderboard';

export type Ticket = {
  id: string;
  seed: number;
  rulesVersion: number;
  mode: 'free' | 'daily';
  day?: string;
  issuedAt: number;
  expiresAt: number;
  /** Une fois consommé : empreinte de la soumission et réponse, pour l'idempotence. */
  consumed?: { payloadHash: string; response: unknown };
};

export type Store = {
  getTicket(id: string): Ticket | undefined;
  putTicket(ticket: Ticket): void;
  getBest(board: string, playerId: string): ScoreEntry | undefined;
  putBest(board: string, entry: ScoreEntry): void;
  listBoard(board: string): ScoreEntry[];
  /** Supprime les tickets expirés (borne la mémoire). */
  purgeTickets(now: number): number;
};

type Snapshot = { tickets: Record<string, Ticket>; boards: Record<string, Record<string, ScoreEntry>> };

export function createMemoryStore(file?: string): Store {
  let data: Snapshot = { tickets: {}, boards: {} };
  if (file) {
    try {
      data = JSON.parse(readFileSync(file, 'utf8')) as Snapshot;
    } catch {
      // Fichier absent ou illisible : on repart vide (jamais d'exception au démarrage).
    }
  }
  const persist = () => {
    if (!file) return;
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, file);
  };
  return {
    getTicket: (id) => data.tickets[id],
    putTicket(ticket) {
      data.tickets[ticket.id] = ticket;
      persist();
    },
    getBest: (board, playerId) => data.boards[board]?.[playerId],
    putBest(board, entry) {
      (data.boards[board] ??= {})[entry.playerId] = entry;
      persist();
    },
    listBoard: (board) => Object.values(data.boards[board] ?? {}),
    purgeTickets(now) {
      let n = 0;
      for (const [id, t] of Object.entries(data.tickets)) {
        if (t.expiresAt < now) {
          delete data.tickets[id];
          n++;
        }
      }
      if (n > 0) persist();
      return n;
    },
  };
}
