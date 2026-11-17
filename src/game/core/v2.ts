/**
 * Règles rulesVersion 2 : jauge « Étoile », bonus Ralenti / ×2, points distincts de la
 * hauteur, reprise unique avec compte à rebours. Voir README.md (section v2).
 *
 * La v1 (`Simulation`) n'est pas modifiée : même géométrie, même PRNG, même vitesse de base.
 * Pur : aucun DOM, horloge, stockage ni réseau. Tout est compté en ticks et en poses.
 */
import { FIELD_WIDTH, START_LEFT, START_WIDTH } from './constants';
import { advance, resolvePlacement, type Block } from './geometry';
import { isValidSeed, Xorshift32 } from './prng';
import { floorSpeed } from './simulation';

export const RULES_VERSION_2 = 2 as const;
/** Capacité de la jauge. */
export const GAUGE_MAX = 10;
/** Gains de jauge par pose réussie hors bonus. */
export const GAUGE_GAIN_PLACED = 1;
export const GAUGE_GAIN_PERFECT = 2;
export const GAUGE_GAIN_PERFECT_STREAK = 3;
/** Série de parfaits (après la pose) à partir de laquelle le gain passe à 3. */
export const GAUGE_STREAK_THRESHOLD = 3;
/** Nombre de poses réussies couvertes par un bonus. */
export const BONUS_FLOORS = 5;
/** Ralenti : vitesse × 3/5, arrondie vers le bas, au moins 1 milli/tick. */
export const SLOW_NUM = 3;
export const SLOW_DEN = 5;
/** Compte à rebours après une reprise : 3 s à 120 ticks/s. */
export const COUNTDOWN_TICKS = 360;
export const MAX_CONTINUES = 1;

export type BonusId = 'ralenti' | 'double';
/** Ordre d'alternance : le 1er bonus est Ralenti, le 2e ×2, etc. */
export const BONUS_IDS: readonly BonusId[] = ['ralenti', 'double'];

export type RunConfigV2 = { seed: number; rulesVersion: 2 };

export type RunResultV2 = {
  seed: number;
  rulesVersion: 2;
  /** Points (somme des points des poses). */
  score: number;
  /** Étages posés. */
  height: number;
  perfectCount: number;
  bestPerfectStreak: number;
  bonusCount: number;
  continues: 0 | 1;
  durationTicks: number;
  inputTicks: number[];
  continueTicks: number[];
};

export type RunStatusV2 = 'running' | 'countdown' | 'fallen' | 'ended';

export type StepEventV2 =
  | {
      readonly kind: 'placed';
      readonly tick: number;
      readonly floor: number;
      readonly placed: Block;
      readonly cut: Block | null;
      readonly perfect: boolean;
      readonly perfectStreak: number;
      /** Points de cette pose : 1, 2 ou 4. */
      readonly points: number;
      readonly score: number;
      readonly height: number;
      /** Bonus qui s'appliquait à cette pose (null si aucun). */
      readonly bonus: BonusId | null;
      /** Jauge après la pose (0 pendant un bonus). */
      readonly gauge: number;
      readonly bonusStarted: BonusId | null;
      readonly bonusEnded: BonusId | null;
    }
  | {
      readonly kind: 'missed';
      readonly tick: number;
      readonly floor: number;
      readonly moving: Block;
      /** Vrai si la partie attend une décision de reprise (état `fallen`). */
      readonly canContinue: boolean;
      /** Bonus actif au moment du raté (annulé en cas de reprise). */
      readonly bonus: BonusId | null;
    }
  | { readonly kind: 'resumed'; readonly tick: number };

/** Vitesse d'un étage sous Ralenti. */
export function slowSpeed(speed: number): number {
  return Math.max(1, Math.floor((speed * SLOW_NUM) / SLOW_DEN));
}

/** Gain de jauge d'une pose réussie hors bonus. `streak` = série après la pose. */
export function gaugeGain(perfect: boolean, streak: number): number {
  if (!perfect) return GAUGE_GAIN_PLACED;
  return streak >= GAUGE_STREAK_THRESHOLD ? GAUGE_GAIN_PERFECT_STREAK : GAUGE_GAIN_PERFECT;
}

