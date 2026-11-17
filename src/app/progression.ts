/**
 * Progression locale V2 (coordination/V2.md § Objectifs) — logique pure, sans DOM ni stockage.
 *
 * - Catalogue fini de 9 objectifs ; les 3 premiers non accomplis sont « actifs ».
 * - Seuls les objectifs actifs **au lancement** d'une partie peuvent être validés par elle.
 * - Une partie (runId) n'est évaluée qu'une fois ; chaque récompense n'est accordée qu'une fois.
 * - Les déblocages sont **dérivés** des objectifs accomplis (jamais stockés à part) : la sélection
 *   et les déblocages restent cohérents même après une sauvegarde abîmée.
 * Identifiants d'apparence : proposition Alexis (revue C3), à convenir avec FLK (F3/F4).
 */

export const THEME_IDS = ['confiserie', 'orbital', 'jardin'] as const;
export const SKIN_IDS = ['gomme', 'marbre', 'bonbon', 'verre', 'strie', 'ceramique'] as const;
export const BADGE_IDS = ['touriste-des-nuages', 'precision'] as const;

export type ThemeId = (typeof THEME_IDS)[number];
export type SkinId = (typeof SKIN_IDS)[number];
export type BadgeId = (typeof BADGE_IDS)[number];
export type Appearance = { theme: ThemeId; skin: SkinId };

export const DEFAULT_APPEARANCE: Appearance = { theme: 'confiserie', skin: 'gomme' };

export type PlayMode = 'free' | 'challenge' | 'daily';

/** Résumé d'une partie réellement jouée (RunResult + événements du moteur). */
export type RunSummary = {
  runId: string;
  mode: PlayMode;
  score: number;
  perfectCount: number;
  longestStreak: number;
};

export type Reward =
  | { kind: 'skin'; id: SkinId }
  | { kind: 'theme'; id: ThemeId }
  | { kind: 'badge'; id: BadgeId };

export type Objective = {
  id: ObjectiveId;
  label: string;
  reward: Reward;
  met(run: RunSummary): boolean;
};

export const OBJECTIVE_IDS = [
  'floors-5',
  'streak-2',
  'floors-12',
  'perfects-5',
  'floors-18',
  'daily-8',
  'streak-4',
  'floors-25',
  'perfects-10',
] as const;
export type ObjectiveId = (typeof OBJECTIVE_IDS)[number];

/** Ordre et valeurs : coordination/V2.md (hypothèses de réglage). */
export const OBJECTIVES: readonly Objective[] = [
  { id: 'floors-5', label: 'Poser au moins 5 étages dans une partie', reward: { kind: 'skin', id: 'marbre' }, met: (r) => r.score >= 5 },
  { id: 'streak-2', label: 'Faire 2 parfaits consécutifs dans une partie', reward: { kind: 'skin', id: 'bonbon' }, met: (r) => r.longestStreak >= 2 },
  { id: 'floors-12', label: 'Poser au moins 12 étages dans une partie', reward: { kind: 'theme', id: 'orbital' }, met: (r) => r.score >= 12 },
  { id: 'perfects-5', label: 'Faire 5 parfaits dans une partie', reward: { kind: 'skin', id: 'verre' }, met: (r) => r.perfectCount >= 5 },
  { id: 'floors-18', label: 'Poser au moins 18 étages dans une partie', reward: { kind: 'skin', id: 'strie' }, met: (r) => r.score >= 18 },
  { id: 'daily-8', label: 'Terminer une Tour du jour avec au moins 8 étages', reward: { kind: 'theme', id: 'jardin' }, met: (r) => r.mode === 'daily' && r.score >= 8 },
  { id: 'streak-4', label: 'Faire 4 parfaits consécutifs dans une partie', reward: { kind: 'skin', id: 'ceramique' }, met: (r) => r.longestStreak >= 4 },
  { id: 'floors-25', label: 'Poser au moins 25 étages dans une partie', reward: { kind: 'badge', id: 'touriste-des-nuages' }, met: (r) => r.score >= 25 },
  { id: 'perfects-10', label: 'Faire 10 parfaits dans une partie', reward: { kind: 'badge', id: 'precision' }, met: (r) => r.perfectCount >= 10 },
];

const REWARD_LABELS: Record<SkinId | ThemeId | BadgeId, string> = {
  gomme: 'Gomme',
  marbre: 'Marbré',
  bonbon: 'Bonbon',
  verre: 'Verre dépoli',
  strie: 'Strié',
  ceramique: 'Céramique',
  confiserie: 'Confiserie',
  orbital: 'Orbital',
  jardin: 'Jardin',
  'touriste-des-nuages': 'Touriste des nuages',
  precision: 'Précision',
};

export function rewardLabel(reward: Reward): string {
  const kind = reward.kind === 'skin' ? 'Apparence' : reward.kind === 'theme' ? 'Univers' : 'Badge';
  return `${kind} ${REWARD_LABELS[reward.id]}`;
}

