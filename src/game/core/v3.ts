/**
 * Règles rulesVersion 3 (V5) : boosts Ralenti, Aimant, Bouclier (cycle de la jauge) et
 * Fièvre (série de parfaits). Voir docs/V5-DIRECTION.md et README.md (section v3).
 *
 * Les v1 (`Simulation`) et v2 (`SimulationV2`) ne sont pas modifiées : même géométrie, même
 * PRNG, même vitesse de base. Pur : aucun DOM, horloge, stockage ni réseau.
 */
import { FIELD_WIDTH, MILLI, PERFECT_TOLERANCE, START_LEFT, START_WIDTH } from './constants';
import { advance, resolvePlacement, type Block } from './geometry';
import { isValidSeed, Xorshift32 } from './prng';
import { floorSpeed } from './simulation';
import { COUNTDOWN_TICKS, GAUGE_MAX, gaugeGain, MAX_CONTINUES, slowSpeed } from './v2';

export const RULES_VERSION_3 = 3 as const;

/** Boosts de la jauge, dans l'ordre du cycle. */
export type BoostId = 'ralenti' | 'aimant' | 'bouclier';
export const BOOST_IDS: readonly BoostId[] = ['ralenti', 'aimant', 'bouclier'];
/** Poses réussies couvertes par chaque boost. */
export const BOOST_FLOORS: Readonly<Record<BoostId, number>> = { ralenti: 5, aimant: 5, bouclier: 6 };
/** Aimant : tolérance du parfait (bords gauches), en milli. La v1/v2 garde PERFECT_TOLERANCE. */
export const MAGNET_TOLERANCE = 14 * MILLI;
/** Bouclier : après un raté rattrapé, l'étage repart au bord après 0,75 s (appuis ignorés). */
export const SAVE_TICKS = 90;
/** Fièvre : déclenchée au 5e parfait d'affilée, points × 2 tant que les poses restent parfaites. */
export const FEVER_STREAK = 5;
export const FEVER_MULTIPLIER = 2;

export type RunConfigV3 = { seed: number; rulesVersion: 3 };

export type RunResultV3 = {
  seed: number;
  rulesVersion: 3;
  /** Points (somme des points des poses). */
  score: number;
  /** Étages posés. */
  height: number;
  perfectCount: number;
  bestPerfectStreak: number;
  /** Boosts de jauge obtenus. */
  bonusCount: number;
  /** Fièvres déclenchées. */
  feverCount: number;
  /** Ratés rattrapés par le Bouclier. */
  savedCount: number;
  continues: 0 | 1;
  durationTicks: number;
  inputTicks: number[];
  continueTicks: number[];
};

export type RunStatusV3 = 'running' | 'countdown' | 'fallen' | 'ended';
/** Cause du compte à rebours : reprise (vie, 3 s) ou rattrapage du Bouclier (0,75 s). */
export type CountdownKind = 'continue' | 'save';

export type StepEventV3 =
  | {
      readonly kind: 'placed';
      readonly tick: number;
      readonly floor: number;
      readonly placed: Block;
      readonly cut: Block | null;
      readonly perfect: boolean;
      /** Parfait obtenu grâce à l'Aimant seulement (écart entre 4 et 14 unités) : le bloc s'est collé. */
      readonly snapped: boolean;
      readonly perfectStreak: number;
      /** Points de cette pose : 1, 2 ou 4. */
      readonly points: number;
      readonly score: number;
      readonly height: number;
      /** Boost de jauge qui s'appliquait à cette pose (null si aucun). */
      readonly boost: BoostId | null;
      readonly boostStarted: BoostId | null;
      readonly boostEnded: BoostId | null;
      /** Jauge après la pose (0 pendant un boost). */
      readonly gauge: number;
      /** Fièvre active pour cette pose (points doublés). */
      readonly fever: boolean;
      readonly feverStarted: boolean;
      readonly feverEnded: boolean;
    }
  | {
      readonly kind: 'missed';
      readonly tick: number;
      readonly floor: number;
      readonly moving: Block;
      /** Vrai si la partie attend une décision de reprise (état `fallen`). */
      readonly canContinue: boolean;
      readonly boost: BoostId | null;
      readonly fever: boolean;
    }
  | {
      /** Raté rattrapé par le Bouclier : la tour reste, l'étage repart après SAVE_TICKS. */
      readonly kind: 'saved';
      readonly tick: number;
      readonly floor: number;
      readonly moving: Block;
      readonly fever: boolean;
    }
  | { readonly kind: 'resumed'; readonly tick: number; readonly cause: CountdownKind };