/**
 * Simulation v2. Ordre d'un tick identique à la v1 :
 *   tick += 1 → déplacement → si appui : pose → si posé, nouvel étage (bonus déjà appliqué).
 * États :
 *   running   : normal ;
 *   fallen    : raté repris possible, `step` n'avance PAS le tick (attente de décision) ;
 *   countdown : après `continueRun()`, le tick avance mais rien ne bouge et les appuis
 *               sont ignorés pendant ]t, t + COUNTDOWN_TICKS] ; au dernier tick → `resumed` ;
 *   ended     : définitif.
 */
export class SimulationV2 {
  readonly seed: number;
  readonly rulesVersion = RULES_VERSION_2;

  private readonly rng: Xorshift32;
  private _tick = 0;
  private _status: RunStatusV2 = 'running';
  private _floor = 1;
  private _base: Block = { left: START_LEFT, width: START_WIDTH };
  private _movingLeft = 0;
  private _dir: 1 | -1 = 1;
  /** Vitesse v1 de l'étage courant (avant Ralenti). */
  private _baseSpeed = 0;
  private _speed = 0;
  private _score = 0;
  private _perfectCount = 0;
  private _perfectStreak = 0;
  private _bestStreak = 0;
  private _gauge = 0;
  private _bonus: BonusId | null = null;
  private _bonusLeft = 0;
  private _bonusCount = 0;
  private _countdownEnd = 0;
  private readonly _inputTicks: number[] = [];
  private readonly _continueTicks: number[] = [];
  private readonly _stack: Block[] = [];

  constructor(config: RunConfigV2) {
    if (config.rulesVersion !== RULES_VERSION_2) {
      throw new RangeError(`rulesVersion non supportée : ${String(config.rulesVersion)}`);
    }
    if (!isValidSeed(config.seed)) throw new RangeError(`seed invalide : ${String(config.seed)}`);
    this.seed = config.seed;
    this.rng = new Xorshift32(config.seed);
    this._stack.push(this._base);
    this.spawn();
  }

  get tick(): number { return this._tick; }
  get status(): RunStatusV2 { return this._status; }
  /** Points. */
  get score(): number { return this._score; }
  /** Étages posés. */
  get height(): number { return this._floor - 1; }
  get floor(): number { return this._floor; }
  get base(): Block { return this._base; }
  get moving(): Block { return { left: this._movingLeft, width: this._base.width }; }
  get direction(): 1 | -1 { return this._dir; }
  get speed(): number { return this._speed; }
  get perfectCount(): number { return this._perfectCount; }
  get perfectStreak(): number { return this._perfectStreak; }
  get bestPerfectStreak(): number { return this._bestStreak; }
  get gauge(): number { return this._gauge; }
  get bonus(): BonusId | null { return this._bonus; }
  /** Poses restantes du bonus actif (0 sans bonus). */
  get bonusFloorsLeft(): number { return this._bonusLeft; }
  /** Prochain bonus annoncé par la jauge. */
  get nextBonus(): BonusId { return BONUS_IDS[this._bonusCount % BONUS_IDS.length]!; }
  get bonusCount(): number { return this._bonusCount; }
  get continues(): 0 | 1 { return this._continueTicks.length === 0 ? 0 : 1; }
  /** Ticks restants du compte à rebours (0 hors compte à rebours). */
  get countdownLeft(): number { return this._status === 'countdown' ? this._countdownEnd - this._tick : 0; }
  get stack(): readonly Block[] { return this._stack; }
  get inputTicks(): readonly number[] { return this._inputTicks; }
  get continueTicks(): readonly number[] { return this._continueTicks; }

  step(press: boolean): StepEventV2 | null {
    if (this._status === 'ended' || this._status === 'fallen') return null;
    this._tick += 1;
    if (this._status === 'countdown') {
      if (this._tick < this._countdownEnd) return null;
      this._status = 'running';
      return { kind: 'resumed', tick: this._tick };
    }
    const moved = advance(this._movingLeft, this._dir, this._speed, this._base.width);
    this._movingLeft = moved.left;
    this._dir = moved.dir;
    if (!press) return null;
    return this.place();
  }

