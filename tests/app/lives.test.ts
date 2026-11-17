import { describe, expect, it } from 'vitest';
import { INITIAL_DOC, migrateProgress, type ProgressDoc } from '../../src/app/economy';
import { buyLife, LIFE_PRICE, MAX_LIVES, returnLife, useLife } from '../../src/app/lives';

const doc = (over: Partial<ProgressDoc> = {}): ProgressDoc => ({ ...INITIAL_DOC, ...over });

describe('vies de reprise gagnées en jeu', () => {
  it('achat en pièces : prix débité, stock borné, solde insuffisant refusé sans débit', () => {
    const r = buyLife(doc({ coins: 40 }));
    expect(r).toMatchObject({ ok: true, doc: { coins: 40 - LIFE_PRICE, lives: 1 } });
    expect(buyLife(doc({ coins: 10 }))).toMatchObject({ ok: false, reason: 'insufficient', missing: LIFE_PRICE - 10, doc: { coins: 10 } });
    expect(buyLife(doc({ coins: 999, lives: MAX_LIVES }))).toMatchObject({ ok: false, reason: 'full', doc: { coins: 999 } });
  });

  it('une reprise retire une seule vie, même rappelée ; sans vie : refus', () => {
    const a = useLife(doc({ lives: 2 }), 'run1:revive');
    expect(a).toMatchObject({ ok: true, already: false, doc: { lives: 1 } });
    const again = useLife(a.doc, 'run1:revive');
    expect(again).toMatchObject({ ok: true, already: true, doc: { lives: 1 } });
    expect(useLife(doc({ lives: 0 }), 'run2:revive')).toMatchObject({ ok: false });
  });

  it('vie rendue une seule fois, seulement pour une reprise payée', () => {
    const used = useLife(doc({ lives: 1 }), 'r').doc;
    const back = returnLife(used, 'r');
    expect(back.lives).toBe(1);
    expect(returnLife(back, 'r').lives).toBe(1);
    expect(returnLife(doc({ lives: 1 }), 'autre').lives).toBe(1);
  });

  it('sauvegarde : vies relues et bornées, valeurs abîmées ignorées', () => {
    expect(migrateProgress({ version: 3, lives: 3, livesSpent: ['a:revive'] })).toMatchObject({ lives: 3, livesSpent: ['a:revive'] });
    expect(migrateProgress({ version: 3, lives: 99 }).lives).toBe(MAX_LIVES);
    expect(migrateProgress({ version: 3, lives: -2, livesSpent: ['<x>'] })).not.toHaveProperty('lives');
    expect(migrateProgress({ version: 3, lives: 'beaucoup' })).not.toHaveProperty('lives');
  });
});
