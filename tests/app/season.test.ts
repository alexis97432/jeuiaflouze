import { describe, expect, it } from 'vitest';
import { INITIAL_DOC, migrateProgress, type ProgressDoc } from '../../src/app/economy';
import {
  addSeasonStars, claimAllFree, claimSeasonTier, LEGACY_TIER_MAP, nextTier, SEASON_1, seasonLevel, seasonPhase, tierStatus, type SeasonReward,
} from '../../src/app/season';

const draws = (r: SeasonReward) => r.kind === 'coins' || r.id !== 'lave';
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
    const r = claimSeasonTier(d, SEASON_1, 3, 'free', ACTIVE, draws);
    expect(r.ok && r.doc.inventory).toEqual(['pixel']);
    expect(tierStatus(d, SEASON_1, SEASON_1.tiers[14]!, 'free', ACTIVE, draws)).toBe('soon');
    expect(claimSeasonTier(d, SEASON_1, 15, 'free', ACTIVE, draws)).toMatchObject({ ok: false, reason: 'soon' });
  });

  it('premium : jamais réclamable localement', () => {
    const d = addSeasonStars(doc(), SEASON_1, ACTIVE, 5000);
    for (const t of SEASON_1.tiers) {
      expect(claimSeasonTier(d, SEASON_1, t.tier, 'premium', ACTIVE, () => true)).toMatchObject({ ok: false, reason: 'premium-unavailable' });
    }
  });

  it('saison finie : plus de réclamation, apparences déjà prises conservées', () => {
    const d = addSeasonStars(doc(), SEASON_1, ACTIVE, 100);
    const r = claimSeasonTier(d, SEASON_1, 3, 'free', ACTIVE, draws);
    if (!r.ok) throw new Error(r.reason);
    expect(claimSeasonTier(r.doc, SEASON_1, 1, 'free', '2027-03-01', draws)).toMatchObject({ ok: false, reason: 'ended' });
    expect(r.doc.inventory).toContain('pixel');
  });

  it('sauvegarde : saison relue et nettoyée, document v2 migré vers v4 sans perte (réclamations renumérotées)', () => {
    const migrated = migrateProgress({
      version: 2, xp: 120, coins: 30, inventory: ['graphite'], grants: ['v2-objectives-backfill'],
      season: { id: 's1', stars: 70, claimed: ['free:1', 'free:1', 'pirate', 'premium:2'] },
    });
    expect(migrated).toMatchObject({ version: 4, xp: 120, coins: 30, inventory: ['graphite'], season: { id: 's1', stars: 70, claimed: ['free:1', 'premium:3'] } });
    expect(migrateProgress({ version: 3, season: { id: '<x>', stars: 5 } }).season).toBeUndefined();
    expect(nextTier(migrated, SEASON_1)?.tier).toBe(4);
  });

  it('V6 : 30 niveaux croissants ; les 10 anciens paliers gardent seuils et récompenses gratuites', () => {
    expect(SEASON_1.tiers).toHaveLength(30);
    SEASON_1.tiers.forEach((t, i) => {
      expect(t.tier).toBe(i + 1);
      if (i > 0) expect(t.stars).toBeGreaterThan(SEASON_1.tiers[i - 1]!.stars);
    });
    expect(SEASON_1.tiers[0]!.stars).toBe(20);
    expect(SEASON_1.tiers[29]!.stars).toBe(3000);
    const legacy: [number, SeasonReward][] = [
      [20, { kind: 'coins', amount: 10 }], [60, { kind: 'skin', id: 'pixel', name: 'Pixel' }], [120, { kind: 'coins', amount: 15 }],
      [200, { kind: 'coins', amount: 20 }], [300, { kind: 'skin', id: 'galaxie', name: 'Galaxie' }], [420, { kind: 'coins', amount: 25 }],
      [560, { kind: 'coins', amount: 30 }], [720, { kind: 'skin', id: 'lave', name: 'Lave' }], [900, { kind: 'coins', amount: 40 }], [1100, { kind: 'coins', amount: 50 }],
    ];
    legacy.forEach(([stars, reward], i) => {
      const t = SEASON_1.tiers[LEGACY_TIER_MAP[i]! - 1]!;
      expect(t.stars).toBe(stars);
      expect(t.free).toEqual(reward);
    });
    // Premium : des cosmétiques exclusifs réellement fabriqués (pas seulement des pièces).
    const premiumItems = SEASON_1.tiers.map((t) => t.premium).filter((r) => r.kind !== 'coins').map((r) => (r as { id: string }).id);
    expect(premiumItems).toEqual(['neon', 'or', 'cristal', 'cite', 'abysse']);
  });

  it('V6 : migration v3 → v4 une seule fois, aucune récompense rendue deux fois', () => {
    const v3 = { version: 3, coins: 0, inventory: ['pixel', 'galaxie'], grants: ['v2-objectives-backfill'], season: { id: 's1', stars: 640, claimed: ['free:1', 'free:2', 'free:5'] } };
    const once = migrateProgress(v3);
    expect(once.season?.claimed).toEqual(['free:1', 'free:3', 'free:9']);
    // Relire un document déjà en v4 ne renumérote plus.
    expect(migrateProgress(once).season?.claimed).toEqual(['free:1', 'free:3', 'free:9']);
    // Pixel (niveau 3) et Galaxie (niveau 9) restent récupérés : pas de second exemplaire.
    for (const tier of [1, 3, 9]) expect(claimSeasonTier(once, SEASON_1, tier, 'free', ACTIVE, draws)).toMatchObject({ ok: false, reason: 'claimed' });
    // Les nouveaux niveaux intermédiaires (contenu nouveau) sont récupérables une fois.
    const all = claimAllFree(once, SEASON_1, ACTIVE, draws);
    expect(all.rewards.map((r) => (r.kind === 'coins' ? r.amount : r.id))).toEqual([10, 15, 15, 20, 20, 25, 25, 25, 30, 30, 30]);
    expect(claimAllFree(all.doc, SEASON_1, ACTIVE, draws).rewards).toEqual([]);
    expect(all.doc.inventory).toEqual(['pixel', 'galaxie']);
  });

  it('V6 : niveau de passe et progression vers le suivant', () => {
    expect(seasonLevel(doc(), SEASON_1)).toMatchObject({ level: 0, max: 30, into: 0, span: 20 });
    const d = addSeasonStars(doc(), SEASON_1, ACTIVE, 650);
    expect(seasonLevel(d, SEASON_1)).toMatchObject({ level: 14, into: 10, span: 80 });
    expect(seasonLevel(addSeasonStars(doc(), SEASON_1, ACTIVE, 5000), SEASON_1)).toMatchObject({ level: 30, next: null });
  });
});
