import './styles.css';
import { RULES_VERSION } from './app/game-contract';
import { loadGame } from './app/game-loader';
import { createShell } from './app/shell';
import { combineSinks, consoleSink, createTracker, memorySink } from './platform/metrics';
import { randomId, randomSeed } from './platform/random';
import { createLeaderboardService } from './platform/services/leaderboard';
import { shareLink } from './platform/share';
import { createLocalStore, createMetaStore, getBrowserStorage } from './platform/storage';

const root = document.getElementById('app');
if (!root) throw new Error('Élément #app introuvable');

const events = memorySink();
const tracker = createTracker({
  buildId: __BUILD_ID__,
  rulesVersion: RULES_VERSION,
  sessionId: randomId(),
  // Local uniquement. Aucun envoi distant sans configuration et consentement.
  sink: import.meta.env.DEV ? combineSinks(events, consoleSink) : events,
});
tracker.track('session_start', {});

const browserStorage = getBrowserStorage();

createShell({
  root,
  startGame: loadGame(),
  tracker,
  store: createLocalStore(browserStorage),
  meta: createMetaStore(browserStorage),
  url: window.location.href,
  replaceUrl: (url) => window.history.replaceState(null, '', url),
  share: (data) => shareLink(data),
  newSeed: () => randomSeed(),
  newRunId: () => randomId(),
  newPlayerId: () => randomId() + randomId(),
  // Adresse du serveur de classement au build (server/README.md). Vide (GitHub Pages actuel) :
  // l'écran Classement affiche « Indisponible » et le jeu reste entier.
  leaderboard: createLeaderboardService(import.meta.env.VITE_LEADERBOARD_URL as string | undefined),
});

// Point d'inspection réservé au dev et au build e2e (VITE_EXPOSE_METRICS=1), absent en production.
if (import.meta.env.DEV || import.meta.env.VITE_EXPOSE_METRICS === '1') {
  Object.defineProperty(window, '__metrics', { value: events.events });
}
