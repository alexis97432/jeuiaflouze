import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDemoAds, createRewardGate, demoAdsAllowed, noAds, type AdOutcome, type RewardedAdProvider } from '../../src/platform/ads/rewarded';
import { createDemoPayments, noPayments, PRODUCTS } from '../../src/platform/payments/payments';

afterEach(() => vi.useRealTimers());

const manual = () => {
  const calls: ((o: AdOutcome) => void)[] = [];
  const provider: RewardedAdProvider = { kind: 'real', label: '', show: () => new Promise((r) => calls.push(r)) };
  return { provider, calls };
};

describe('vidéo récompensée', () => {
  it('sans régie : indisponible, aucune récompense', async () => {
    const onReward = vi.fn();
    expect(await createRewardGate(noAds).reward('run1', 'revive', onReward)).toBe('unavailable');
    expect(onReward).not.toHaveBeenCalled();
  });

  it('double appui pendant la vidéo : une seule vidéo, une seule récompense', async () => {
    const { provider, calls } = manual();
    const gate = createRewardGate(provider);
    const onReward = vi.fn();
    const a = gate.reward('run1', 'revive', onReward);
    const b = gate.reward('run1', 'revive', onReward);
    expect(calls).toHaveLength(1);
    calls[0]!('rewarded');
    expect(await a).toBe('rewarded');
    expect(await b).toBe('rewarded');
    expect(onReward).toHaveBeenCalledTimes(1);
    // Rappel tardif ou nouvel appui après la récompense : rien de plus.
    expect(await gate.reward('run1', 'revive', onReward)).toBe('already-rewarded');
    expect(calls).toHaveLength(1);
    expect(onReward).toHaveBeenCalledTimes(1);
  });

  it.each(['dismissed', 'no-fill', 'error'] as const)('« %s » : pas de récompense, nouvelle tentative possible', async (outcome) => {
    const { provider, calls } = manual();
    const gate = createRewardGate(provider);
    const onReward = vi.fn();
    const first = gate.reward('run1', 'revive', onReward);
    calls[0]!(outcome);
    expect(await first).toBe(outcome);
    expect(onReward).not.toHaveBeenCalled();
    const second = gate.reward('run1', 'revive', onReward);
    calls[1]!('rewarded');
    expect(await second).toBe('rewarded');
    expect(onReward).toHaveBeenCalledTimes(1);
  });

  it('régie muette (retour d’arrière-plan sans réponse) : erreur après le délai, pas de récompense', async () => {
    vi.useFakeTimers();
    const { provider } = manual();
    const onReward = vi.fn();
    const p = createRewardGate(provider, 1000).reward('run1', 'revive', onReward);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toBe('error');
    expect(onReward).not.toHaveBeenCalled();
  });

  it('régie qui lève une exception : erreur', async () => {
    const provider: RewardedAdProvider = { kind: 'real', label: '', show: () => Promise.reject(new Error('sdk')) };
    expect(await createRewardGate(provider).reward('r', 'revive', vi.fn())).toBe('error');
  });

  it('démo : libellée, seulement en dev ou build de test marqué', async () => {
    vi.useFakeTimers();
    const demo = createDemoAds({ delayMs: 10 });
    expect(demo.kind).toBe('demo');
    expect(demo.label).toContain('Mode démo');
    const p = demo.show('revive');
    await vi.advanceTimersByTimeAsync(10);
    expect(await p).toBe('rewarded');
    expect(demoAdsAllowed({ DEV: false })).toBe(false);
    expect(demoAdsAllowed({ DEV: false, VITE_DEMO_SERVICES: '1' })).toBe(true);
    expect(demoAdsAllowed({ DEV: true })).toBe(true);
  });
});

describe('paiements (client)', () => {
  it('sans fournisseur : indisponible, aucun prix inventé', async () => {
    expect(await noPayments.price('lives-3')).toBeNull();
    expect(await noPayments.purchase('lives-3')).toEqual({ status: 'unavailable' });
  });

  it('démo : reçu marqué démo, annulation et échec sans reçu', async () => {
    const results = ['ok', 'cancel', 'fail'] as const;
    let i = 0;
    const demo = createDemoPayments(() => results[i++]!);
    const ok = await demo.purchase('lives-3');
    expect(ok).toMatchObject({ status: 'receipt', demo: true });
    expect(await demo.purchase('lives-3')).toEqual({ status: 'cancelled' });
    expect(await demo.purchase('lives-3')).toEqual({ status: 'failed', reason: 'demo' });
  });

  it('catalogue : vies consommables pour la reprise, passe premium en droit ; pas de pièces', () => {
    expect(PRODUCTS.map((p) => p.id)).toEqual(['lives-3', 'lives-10', 'pass-premium-s1']);
    expect(PRODUCTS.some((p) => /pi[eè]ce|coin/i.test(p.id + p.name))).toBe(false);
  });
});
