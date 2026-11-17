// Police Fredoka (SIL OFL 1.1, voir docs/LICENCES-TIERS.md), servie avec le jeu : aucun appel externe.
import '@fontsource-variable/fredoka';
import './styles.css';
import { RULES_VERSION } from './app/game-contract';
import { loadGame } from './app/game-loader';
import { createShell } from './app/shell';
import { combineSinks, consoleSink, createTracker, memorySink } from './platform/metrics';
import { randomId, randomSeed } from './platform/random';
import { createLeaderboardService } from './platform/services/leaderboard';
import { createResultImage } from './app/result-image';
import { renderResultCard } from './game';
import { createDemoAds, noAds } from './platform/ads/rewarded';
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
  // Bouton retour du téléphone : ramène à l'accueil, met la partie en pause (V4).
  history: window.history,
  share: (data) => shareLink(data),
  newSeed: () => randomSeed(),
  newRunId: () => randomId(),
  newPlayerId: () => randomId() + randomId(),
  // Carte de résultat F9 : image jointe au partage et « Enregistrer l'image ».
  resultImage: createResultImage(renderResultCard),
  // Adresse du serveur de classement au build (server/README.md). Vide (GitHub Pages actuel) :
  // l'écran Classement affiche « Indisponible » et le jeu reste entier.
  leaderboard: createLeaderboardService(import.meta.env.VITE_LEADERBOARD_URL as string | undefined),
  // Reprise : aucune régie réelle configurée (docs/SERVICES.md). Vidéo de démo libellée « Mode démo »
  // seulement en dev ou build de test marqué ; en production, aucune offre de vidéo.
  // Vies : celles achetées en pièces dans la boutique (progression locale, src/app/lives.ts).
  revive: {
    // Condition écrite en constantes de build (même règle que demoAdsAllowed) : Vite retire
    // entièrement la démo du build de production.
    ads: import.meta.env.DEV || import.meta.env.VITE_DEMO_SERVICES === '1' ? createDemoAds() : noAds,
  },
});

// Point d'inspection réservé au dev et au build e2e (VITE_EXPOSE_METRICS=1), absent en production.
if (import.meta.env.DEV || import.meta.env.VITE_EXPOSE_METRICS === '1') {
  Object.defineProperty(window, '__metrics', { value: events.events });
}
