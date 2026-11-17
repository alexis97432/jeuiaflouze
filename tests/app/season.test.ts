import { describe, expect, it } from 'vitest';
import { INITIAL_DOC, migrateProgress, type ProgressDoc } from '../../src/app/economy';
import { addSeasonStars, claimSeasonTier, nextTier, SEASON_1, seasonPhase, tierStatus } from '../../src/app/season';

const draws = (id: string) => id !== 'lave';
const doc = (over: Partial<ProgressDoc> = {}): ProgressDoc => ({ ...INITIAL_DOC, ...over });
const ACTIVE = '2026-12-01';

describe('passe de saison', () => {
  it('dates : à venir, active (bornes incluses), finie', () => {
    expect(seasonPhase(SEASON_1, '2026-11-16')).toBe('upcoming');
    expect(seasonPhase(SEASON_1, '2026-11-17')).toBe('active');
    expect(seasonPhase(SEASON_1, '2027-02-28')).toBe('active');
    expect(seasonPhase(SEASON_1, '2027-03-01')).toBe('ended');
  });

  it('étoiles comptées seulement pendant la saison', () => {
    expect(addSeasonStars(doc(), SEASON_1, '2026-11-16', 30).season).toBeUndefined();
    expect(addSeasonStars(doc(), SEASON_1, ACTIVE, 30).season).toEqual({ id: 's1', stars: 30, claimed: [] });
    expect(addSeasonStars(doc(), SEASON_1, ACTIVE, 0).season).toBeUndefined();
  });

  it('piste gratuite : réclamable une seule fois, pièces ajoutées', () => {
    const d = addSeasonStars(doc({ coins: 5 }), SEASON_1, ACTIVE, 25);
    const r = claimSeasonTier(d, SEASON_1, 1, 'free', ACTIVE, draws);
    expect(r.ok && r.doc.coins).toBe(15);
    const again = claimSeasonTier(r.doc, SEASON_1, 1, 'free', ACTIVE, draws);
    expect(again).toMatchObject({ ok: false, reason: 'claimed' });
    expect(again.doc.coins).toBe(15);
    expect(claimSeasonTier(d, SEASON_1, 2, 'free', ACTIVE, draws)).toMatchObject({ ok: false, reason: 'locked' });
    expect(claimSeasonTier(d, SEASON_1, 99, 'free', ACTIVE, draws)).toMatchObject({ ok: false, reason: 'unknown-tier' });
  });

  it('apparence : ajoutée à l’inventaire ; « Bientôt » tant que le moteur ne la dessine pas', () => {
    const d = addSeasonStars(doc(), SEASON_1, ACTIVE, 800);
    const r = claimSeasonTier(d, SEASON_1, 2, 'free', ACTIVE, draws);
    expect(r.ok && r.doc.inventory).toEqual(['pixel']);
    expect(tierStatus(d, SEASON_1, SEASON_1.tiers[7]!, 'free', ACTIVE, draws)).toBe('soon');
    expect(claimSeasonTier(d, SEASON_1, 8, 'free', ACTIVE, draws)).toMatchObject({ ok: false, reason: 'soon' });
  });

  it('premium : jamais réclamable localement', () => {
    const d = addSeasonStars(doc(), SEASON_1, ACTIVE, 5000);
    for (const t of SEASON_1.tiers) {
      expect(claimSeasonTier(d, SEASON_1, t.tier, 'premium', ACTIVE, () => true)).toMatchObject({ ok: false, reason: 'premium-unavailable' });
    }
  });

  it('saison finie : plus de réclamation, apparences déjà prises conservées', () => {
    const d = addSeasonStars(doc(), SEASON_1, ACTIVE, 100);
    const r = claimSeasonTier(d, SEASON_1, 2, 'free', ACTIVE, draws);
    if (!r.ok) throw new Error(r.reason);
    expect(claimSeasonTier(r.doc, SEASON_1, 1, 'free', '2027-03-01', draws)).toMatchObject({ ok: false, reason: 'ended' });
    expect(r.doc.inventory).toContain('pixel');
  });

  it('sauvegarde : saison relue et nettoyée, document v2 migré vers v3 sans perte', () => {
    const migrated = migrateProgress({
      version: 2, xp: 120, coins: 30, inventory: ['graphite'], grants: ['v2-objectives-backfill'],
      season: { id: 's1', stars: 70, claimed: ['free:1', 'free:1', 'pirate', 'premium:2'] },
    });
    expect(migrated).toMatchObject({ version: 3, xp: 120, coins: 30, inventory: ['graphite'], season: { id: 's1', stars: 70, claimed: ['free:1', 'premium:2'] } });
    expect(migrateProgress({ version: 3, season: { id: '<x>', stars: 5 } }).season).toBeUndefined();
    expect(nextTier(migrated, SEASON_1)?.tier).toBe(3);
  });
});
