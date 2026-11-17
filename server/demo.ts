/**
 * Données de démonstration (DEMO=1 seulement). Chaque entrée porte `demo: true` et un pseudo
 * « Démo … » : l'API renvoie `demo: true` pour le tableau et le client affiche « Mode démo ».
 * Jamais utilisé hors démo : aucun faux joueur présenté comme réel.
 */
import { boardKey, isoWeek, type ScoreEntry } from './leaderboard';
import { utcDateKey } from '../src/platform/daily';
import type { Store } from './store';

const NAMES = ['Démo Lune', 'Démo Cactus', 'Démo Pixel', 'Démo Comète', 'Démo Tuba', 'Démo Kiwi'];

export function seedDemo(store: Store, rulesVersion: number, now: number): void {
  const at = new Date(now);
  const boards = [
    boardKey('global', rulesVersion),
    boardKey('weekly', rulesVersion, isoWeek(at)),
    boardKey('daily', rulesVersion, utcDateKey(at)),
  ];
  NAMES.forEach((pseudo, i) => {
    const score = 42 - i * 6 - (i === 3 ? 6 : 0); // deux ex æquo (rangs partagés visibles)
    const entry: ScoreEntry = {
      playerId: `de${'0'.repeat(29)}${i}`,
      pseudo,
      score,
      height: score,
      perfectCount: Math.floor(score / 4),
      achievedAt: now - (i + 1) * 60_000,
      demo: true,
    };
    for (const b of boards) if (!store.getBest(b, entry.playerId)) store.putBest(b, entry);
  });
}
