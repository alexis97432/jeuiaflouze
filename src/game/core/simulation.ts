import {
  BASE_SPEED,
  FIELD_WIDTH,
  MILLI,
  RULES_VERSION,
  SPEED_CAP,
  SPEED_JITTER_MIN,
  SPEED_JITTER_SPAN,
  SPEED_STEP,
  START_LEFT,
  START_WIDTH,
  TICK_RATE,
  UINT32_RANGE,
} from './constants';
import { advance, resolvePlacement, type Block } from './geometry';
import { isValidSeed, Xorshift32 } from './prng';

export type RunConfig = { seed: number; rulesVersion: 1 };

export type RunResult = {
  seed: number;
  rulesVersion: 1;
  score: number;
  perfectCount: number;
  durationTicks: number;
  inputTicks: number[];
};

export type StepEvent =
  | {
      readonly kind: 'placed';
      readonly tick: number;
      /** Étage posé (1 pour le premier bloc mobile). */
      readonly floor: number;
      readonly placed: Block;
      readonly cut: Block | null;
      readonly perfect: boolean;
      readonly perfectStreak: number;
    }
  | {
      readonly kind: 'missed';
      readonly tick: number;
      readonly floor: number;
      /** Bloc mobile entier qui tombe. */
      readonly moving: Block;
    };

export type RunStatus = 'running' | 'ended';

/**
 * Vitesse du bloc mobile d'un étage, en milli par tick (entier).
 * base = min(90 + 3·(étage − 1), 210) unités/s, puis × (0.9 + 0.2·tirage/2^32),
 * puis conversion en milli/tick arrondie une seule fois (Math.round, demi vers +∞).
 * Le plafond s'applique AVANT la modulation : la vitesse effective reste < 231.
 */
export function floorSpeed(floor: number, draw: number): number {
  const base = Math.min(BASE_SPEED + SPEED_STEP * (floor - 1), SPEED_CAP);
  const factor = SPEED_JITTER_MIN + SPEED_JITTER_SPAN * (draw / UINT32_RANGE);
  return Math.round((base * factor * MILLI) / TICK_RATE);
}

/**
 * Simulation pure, sans DOM, horloge, stockage ni réseau.
 *
 * Ordre d'un tick (voir README.md du dossier) :
 *   tick += 1 → déplacement du bloc mobile → si appui : pose → si posé, nouvel étage.
 * Le nouvel étage apparaît à sa position de départ et ne bouge qu'au tick suivant.
 * Tick 0 = état initial ; le premier appui valide est au tick 1.
 */
export class Simulation {
  readonly seed: number;
  readonly rulesVersion = RULES_VERSION;

  private readonly rng: Xorshift32;
  private _tick = 0;
  private _status: RunStatus = 'running';
  private _floor = 1;
  private _base: Block = { left: START_LEFT, width: START_WIDTH };
  private _movingLeft = 0;
  private _dir: 1 | -1 = 1;
  private _speed = 0;
  private _perfectCount = 0;
  private _perfectStreak = 0;
  private _bestStreak = 0;
  private readonly _inputTicks: number[] = [];
  private readonly _stack: Block[] = [];

  constructor(config: RunConfig) {
    if (config.rulesVersion !== RULES_VERSION) {
      throw new RangeError(`rulesVersion non supportée : ${String(config.rulesVersion)}`);
    }
    if (!isValidSeed(config.seed)) {
      throw new RangeError(`seed invalide : ${String(config.seed)}`);
    }
    this.seed = config.seed;
    this.rng = new Xorshift32(config.seed);
    this._stack.push(this._base);
    this.spawn();
  }

  get tick(): number { return this._tick; }
  get status(): RunStatus { return this._status; }
  /** Étages posés = score. */
  get score(): number { return this._floor - 1; }
  /** Étage du bloc mobile courant. */
  get floor(): number { return this._floor; }
  get base(): Block { return this._base; }
  get moving(): Block { return { left: this._movingLeft, width: this._base.width }; }
  get direction(): 1 | -1 { return this._dir; }
  /** Vitesse courante, milli/tick. */
  get speed(): number { return this._speed; }
  get perfectCount(): number { return this._perfectCount; }
  get perfectStreak(): number { return this._perfectStreak; }
  get bestPerfectStreak(): number { return this._bestStreak; }
  /** Bloc de départ puis chaque base posée, du bas vers le haut. */
  get stack(): readonly Block[] { return this._stack; }
  get inputTicks(): readonly number[] { return this._inputTicks; }

  /**
   * Avance d'exactement un tick. `press` = au moins un appui attribué à ce tick ;
   * plusieurs appuis au même tick n'en font qu'un. Sans effet après la fin.
   */
  step(press: boolean): StepEvent | null {
    if (this._status === 'ended') return null;
    this._tick += 1;
    const moved = advance(this._movingLeft, this._dir, this._speed, this._base.width);
    this._movingLeft = moved.left;
    this._dir = moved.dir;
    if (!press) return null;
    return this.place();
  }

  /** Résultat final ; null tant que la partie n'est pas terminée. */
  result(): RunResult | null {
    if (this._status !== 'ended') return null;
    return {
      seed: this.seed,
      rulesVersion: this.rulesVersion,
      score: this.score,
      perfectCount: this._perfectCount,
      durationTicks: this._tick,
      inputTicks: [...this._inputTicks],
    };
  }

  private place(): StepEvent {
    const tick = this._tick;
    const floor = this._floor;
    const moving = this.moving;
    this._inputTicks.push(tick);
    const outcome = resolvePlacement(this._base, moving);
    if (outcome.kind === 'missed') {
      this._status = 'ended';
      this._perfectStreak = 0;
      return { kind: 'missed', tick, floor, moving };
    }
    if (outcome.perfect) {
      this._perfectCount += 1;
      this._perfectStreak += 1;
      if (this._perfectStreak > this._bestStreak) this._bestStreak = this._perfectStreak;
    } else {
      this._perfectStreak = 0;
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
    };
  }

  /** Étage impair : bord gauche, vers la droite. Étage pair : bord droit, vers la gauche. */
  private spawn(): void {
    const draw = this.rng.next();
    this._speed = floorSpeed(this._floor, draw);
    if (this._floor % 2 === 1) {
      this._movingLeft = 0;
      this._dir = 1;
    } else {
      this._movingLeft = FIELD_WIDTH - this._base.width;
      this._dir = -1;
    }
  }
}
