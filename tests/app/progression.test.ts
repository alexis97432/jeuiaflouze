import { describe, expect, it } from 'vitest';
import {
  activeObjectives,
  applyRun,
  earnedBadges,
  INITIAL_PROGRESS,
  MAX_REMEMBERED_RUNS,
  OBJECTIVES,
  objectiveFor,
  rewardLabel,
  sanitizeProgress,
  selectAppearance,
  unlockedSkins,
  unlockedThemes,
  type ObjectiveId,
  type RunSummary,
} from '../../src/app/progression';

const run = (over: Partial<RunSummary> = {}): RunSummary => ({
  runId: 'r1',
  mode: 'free',
  score: 0,
  perfectCount: 0,
  longestStreak: 0,
  ...over,
});
const ids = (list: { id: string }[]) => list.map((o) => o.id);
const allActive = (): ObjectiveId[] => OBJECTIVES.map((o) => o.id);

describe('catalogue', () => {
  it('9 objectifs finis : 5 apparences, 2 univers, 2 badges, chaque récompense une fois', () => {
    expect(OBJECTIVES).toHaveLength(9);
    const rewards = OBJECTIVES.map((o) => `${o.reward.kind}:${o.reward.id}`);
    expect(new Set(rewards).size).toBe(9);
    expect(rewards.filter((r) => r.startsWith('skin:'))).toHaveLength(5);
    expect(rewards.filter((r) => r.startsWith('theme:'))).toHaveLength(2);
    expect(rewardLabel(OBJECTIVES[0]!.reward)).toBe('Apparence Marbré');
    expect(objectiveFor({ kind: 'theme', id: 'jardin' })?.id).toBe('daily-8');
  });

  it('état initial : Confiserie + Gomme, 3 premiers objectifs actifs', () => {
    expect(unlockedThemes(INITIAL_PROGRESS)).toEqual(['confiserie']);
    expect(unlockedSkins(INITIAL_PROGRESS)).toEqual(['gomme']);
    expect(ids(activeObjectives(INITIAL_PROGRESS))).toEqual(['floors-5', 'streak-2', 'floors-12']);
  });
});

describe('applyRun', () => {
  it('valide seulement les objectifs actifs au lancement', () => {
    const active = ids(activeObjectives(INITIAL_PROGRESS)) as ObjectiveId[];
    const { state, completedNow } = applyRun(INITIAL_PROGRESS, active, run({ score: 30, perfectCount: 12, longestStreak: 6 }));
    expect(ids(completedNow)).toEqual(['floors-5', 'streak-2', 'floors-12']);
    expect(state.completed).toEqual(['floors-5', 'streak-2', 'floors-12']);
    expect(ids(activeObjectives(state))).toEqual(['perfects-5', 'floors-18', 'daily-8']);
    expect(unlockedThemes(state)).toEqual(['confiserie', 'orbital']);
    expect(unlockedSkins(state)).toEqual(['gomme', 'marbre', 'bonbon']);
  });

  it('seuils inclus, non atteints exclus', () => {
    const r1 = applyRun(INITIAL_PROGRESS, allActive(), run({ score: 4, longestStreak: 1 }));
    expect(r1.completedNow).toEqual([]);
    const r2 = applyRun(INITIAL_PROGRESS, allActive(), run({ score: 5, longestStreak: 2 }));
    expect(ids(r2.completedNow)).toEqual(['floors-5', 'streak-2']);
  });

  it('idempotent par runId : aucun double gain', () => {
    const first = applyRun(INITIAL_PROGRESS, ['floors-5'], run({ score: 9 }));
    const again = applyRun(first.state, ['floors-5'], run({ score: 9 }));
    expect(again.state).toBe(first.state);
    expect(again.completedNow).toEqual([]);
  });

  it('Tour du jour ≥ 8 exigée pour Jardin', () => {
    expect(applyRun(INITIAL_PROGRESS, ['daily-8'], run({ score: 20, mode: 'free' })).completedNow).toEqual([]);
    expect(applyRun(INITIAL_PROGRESS, ['daily-8'], run({ score: 20, mode: 'challenge' })).completedNow).toEqual([]);
    expect(ids(applyRun(INITIAL_PROGRESS, ['daily-8'], run({ score: 8, mode: 'daily' })).completedNow)).toEqual(['daily-8']);
  });

  it('badges : distinctions sans apparence', () => {
    const { state } = applyRun(INITIAL_PROGRESS, ['floors-25', 'perfects-10'], run({ score: 25, perfectCount: 10 }));
    expect(earnedBadges(state)).toEqual(['touriste-des-nuages', 'precision']);
    expect(unlockedSkins(state)).toEqual(['gomme']);
  });

  it('borne la mémoire des parties évaluées', () => {
    let state = INITIAL_PROGRESS;
    for (let i = 0; i < MAX_REMEMBERED_RUNS + 10; i++) state = applyRun(state, [], run({ runId: `r${i}` })).state;
    expect(state.evaluatedRuns).toHaveLength(MAX_REMEMBERED_RUNS);
    expect(state.evaluatedRuns.at(-1)).toBe(`r${MAX_REMEMBERED_RUNS + 9}`);
  });
});

describe('sélection et sauvegarde', () => {
  it('refuse une apparence non débloquée', () => {
    expect(selectAppearance(INITIAL_PROGRESS, { theme: 'orbital', skin: 'verre' }).selected).toEqual({
      theme: 'confiserie',
      skin: 'gomme',
    });
    const unlocked = applyRun(INITIAL_PROGRESS, ['floors-5'], run({ score: 5 })).state;
    expect(selectAppearance(unlocked, { skin: 'marbre' }).selected.skin).toBe('marbre');
  });

  it.each([null, 3, 'x', [], { completed: 'floors-5' }])('sauvegarde invalide %j → état initial', (raw) => {
    expect(sanitizeProgress(raw)).toEqual(INITIAL_PROGRESS);
  });

  it('ignore les identifiants inconnus et une sélection non débloquée', () => {
    const state = sanitizeProgress({
      completed: ['floors-5', 'inconnu', 'floors-5', 42],
      selected: { theme: 'orbital', skin: 'marbre' },
      evaluatedRuns: ['a', '', 7, 'x'.repeat(65), 'b'],
    });
    expect(state.completed).toEqual(['floors-5']);
    expect(state.selected).toEqual({ theme: 'confiserie', skin: 'marbre' }); // orbital non gagné
    expect(state.evaluatedRuns).toEqual(['a', 'b']);
  });
});
