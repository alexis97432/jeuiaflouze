/**
 * Achats en argent réel (V3-A4) — interfaces seulement tant qu'aucun fournisseur n'est relié.
 *
 * Règles :
 * - le client ne donne **jamais** un droit parce que le fournisseur a dit « payé » : seul le
 *   serveur (server/payments.ts) vérifie le reçu et renvoie les droits et les vies ;
 * - sans fournisseur : `unavailable`, le bouton affiche « Indisponible » ;
 * - démo (dev/test, `demoAdsAllowed`) : aucun débit, droits marqués `demo` et rangés à part,
 *   jamais confondus avec un achat vérifié.
 * Les parties normales restent gratuites et illimitées ; les pièces ne s'achètent pas.
 */

export type ProductId = 'lives-3' | 'lives-10' | 'pass-premium-s1';

export type Product = {
  id: ProductId;
  kind: 'consumable' | 'entitlement';
  name: string;
  /** Vies ajoutées (consommables) ; servent uniquement à la reprise. */
  lives?: number;
};

export const PRODUCTS: readonly Product[] = [
  { id: 'lives-3', kind: 'consumable', name: '3 vies', lives: 3 },
  { id: 'lives-10', kind: 'consumable', name: '10 vies', lives: 10 },
  { id: 'pass-premium-s1', kind: 'entitlement', name: 'Passe premium saison 1' },
];

export type PurchaseOutcome =
  | { status: 'unavailable' }
  | { status: 'cancelled' }
  /** Paiement en attente (ex. validation parentale) : rien n'est donné maintenant. */
  | { status: 'pending' }
  | { status: 'failed'; reason: string }
  /** Reçu brut du fournisseur, à faire vérifier par le serveur. */
  | { status: 'receipt'; receipt: string; demo: boolean };

export type PaymentProvider = {
  readonly kind: 'none' | 'demo' | 'real';
  readonly label: string;
  /** Prix localisé fourni par le fournisseur ; null si inconnu (jamais de prix inventé). */
  price(id: ProductId): Promise<string | null>;
  purchase(id: ProductId): Promise<PurchaseOutcome>;
};

export const noPayments: PaymentProvider = {
  kind: 'none',
  label: 'Indisponible',
  price: () => Promise.resolve(null),
  purchase: () => Promise.resolve({ status: 'unavailable' }),
};

/** Fournisseur de démonstration : aucun débit, reçu « demo:… » que le serveur traite comme démo. */
export function createDemoPayments(next: (id: ProductId) => 'ok' | 'cancel' | 'fail' = () => 'ok'): PaymentProvider {
  let n = 0;
  return {
    kind: 'demo',
    label: 'Mode démo : aucun paiement réel',
    price: () => Promise.resolve('démo'),
    purchase(id) {
      const r = next(id);
      if (r === 'cancel') return Promise.resolve({ status: 'cancelled' });
      if (r === 'fail') return Promise.resolve({ status: 'failed', reason: 'demo' });
      return Promise.resolve({ status: 'receipt', receipt: `demo:${id}:${Date.now()}:${++n}`, demo: true });
    },
  };
}

export const PURCHASE_MESSAGES: Record<Exclude<PurchaseOutcome['status'], 'receipt'>, string> = {
  unavailable: 'Indisponible pour l’instant.',
  cancelled: 'Achat annulé. Rien n’a été payé.',
  pending: 'Paiement en attente. Rien n’est ajouté tant qu’il n’est pas validé.',
  failed: 'L’achat n’a pas marché. Rien n’a été payé.',
};