export const ACTIVE_OBJECTIVES = 3;
/**
 * Parties déjà évaluées gardées en mémoire pour l'idempotence. Borné (≈ 3,5 Ko) : la garantie
 * vaut pour les MAX_REMEMBERED_RUNS dernières parties ; une partie plus ancienne réappliquée
 * serait recomptée. Aucun chemin de l'interface ne réapplique une ancienne partie (revue E1 FLK, m2).
 */
export const MAX_REMEMBERED_RUNS = 200;

export type ProgressState = {
  completed: ObjectiveId[];
  selected: Appearance;
  evaluatedRuns: string[];
};

export const INITIAL_PROGRESS: ProgressState = {
  completed: [],
  selected: DEFAULT_APPEARANCE,
  evaluatedRuns: [],
};

const objectiveById = new Map(OBJECTIVES.map((o) => [o.id, o]));

export function activeObjectives(state: ProgressState): Objective[] {
  return OBJECTIVES.filter((o) => !state.completed.includes(o.id)).slice(0, ACTIVE_OBJECTIVES);
}

const rewardsOf = (state: ProgressState) =>
  state.completed.map((id) => objectiveById.get(id)?.reward).filter((r): r is Reward => !!r);

export function unlockedThemes(state: ProgressState): ThemeId[] {
  const won = new Set(rewardsOf(state).flatMap((r) => (r.kind === 'theme' ? [r.id] : [])));
  return THEME_IDS.filter((id) => id === DEFAULT_APPEARANCE.theme || won.has(id));
}

export function unlockedSkins(state: ProgressState): SkinId[] {
  const won = new Set(rewardsOf(state).flatMap((r) => (r.kind === 'skin' ? [r.id] : [])));
  return SKIN_IDS.filter((id) => id === DEFAULT_APPEARANCE.skin || won.has(id));
}

export function earnedBadges(state: ProgressState): BadgeId[] {
  const won = new Set(rewardsOf(state).flatMap((r) => (r.kind === 'badge' ? [r.id] : [])));
  return BADGE_IDS.filter((id) => won.has(id));
}

/** Objectif qui débloque une récompense donnée (pour expliquer exactement comment l'obtenir). */
export function objectiveFor(reward: Reward): Objective | undefined {
  return OBJECTIVES.find((o) => o.reward.kind === reward.kind && o.reward.id === reward.id);
}

export type RunEvaluation = { state: ProgressState; completedNow: Objective[] };

/**
 * Évalue une partie terminée contre les objectifs actifs **au lancement** (`activeAtStart`).
 * Idempotent par runId parmi les MAX_REMEMBERED_RUNS dernières parties évaluées.
 */
export function applyRun(
  state: ProgressState,
  activeAtStart: readonly ObjectiveId[],
  run: RunSummary,
): RunEvaluation {
  if (state.evaluatedRuns.includes(run.runId)) return { state, completedNow: [] };
  const completedNow = activeAtStart
    .filter((id) => !state.completed.includes(id))
    .map((id) => objectiveById.get(id))
    .filter((o): o is Objective => !!o && o.met(run));
  // Ordre du catalogue conservé quel que soit l'ordre de validation.
  const completed = OBJECTIVE_IDS.filter(
    (id) => state.completed.includes(id) || completedNow.some((o) => o.id === id),
  );
  return {
    state: {
      ...state,
      completed,
      evaluatedRuns: [...state.evaluatedRuns, run.runId].slice(-MAX_REMEMBERED_RUNS),
    },
    completedNow,
  };
}

/** Change l'apparence ; refuse silencieusement ce qui n'est pas débloqué. */
export function selectAppearance(state: ProgressState, next: Partial<Appearance>): ProgressState {
  const theme = next.theme && unlockedThemes(state).includes(next.theme) ? next.theme : state.selected.theme;
  const skin = next.skin && unlockedSkins(state).includes(next.skin) ? next.skin : state.selected.skin;
  return { ...state, selected: { theme, skin } };
}

const isIn = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);

/**
 * Reconstruit un état valide à partir d'une donnée inconnue (sauvegarde ancienne, abîmée ou
 * modifiée à la main) : identifiants inconnus ignorés, sélection non débloquée remise par défaut.
 */
export function sanitizeProgress(raw: unknown): ProgressState {
  if (typeof raw !== 'object' || raw === null) return INITIAL_PROGRESS;
  const r = raw as Record<string, unknown>;
  const completedRaw = Array.isArray(r.completed) ? r.completed : [];
  const completed = OBJECTIVE_IDS.filter((id) => completedRaw.includes(id));
  const runs = Array.isArray(r.evaluatedRuns)
    ? r.evaluatedRuns.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 64)
    : [];
  const sel = (typeof r.selected === 'object' && r.selected !== null ? r.selected : {}) as Record<string, unknown>;
  const base: ProgressState = {
    completed,
    selected: DEFAULT_APPEARANCE,
    evaluatedRuns: runs.slice(-MAX_REMEMBERED_RUNS),
  };
  return selectAppearance(base, {
    ...(isIn(THEME_IDS, sel.theme) ? { theme: sel.theme } : {}),
    ...(isIn(SKIN_IDS, sel.skin) ? { skin: sel.skin } : {}),
  });
}