/**
 * Simulation v3. Ordre d'un tick identique aux v1/v2 :
 *   tick += 1 → déplacement → si appui : pose → si posé, nouvel étage (boost déjà appliqué).
 * États :
 *   running   : normal ;
 *   fallen    : raté repris possible, `step` n'avance PAS le tick (attente de décision) ;
 *   countdown : après `continueRun()` (3 s) ou un rattrapage du Bouclier (0,75 s), le tick
 *               avance mais rien ne bouge et les appuis sont ignorés ; au dernier tick → `resumed` ;
 *   ended     : définitif.
 */
export class SimulationV3 {
  readonly seed: number;
  readonly rulesVersion = RULES_VERSION_3;

  private readonly rng: Xorshift32;
  private _tick = 0;
  private _status: RunStatusV3 = 'running';
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
  private _boost: BoostId | null = null;
  private _boostLeft = 0;
  private _boostCount = 0;
  private _fever = false;
  private _feverCount = 0;
  private _savedCount = 0;
  private _countdownEnd = 0;
  private _countdownKind: CountdownKind = 'continue';
  private readonly _inputTicks: number[] = [];
  private readonly _continueTicks: number[] = [];
  private readonly _stack: Block[] = [];

  constructor(config: RunConfigV3) {
    if (config.rulesVersion !== RULES_VERSION_3) {
      throw new RangeError(`rulesVersion non supportée : ${String(config.rulesVersion)}`);
    }
    if (!isValidSeed(config.seed)) throw new RangeError(`seed invalide : ${String(config.seed)}`);
    this.seed = config.seed;
    this.rng = new Xorshift32(config.seed);
    this._stack.push(this._base);
    this.spawn();
  }

  get tick(): number { return this._tick; }
  get status(): RunStatusV3 { return this._status; }
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
  get boost(): BoostId | null { return this._boost; }
  /** Poses restantes du boost actif (0 sans boost). */
  get boostFloorsLeft(): number { return this._boostLeft; }
  /** Prochain boost annoncé par la jauge. */
  get nextBoost(): BoostId { return BOOST_IDS[this._boostCount % BOOST_IDS.length]!; }
  get boostCount(): number { return this._boostCount; }
  get fever(): boolean { return this._fever; }
  get feverCount(): number { return this._feverCount; }
  get savedCount(): number { return this._savedCount; }
  /** Tolérance du parfait pour la pose en cours (élargie sous l'Aimant). */
  get tolerance(): number { return this._boost === 'aimant' ? MAGNET_TOLERANCE : PERFECT_TOLERANCE; }
  get continues(): 0 | 1 { return this._continueTicks.length === 0 ? 0 : 1; }
  /** Ticks restants du compte à rebours (0 hors compte à rebours). */
  get countdownLeft(): number { return this._status === 'countdown' ? this._countdownEnd - this._tick : 0; }
  get countdownKind(): CountdownKind { return this._countdownKind; }
  get stack(): readonly Block[] { return this._stack; }
  get inputTicks(): readonly number[] { return this._inputTicks; }
  get continueTicks(): readonly number[] { return this._continueTicks; }

