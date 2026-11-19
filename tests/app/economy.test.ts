import { describe, expect, it } from 'vitest';
import {
  applyRunEconomy,
  BACKFILL_GRANT,
  CALENDAR_REWARDS,
  calendarStatus,
  claimCalendar,
  INITIAL_DOC,
  levelInfo,
  levelThreshold,
  migrateProgress,
  readProgressDoc,
  dailyBonusLeft,
  runCoins,
  runXp,
  type ProgressDoc,
} from '../../src/app/economy';
import { MAX_REMEMBERED_RUNS, type RunSummary } from '../../src/app/progression';

const run = (over: Partial<RunSummary> = {}): RunSummary => ({
  runId: 'r1',
  mode: 'free',
  score: 10,
  perfectCount: 2,
  longestStreak: 1,
  ...over,
});

describe('E1a — migration vers le document v2', () => {
  it('sauvegarde absente : document neuf, prime marquée sans pièces', () => {
    expect(migrateProgress(undefined)).toEqual(INITIAL_DOC);
    expect(INITIAL_DOC.grants).toEqual([BACKFILL_GRANT]);
  });

  it('v1 (A3a) : objectifs et sélection conservés, 10 pièces par objectif déjà accompli, une seule fois', () => {
    const v1 = {
      completed: ['floors-5', 'streak-2'],
      selected: { theme: 'confiserie', skin: 'bonbon' },
      evaluatedRuns: ['a', 'b'],
    };
    const once = migrateProgress(v1);
    expect(once).toMatchObject({
      version: 6,
      completed: ['floors-5', 'streak-2'],
      selected: { theme: 'confiserie', skin: 'bonbon' },
      evaluatedRuns: ['a', 'b'],
      coins: 20,
      xp: 0,
      grants: [BACKFILL_GRANT],
    });
    // Rechargement : le document v2 sauvegardé ne rejoue pas la prime.
    const twice = migrateProgress(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
    expect(migrateProgress(twice).coins).toBe(20);
  });

  it('v2 sans drapeau de prime (abîmé) : drapeau rétabli sans verser de pièces', () => {
    const doc = migrateProgress({ version: 2, completed: ['floors-5'], coins: 7, grants: [] });
    expect(doc.coins).toBe(7);
    expect(doc.grants).toEqual([BACKFILL_GRANT]);
  });

  it('v2 abîmé : champs invalides remis à zéro, inconnus ignorés', () => {
    const doc = migrateProgress({
      version: 2,
      completed: ['floors-5', 'pirate'],
      xp: -4,
      coins: 1.5,
      inventory: ['graphite', '<img>', 'graphite', 3],
      calendar: { lastClaimDate: '2026-02-30', cycle: 'x', index: 99 },
      grants: [BACKFILL_GRANT, 'autre', '', 7],
    });
    expect(doc).toMatchObject({
      completed: ['floors-5'],
      xp: 0,
      coins: 0,
      inventory: ['graphite'],
      calendar: { lastClaimDate: null, cycle: 0, index: 6 },
      grants: [BACKFILL_GRANT, 'autre'],
    });
  });

  it('version future : XP, pièces et calendrier conservés, lecture seule (m3 FLK)', () => {
    const v3 = { version: 7, completed: ['floors-5'], xp: 900, coins: 400, calendar: { lastClaimDate: '2026-11-16', cycle: 2, index: 3 }, nouveau: { x: 1 } };
    const { doc, writable } = readProgressDoc(v3);
    expect(doc).toMatchObject({ xp: 900, coins: 400, completed: ['floors-5'], calendar: { lastClaimDate: '2026-11-16', cycle: 2, index: 3 } });
    expect(writable).toBe(false);
    expect(readProgressDoc({ version: 2 }).writable).toBe(true);
    expect(readProgressDoc({ version: 3 }).writable).toBe(true);
    expect(readProgressDoc({ version: 4 }).writable).toBe(true);
    expect(readProgressDoc({ version: 6 }).writable).toBe(true);
    expect(readProgressDoc(undefined).writable).toBe(true);
  });

  it.each([null, 'texte', 42, []])('sauvegarde illisible %j : document valide', (raw) => {
    expect(migrateProgress(raw).version).toBe(6);
  });
});

describe('E1b — XP et niveaux', () => {
  it('XP de partie (C5) : référence 10/2 = 14, plafonds 50 étages et 10 parfaits', () => {
    expect(runXp({ score: 10, perfectCount: 2 })).toBe(14);
    expect(runXp({ score: 0, perfectCount: 0 })).toBe(0);
    expect(runXp({ score: 80, perfectCount: 30 })).toBe(70);
  });

  it('seuils 20 × (L − 1) × L : 40, 400, 1800 pour les niveaux 2, 5, 10', () => {
    expect([2, 5, 10].map(levelThreshold)).toEqual([40, 400, 1800]);
  });

  it('V8 : 30 niveaux, seuils des 10 premiers inchangés (personne ne redescend)', () => {
    expect([10, 15, 20, 30].map(levelThreshold)).toEqual([1800, 4200, 7600, 17400]);
    expect(levelInfo(1800)).toEqual({ level: 10, title: 'Maître de la tour', intoLevel: 0, toNext: 400 });
    expect(levelInfo(4200)).toMatchObject({ level: 15, title: 'Bâtisseur des cimes' });
    expect(levelInfo(17_400)).toEqual({ level: 30, title: 'Légende de la tour', intoLevel: 0, toNext: null });
    expect(levelInfo(99_999)).toMatchObject({ level: 30, toNext: null });
  });

  it('niveaux aux bornes et titres', () => {
    expect(levelInfo(0)).toEqual({ level: 1, title: null, intoLevel: 0, toNext: 40 });
    expect(levelInfo(39)).toMatchObject({ level: 1, toNext: 1 });
    expect(levelInfo(40)).toMatchObject({ level: 2, title: 'Apprenti', intoLevel: 0 });
    expect(levelInfo(399)).toMatchObject({ level: 4, title: 'Apprenti' });
    expect(levelInfo(400)).toMatchObject({ level: 5, title: 'Architecte' });
  });
});

describe('E1c — pièces et fin de partie', () => {
  it.each([
    [4, 3, 0],
    [5, 0, 1],
    [10, 2, 1],
    [20, 4, 2],
    [25, 6, 4],
    [38, 15, 6],
    [80, 40, 6],
    [0, 0, 0],
  ])('V8 : %i étages, %i parfaits → %i pièces', (score, perfectCount, coins) => {
    expect(runCoins({ score, perfectCount })).toBe(coins);
  });

  it('une partie rapporte XP, pièces et 10 par objectif, une seule fois par runId', () => {
    const first = applyRunEconomy(INITIAL_DOC, ['floors-5', 'streak-2', 'floors-12'], run({ score: 12, perfectCount: 3, longestStreak: 2 }));
    expect(first.completedNow.map((o) => o.id)).toEqual(['floors-5', 'streak-2', 'floors-12']);
    expect(first.gained).toEqual({ xp: 18, coins: 2 + 30, bonus: 0, levelUp: null });
    expect(first.doc).toMatchObject({ xp: 18, coins: 32 });

    const again = applyRunEconomy(first.doc, ['perfects-5'], run({ score: 12, perfectCount: 3 }));
    expect(again.doc).toBe(first.doc);
    expect(again.gained).toEqual({ xp: 0, coins: 0, bonus: 0, levelUp: null });
  });

  it(`idempotence bornée aux ${MAX_REMEMBERED_RUNS} dernières parties (m2 FLK, documentée)`, () => {
    let doc = applyRunEconomy(INITIAL_DOC, [], run({ runId: 'ancienne' })).doc;
    for (let i = 0; i < MAX_REMEMBERED_RUNS - 1; i++) doc = applyRunEconomy(doc, [], run({ runId: `r${i}` })).doc;
    expect(applyRunEconomy(doc, [], run({ runId: 'ancienne' })).gained.coins).toBe(0); // encore mémorisée
    doc = applyRunEconomy(doc, [], run({ runId: 'une-de-plus' })).doc;
    expect(applyRunEconomy(doc, [], run({ runId: 'ancienne' })).gained.coins).toBe(1); // oubliée : limite assumée
  });

  it('signale un passage de niveau', () => {
    const doc: ProgressDoc = { ...INITIAL_DOC, xp: 35 };
    const { gained } = applyRunEconomy(doc, [], run({ runId: 'r9', score: 10, perfectCount: 0 }));
    expect(gained.levelUp).toEqual({ from: 1, to: 2 });
  });
});

describe('E1d — calendrier', () => {
  it('V8 : cycle 10,10,10,15,15,20,40 = 120 pièces, puis recommence', () => {
    expect(CALENDAR_REWARDS.reduce((a, b) => a + b, 0)).toBe(120);
    let doc = INITIAL_DOC;
    const got: number[] = [];
    for (let d = 1; d <= 8; d++) {
      const r = claimCalendar(doc, `2026-12-${String(d).padStart(2, '0')}`);
      if (!r.claimed) throw new Error(r.reason);
      got.push(r.reward);
      doc = r.doc;
    }
    expect(got).toEqual([10, 10, 10, 15, 15, 20, 40, 10]);
    expect(doc.coins).toBe(130);
    expect(doc.calendar).toEqual({ lastClaimDate: '2026-12-08', cycle: 1, index: 1 });
  });

  it('une réclamation par date ; horloge reculée refusée ; absence sans remise à zéro ni rattrapage', () => {
    const first = claimCalendar(INITIAL_DOC, '2026-11-16');
    if (!first.claimed) throw new Error('attendu');
    expect(claimCalendar(first.doc, '2026-11-16')).toMatchObject({ claimed: false, reason: 'already-claimed' });
    expect(claimCalendar(first.doc, '2026-11-15')).toMatchObject({ claimed: false, reason: 'earlier-date' });
    expect(claimCalendar(first.doc, 'demain')).toMatchObject({ claimed: false, reason: 'invalid-date' });
    const later = claimCalendar(first.doc, '2026-11-30'); // 13 jours d'absence
    if (!later.claimed) throw new Error('attendu');
    expect(later.reward).toBe(10); // 2e récompense, pas 13 rattrapées
    expect(later.doc.coins).toBe(20);
  });

  it('état du calendrier pour l’interface', () => {
    expect(calendarStatus(INITIAL_DOC, '2026-11-16')).toEqual({ canClaim: true, reward: 10, dayInCycle: 1 });
    const r = claimCalendar(INITIAL_DOC, '2026-11-16');
    expect(calendarStatus(r.doc, '2026-11-16').canClaim).toBe(false);
    expect(calendarStatus(r.doc, '2026-11-17')).toEqual({ canClaim: true, reward: 10, dayInCycle: 2 });
  });
});

describe('V8 — prime du jour', () => {
  it('3 premières parties d’au moins 5 étages du jour UTC : +10 chacune, puis plus rien ; nouveau jour, nouvelle prime', () => {
    let doc = INITIAL_DOC;
    const got: number[] = [];
    for (let i = 0; i < 5; i++) {
      const e = applyRunEconomy(doc, [], run({ runId: `j1-${i}`, score: 12, perfectCount: 0 }), '2026-12-01');
      got.push(e.gained.bonus);
      doc = e.doc;
    }
    expect(got).toEqual([10, 10, 10, 0, 0]);
    expect(doc.daily).toEqual({ day: '2026-12-01', count: 3 });
    expect(dailyBonusLeft(doc, '2026-12-01')).toBe(0);
    expect(dailyBonusLeft(doc, '2026-12-02')).toBe(3);
    const next = applyRunEconomy(doc, [], run({ runId: 'j2', score: 12 }), '2026-12-02');
    expect(next.gained).toMatchObject({ bonus: 10, coins: 2 + 10 });
  });

  it('une partie trop courte ne consomme pas la prime ; une partie déjà comptée ne la reçoit pas deux fois', () => {
    const short = applyRunEconomy(INITIAL_DOC, [], run({ runId: 'court', score: 4 }), '2026-12-01');
    expect(short.gained.bonus).toBe(0);
    expect(short.doc.daily).toBeUndefined();
    const once = applyRunEconomy(short.doc, [], run({ runId: 'ok', score: 6 }), '2026-12-01');
    const again = applyRunEconomy(once.doc, [], run({ runId: 'ok', score: 6 }), '2026-12-01');
    expect(once.gained.bonus).toBe(10);
    expect(again.doc).toBe(once.doc);
    expect(again.gained.coins).toBe(0);
  });

  it('migration : prime du jour relue, valeurs abîmées ignorées, pièces jamais touchées', () => {
    expect(migrateProgress({ version: 5, coins: 1234, daily: { day: '2026-12-01', count: 2 } })).toMatchObject({ version: 6, coins: 1234, daily: { day: '2026-12-01', count: 2 } });
    expect(migrateProgress({ version: 6, coins: 5, daily: { day: 'hier', count: 2 } }).daily).toBeUndefined();
    expect(migrateProgress({ version: 6, daily: { day: '2026-12-01', count: 99 } }).daily).toEqual({ day: '2026-12-01', count: 3 });
  });
});
