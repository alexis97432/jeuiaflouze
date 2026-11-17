/**
 * Registre des achats côté serveur (V3-A4) : reçus, droits, vies (consommables), remboursements.
 * Pur et testable ; l'exposition HTTP attend un fournisseur de paiement **et** des comptes
 * (sans compte, rien ne relie un droit à une personne : bloqueur externe, docs/SERVICES.md).
 *
 * - un reçu n'est crédité qu'une fois (idempotence par id de reçu) ;
 * - une vie n'est consommée qu'une fois par `requestId` (double rappel, double appui) ;
 * - un remboursement retire le droit ou les vies non utilisées (jamais de solde négatif) ;
 * - un reçu de démo ne donne que des droits `demo`, séparés des droits vérifiés.
 */

export type VerifiedReceipt = {
  receiptId: string;
  productId: string;
  accountId: string;
  demo: boolean;
};

/** Vérification auprès du fournisseur (signature, statut). Absent : achats indisponibles. */
export type ReceiptVerifier = (raw: string, accountId: string) => Promise<VerifiedReceipt | null>;

export type Catalog = Record<string, { kind: 'consumable'; lives: number } | { kind: 'entitlement' }>;

export const SERVER_CATALOG: Catalog = {
  'lives-3': { kind: 'consumable', lives: 3 },
  'lives-10': { kind: 'consumable', lives: 10 },
  'pass-premium-s1': { kind: 'entitlement' },
};

export type Wallet = { lives: number; entitlements: string[]; demo: { lives: number; entitlements: string[] } };

type Account = {
  lives: number;
  entitlements: Set<string>;
  demoLives: number;
  demoEntitlements: Set<string>;
};

export function createLedger(catalog: Catalog = SERVER_CATALOG) {
  const accounts = new Map<string, Account>();
  const receipts = new Map<string, { accountId: string; productId: string; demo: boolean; refunded: boolean; livesLeft: number }>();
  const consumed = new Map<string, { accountId: string; ok: boolean; demo: boolean }>();

  const account = (id: string): Account => {
    let a = accounts.get(id);
    if (!a) {
      a = { lives: 0, entitlements: new Set(), demoLives: 0, demoEntitlements: new Set() };
      accounts.set(id, a);
    }
    return a;
  };

  const wallet = (id: string): Wallet => {
    const a = account(id);
    return {
      lives: a.lives,
      entitlements: [...a.entitlements].sort(),
      demo: { lives: a.demoLives, entitlements: [...a.demoEntitlements].sort() },
    };
  };

  return {
    wallet,
    /** Crédite un reçu vérifié. Rejoué : aucun effet de plus. */
    credit(r: VerifiedReceipt): { ok: true; wallet: Wallet } | { ok: false; reason: 'unknown_product' | 'other_account' } {
      const product = catalog[r.productId];
      if (!product) return { ok: false, reason: 'unknown_product' };
      const known = receipts.get(r.receiptId);
      if (known) return known.accountId === r.accountId ? { ok: true, wallet: wallet(r.accountId) } : { ok: false, reason: 'other_account' };
      const a = account(r.accountId);
      const lives = product.kind === 'consumable' ? product.lives : 0;
      if (product.kind === 'consumable') {
        if (r.demo) a.demoLives += lives;
        else a.lives += lives;
      } else if (r.demo) a.demoEntitlements.add(r.productId);
      else a.entitlements.add(r.productId);
      receipts.set(r.receiptId, { accountId: r.accountId, productId: r.productId, demo: r.demo, refunded: false, livesLeft: lives });
      return { ok: true, wallet: wallet(r.accountId) };
    },
    /**
     * Consomme une vie pour une reprise. `requestId` unique par reprise : un second appel
     * renvoie le même résultat sans retirer une autre vie. Les vies vérifiées passent avant
     * les vies de démo ; `demo` dit laquelle a servi (une reprise démo reste marquée démo).
     */
    consumeLife(accountId: string, requestId: string): { ok: boolean; demo: boolean; wallet: Wallet } {
      const seen = consumed.get(requestId);
      // Rejeu : même réponse, y compris l'origine démo de la vie (revue FLK A4, m1).
      if (seen) {
        const same = seen.accountId === accountId;
        return { ok: seen.ok && same, demo: same && seen.demo, wallet: wallet(accountId) };
      }
      const a = account(accountId);
      let ok = false;
      let demo = false;
      if (a.lives > 0) {
        a.lives--;
        ok = true;
      } else if (a.demoLives > 0) {
        a.demoLives--;
        ok = true;
        demo = true;
      }
      if (ok) {
        // Les vies consommées ne sont plus remboursables : on les retire du reçu le plus ancien.
        for (const r of receipts.values()) {
          if (r.accountId === accountId && r.demo === demo && !r.refunded && r.livesLeft > 0) {
            r.livesLeft--;
            break;
          }
        }
      }
      consumed.set(requestId, { accountId, ok, demo });
      return { ok, demo, wallet: wallet(accountId) };
    },
    /** Remboursement notifié par le fournisseur : retire le droit ou les vies restantes du reçu. */
    refund(receiptId: string): { ok: boolean } {
      const r = receipts.get(receiptId);
      if (!r || r.refunded) return { ok: false };
      r.refunded = true;
      const a = account(r.accountId);
      const product = catalog[r.productId]!;
      if (product.kind === 'consumable') {
        if (r.demo) a.demoLives = Math.max(0, a.demoLives - r.livesLeft);
        else a.lives = Math.max(0, a.lives - r.livesLeft);
        r.livesLeft = 0;
      } else if (r.demo) a.demoEntitlements.delete(r.productId);
      else a.entitlements.delete(r.productId);
      return { ok: true };
    },
  };
}

/** Vérificateur de démonstration : accepte seulement les reçus `demo:<produit>:…`, marqués démo. */
export const demoVerifier: ReceiptVerifier = (raw, accountId) => {
  const m = /^demo:([a-z0-9-]{1,32}):\d+:\d+$/.exec(raw);
  return Promise.resolve(m ? { receiptId: raw, productId: m[1]!, accountId, demo: true } : null);
};
