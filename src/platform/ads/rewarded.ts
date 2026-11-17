/**
 * Vidéo récompensée (V3-A4). Trois fournisseurs possibles :
 * - `none` (production sans régie configurée) : aucune pub, l'option n'est pas proposée ;
 * - `demo` (dev/test seulement, libellé « Mode démo ») : aucune vraie vidéo, aucun revenu ;
 * - `real` : adaptateur d'une régie (à brancher : bloqueur externe, voir docs/SERVICES.md).
 * Le jeu ne présente jamais une fausse publicité comme réelle.
 */

export type AdOutcome =
  /** Vidéo vue jusqu'au bout : la récompense peut être donnée (une seule fois). */
  | 'rewarded'
  /** Le joueur a fermé ou refusé. */
  | 'dismissed'
  /** Aucune vidéo disponible maintenant. */
  | 'no-fill'
  /** Erreur de la régie, délai dépassé, application mise en arrière-plan trop longtemps. */
  | 'error'
  /** Aucune régie configurée. */
  | 'unavailable';

export type RewardedAdProvider = {
  readonly kind: 'none' | 'demo' | 'real';
  /** Texte montré au joueur à côté du bouton (vide pour une vraie régie). */
  readonly label: string;
  show(placement: string): Promise<AdOutcome>;
};

export const noAds: RewardedAdProvider = {
  kind: 'none',
  label: 'Indisponible',
  show: () => Promise.resolve('unavailable'),
};

/**
 * Régie de démonstration : attend `delayMs` puis renvoie le résultat choisi (tests, essais).
 * Ne doit être créée que si le build l'autorise explicitement (`demoAdsAllowed`).
 */
export function createDemoAds(options: { delayMs?: number; outcome?: (placement: string) => AdOutcome } = {}): RewardedAdProvider {
  const delay = options.delayMs ?? 1500;
  return {
    kind: 'demo',
    label: 'Mode démo : pas de vraie vidéo',
    show: (placement) =>
      new Promise((resolve) => setTimeout(() => resolve(options.outcome?.(placement) ?? 'rewarded'), delay)),
  };
}

/** La démo n'existe qu'en dev ou avec `VITE_DEMO_SERVICES=1` (build de test explicitement marqué). */
export function demoAdsAllowed(env: { DEV?: boolean; VITE_DEMO_SERVICES?: string }): boolean {
  return env.DEV === true || env.VITE_DEMO_SERVICES === '1';
}

/**
 * Garde de récompense : une demande (`requestId`, ex. l'id de la partie + « reprise ») ne peut
 * afficher qu'une vidéo à la fois et ne donne la récompense qu'une fois, même si la régie
 * rappelle deux fois, si le joueur tape deux fois ou si la vidéo se termine après un retour
 * d'arrière-plan. `timeoutMs` borne l'attente (régie muette → 'error').
 */
export function createRewardGate(provider: RewardedAdProvider, timeoutMs = 60_000) {
  const pending = new Map<string, Promise<AdOutcome>>();
  const granted = new Set<string>();

  const request = (requestId: string, placement: string): Promise<AdOutcome | 'already-rewarded'> => {
    // Déjà récompensé : aucune vidéo de plus, issue distincte (revue FLK A4, m2).
    if (granted.has(requestId)) return Promise.resolve('already-rewarded');
    const inFlight = pending.get(requestId);
    if (inFlight) return inFlight;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = Promise.race<AdOutcome>([
      provider.show(placement).catch(() => 'error' as const),
      new Promise<AdOutcome>((resolve) => {
        timer = setTimeout(() => resolve('error'), timeoutMs);
      }),
    ]).finally(() => {
      clearTimeout(timer);
      pending.delete(requestId);
    });
    pending.set(requestId, run);
    return run;
  };

  return {
    /**
     * Affiche la vidéo et appelle `onReward` au plus une fois par `requestId`.
     * Renvoie le résultat pour que l'écran l'explique (« Pas de vidéo pour l'instant », etc.).
     */
    async reward(requestId: string, placement: string, onReward: () => void): Promise<AdOutcome | 'already-rewarded'> {
      const outcome = await request(requestId, placement);
      if (outcome === 'rewarded' && !granted.has(requestId)) {
        granted.add(requestId);
        onReward();
      }
      return outcome;
    },
    wasRewarded: (requestId: string) => granted.has(requestId),
  };
}

export const AD_MESSAGES: Record<Exclude<AdOutcome, 'rewarded'>, string> = {
  dismissed: 'Vidéo fermée : pas de reprise cette fois.',
  'no-fill': 'Pas de vidéo pour l’instant.',
  // Délai dépassé compris : une confirmation tardive de la régie ne rend pas la reprise (FLK A4, m3).
  error: 'La vidéo n’a pas marché ou a mis trop de temps. Pas de reprise cette fois.',
  unavailable: 'Vidéo indisponible.',
};