  step(press: boolean): StepEventV3 | null {
    if (this._status === 'ended' || this._status === 'fallen') return null;
    this._tick += 1;
    if (this._status === 'countdown') {
      if (this._tick < this._countdownEnd) return null;
      this._status = 'running';
      return { kind: 'resumed', tick: this._tick, cause: this._countdownKind };
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
    this._boost = null;
    this._boostLeft = 0;
    this._gauge = 0;
    this._speed = this._baseSpeed; // même étage, même vitesse v1, sans nouveau tirage
    this.placeAtStart();
    this._countdownEnd = this._tick + COUNTDOWN_TICKS;
    this._countdownKind = 'continue';
    this._status = 'countdown';
    return true;
  }

  /** Refuse la reprise : fin définitive. Sans effet hors état `fallen`. */
  finish(): boolean {
    if (this._status !== 'fallen') return false;
    this._status = 'ended';
    return true;
  }

  result(): RunResultV3 | null {
    if (this._status !== 'ended') return null;
    return {
      seed: this.seed,
      rulesVersion: RULES_VERSION_3,
      score: this._score,
      height: this.height,
      perfectCount: this._perfectCount,
      bestPerfectStreak: this._bestStreak,
      bonusCount: this._boostCount,
      feverCount: this._feverCount,
      savedCount: this._savedCount,
      continues: this.continues,
      durationTicks: this._tick,
      inputTicks: [...this._inputTicks],
      continueTicks: [...this._continueTicks],
    };
  }

  private place(): StepEventV3 {
    const tick = this._tick;
    const floor = this._floor;
    const moving = this.moving;
    this._inputTicks.push(tick);
    const tolerance = this.tolerance;
    const outcome = resolvePlacement(this._base, moving, tolerance);
    if (outcome.kind === 'missed') {
      const fever = this._fever;
      this._perfectStreak = 0;
      this._fever = false;
      if (this._boost === 'bouclier') {
        // Rattrapage : le Bouclier se brise, la tour reste, le même étage repart du bord.
        this._boost = null;
        this._boostLeft = 0;
        this._savedCount += 1;
        this.placeAtStart();
        this._countdownEnd = tick + SAVE_TICKS;
        this._countdownKind = 'save';
        this._status = 'countdown';
        return { kind: 'saved', tick, floor, moving, fever };
      }
      const canContinue = this._continueTicks.length < MAX_CONTINUES;
      this._status = canContinue ? 'fallen' : 'ended';
      return { kind: 'missed', tick, floor, moving, canContinue, boost: this._boost, fever };
    }
    const snapped = outcome.perfect && Math.abs(moving.left - this._base.left) > PERFECT_TOLERANCE;
    let feverStarted = false;
    let feverEnded = false;
    if (outcome.perfect) {
      this._perfectCount += 1;
      this._perfectStreak += 1;
      if (this._perfectStreak > this._bestStreak) this._bestStreak = this._perfectStreak;
      if (!this._fever && this._perfectStreak >= FEVER_STREAK) {
        this._fever = true;
        this._feverCount += 1;
        feverStarted = true;
      }
    } else {
      this._perfectStreak = 0;
      if (this._fever) {
        this._fever = false;
        feverEnded = true;
      }
    }
    const boost = this._boost;
    const fever = this._fever;
    const points = (outcome.perfect ? 2 : 1) * (fever ? FEVER_MULTIPLIER : 1);
    this._score += points;
    let boostStarted: BoostId | null = null;
    let boostEnded: BoostId | null = null;
    if (boost !== null) {
      // Pose couverte par le boost : la jauge ne se remplit pas (pas de cumul).
      this._boostLeft -= 1;
      if (this._boostLeft === 0) {
        this._boost = null;
        boostEnded = boost;
      }
    } else {
      this._gauge += gaugeGain(outcome.perfect, this._perfectStreak);
      if (this._gauge >= GAUGE_MAX) {
        this._gauge = 0; // excédent perdu
        boostStarted = this.nextBoost;
        this._boost = boostStarted;
        this._boostLeft = BOOST_FLOORS[boostStarted];
        this._boostCount += 1;
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
      snapped,
      perfectStreak: this._perfectStreak,
      points,
      score: this._score,
      height: this.height,
      boost,
      boostStarted,
      boostEnded,
      gauge: this._gauge,
      fever,
      feverStarted,
      feverEnded,
    };
  }

  /** Un tirage par étage, comme en v1/v2, que le boost soit actif ou non. */
  private spawn(): void {
    const draw = this.rng.next();
    this._baseSpeed = floorSpeed(this._floor, draw);
    this._speed = this._boost === 'ralenti' ? slowSpeed(this._baseSpeed) : this._baseSpeed;
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
