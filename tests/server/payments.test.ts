import { describe, expect, it } from 'vitest';
import { createLedger, demoVerifier } from '../../server/payments';

const R = (receiptId: string, productId: string, demo = false, accountId = 'acc1') => ({ receiptId, productId, accountId, demo });

describe('registre des achats (serveur)', () => {
  it('reçu crédité une seule fois, même rejoué ; reçu d’un autre compte refusé', () => {
    const l = createLedger();
    l.credit(R('r1', 'lives-3'));
    l.credit(R('r1', 'lives-3'));
    expect(l.wallet('acc1').lives).toBe(3);
    expect(l.credit(R('r1', 'lives-3', false, 'acc2'))).toEqual({ ok: false, reason: 'other_account' });
    expect(l.credit(R('r2', 'pieces-1000'))).toEqual({ ok: false, reason: 'unknown_product' });
  });

  it('vie consommée une fois par reprise, jamais sous zéro', () => {
    const l = createLedger();
    l.credit(R('r1', 'lives-3'));
    expect(l.consumeLife('acc1', 'run1:revive').ok).toBe(true);
    expect(l.consumeLife('acc1', 'run1:revive').ok).toBe(true); // rappel répété
    expect(l.wallet('acc1').lives).toBe(2);
    l.consumeLife('acc1', 'run2:revive');
    l.consumeLife('acc1', 'run3:revive');
    expect(l.consumeLife('acc1', 'run4:revive')).toMatchObject({ ok: false });
    expect(l.wallet('acc1').lives).toBe(0);
  });

  it('remboursement : retire le droit et seulement les vies non utilisées', () => {
    const l = createLedger();
    l.credit(R('r1', 'lives-3'));
    l.credit(R('p1', 'pass-premium-s1'));
    l.consumeLife('acc1', 'a');
    expect(l.refund('r1')).toEqual({ ok: true });
    expect(l.refund('r1')).toEqual({ ok: false });
    expect(l.refund('p1')).toEqual({ ok: true });
    expect(l.wallet('acc1')).toMatchObject({ lives: 0, entitlements: [] });
  });

  it('démo : droits séparés, jamais comptés comme vérifiés', async () => {
    const l = createLedger();
    const v = await demoVerifier('demo:pass-premium-s1:1:1', 'acc1');
    expect(v).toMatchObject({ demo: true });
    l.credit(v!);
    l.credit((await demoVerifier('demo:lives-3:1:2', 'acc1'))!);
    expect(l.wallet('acc1')).toEqual({ lives: 0, entitlements: [], demo: { lives: 3, entitlements: ['pass-premium-s1'] } });
    expect(l.consumeLife('acc1', 'x')).toMatchObject({ ok: true, demo: true });
    expect(l.consumeLife('acc1', 'x')).toMatchObject({ ok: true, demo: true }); // rejeu : reste démo
    expect(l.wallet('acc1').demo.lives).toBe(2);
    expect(await demoVerifier('vrai-recu', 'acc1')).toBeNull();
  });
});

describe('vie rendue (reprise refusée par le moteur)', () => {
  it('une seule fois, même réserve, jamais pour une autre demande ou un autre compte', () => {
    const l = createLedger();
    l.credit({ receiptId: 'r1', productId: 'lives-3', accountId: 'acc1', demo: false });
    l.consumeLife('acc1', 'run1:revive');
    expect(l.returnLife('acc2', 'run1:revive').ok).toBe(false);
    expect(l.returnLife('acc1', 'run1:revive').ok).toBe(true);
    expect(l.returnLife('acc1', 'run1:revive').ok).toBe(false);
    expect(l.returnLife('acc1', 'inconnu').ok).toBe(false);
    expect(l.wallet('acc1').lives).toBe(3);
  });
});