  /**
   * Accepte la reprise (autorisation donnée par l'application). Renvoie false, sans effet,
   * hors état `fallen` (double appel, partie déjà reprise ou terminée).
   */
  continueRun(): boolean {
    if (this._status !== 'fallen') return false;
    this._continueTicks.push(this._tick);
    this._bonus = null;
    this._bonusLeft = 0;
    this._gauge = 0;
    this._speed = this._baseSpeed; // même étage, même vitesse v1, sans nouveau tirage
    this.placeAtStart();
    this._countdownEnd = this._tick + COUNTDOWN_TICKS;
    this._status = 'countdown';
    return true;
  }

  /** Refuse la reprise : fin définitive. Sans effet hors état `fallen`. */
  finish(): boolean {
    if (this._status !== 'fallen') return false;
    this._status = 'ended';
    return true;
  }

  result(): RunResultV2 | null {
    if (this._status !== 'ended') return null;
    return {
      seed: this.seed,
      rulesVersion: RULES_VERSION_2,
      score: this._score,
      height: this.height,
      perfectCount: this._perfectCount,
      bestPerfectStreak: this._bestStreak,
      bonusCount: this._bonusCount,
      continues: this.continues,
      durationTicks: this._tick,
      inputTicks: [...this._inputTicks],
      continueTicks: [...this._continueTicks],
    };
  }

  private place(): StepEventV2 {
    const tick = this._tick;
    const floor = this._floor;
    const moving = this.moving;
    this._inputTicks.push(tick);
    const outcome = resolvePlacement(this._base, moving);
    if (outcome.kind === 'missed') {
      this._perfectStreak = 0;
      const canContinue = this._continueTicks.length < MAX_CONTINUES;
      this._status = canContinue ? 'fallen' : 'ended';
      return { kind: 'missed', tick, floor, moving, canContinue, bonus: this._bonus };
    }
    if (outcome.perfect) {
      this._perfectCount += 1;
      this._perfectStreak += 1;
      if (this._perfectStreak > this._bestStreak) this._bestStreak = this._perfectStreak;
    } else {
      this._perfectStreak = 0;
    }
    const bonus = this._bonus;
    const points = (outcome.perfect ? 2 : 1) * (bonus === 'double' ? 2 : 1);
    this._score += points;
    let bonusStarted: BonusId | null = null;
    let bonusEnded: BonusId | null = null;
    if (bonus !== null) {
      // Pose couverte par le bonus : la jauge ne se remplit pas (pas de cumul).
      this._bonusLeft -= 1;
      if (this._bonusLeft === 0) {
        this._bonus = null;
        bonusEnded = bonus;
      }
    } else {
      this._gauge += gaugeGain(outcome.perfect, this._perfectStreak);
      if (this._gauge >= GAUGE_MAX) {
        this._gauge = 0; // excédent perdu
        bonusStarted = this.nextBonus;
        this._bonus = bonusStarted;
        this._bonusLeft = BONUS_FLOORS;
        this._bonusCount += 1;
      }
    }
    this._base = outcome.placed;
    this._stack.push(outcome.placed);
    this._floor += 1;
    this.spawn();
    return {
      kind: 'placed',
      tick,
      floor,
      placed: outcome.placed,
      cut: outcome.cut,
      perfect: outcome.perfect,
      perfectStreak: this._perfectStreak,
      points,
      score: this._score,
      height: this.height,
      bonus,
      gauge: this._gauge,
      bonusStarted,
      bonusEnded,
    };
  }

  /** Un tirage par étage, comme en v1, que le bonus soit actif ou non. */
  private spawn(): void {
    const draw = this.rng.next();
    this._baseSpeed = floorSpeed(this._floor, draw);
    this._speed = this._bonus === 'ralenti' ? slowSpeed(this._baseSpeed) : this._baseSpeed;
    this.placeAtStart();
  }

  private placeAtStart(): void {
    if (this._floor % 2 === 1) {
      this._movingLeft = 0;
      this._dir = 1;
    } else {
      this._movingLeft = FIELD_WIDTH - this._base.width;
      this._dir = -1;
    }
  }
}
