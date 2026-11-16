import './styles.css';
import { RULES_VERSION } from './app/game-contract';
import { IS_MOCK_GAME, loadMountGame } from './app/game-loader';
import { createShell } from './app/shell';
import { combineSinks, consoleSink, createTracker, memorySink } from './platform/metrics';
import { randomId, randomSeed } from './platform/random';

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

createShell({
  root,
  mountGame: loadMountGame(),
  tracker,
  newSeed: () => randomSeed(),
  newRunId: () => randomId(),
  isMockGame: IS_MOCK_GAME,
});

// Exposé pour inspection manuelle et tests e2e ; lecture seule, local.
Object.defineProperty(window, '__metrics', { value: events.events });
