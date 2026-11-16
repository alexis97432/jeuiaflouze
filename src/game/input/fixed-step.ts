import { TICK_RATE, type Simulation, type StepEvent } from '../core';

/** Durée d'un tick logique, ms. */
export const TICK_MS = 1000 / TICK_RATE;

/**
 * Retard maximal rattrapé en une image (250 ms). Au-delà (onglet gelé, gros
 * ralentissement), le temps perdu est abandonné : la partie ralentit au lieu de
 * sauter en avant et de faire rater le joueur sans qu'il ait rien vu.
 */
export const MAX_CATCHUP_TICKS = 30;

/**
 * Relie le temps réel (DOMHighResTimeStamp, même origine que performance.now,
 * requestAnimationFrame et Event.timeStamp) aux ticks de la simulation.
 *
 * Le tick k a lieu à `origin + k·TICK_MS`. Un appui horodaté `t` est attribué au
 * premier tick ≥ t (jamais à un tick déjà simulé). Ainsi, le résultat dépend de
 * l'instant de l'appui et non de la cadence d'affichage : 30, 60, 120 ou 144 Hz
 * donnent les mêmes inputTicks. Deux appuis attribués au même tick n'en font qu'un.
 *
 * Aucune dépendance DOM : `now` est fourni par l'appelant.
 */
export class FixedStepDriver {
  /** Instant réel de la dernière (re)prise ou du dernier recalage. */
  private anchor = 0;
  /** Tick de la simulation à l'instant `anchor`. */
  private baseTick = 0;
  private running = false;
  /** Ticks d'appuis en attente, strictement croissants. */
  private pending: number[] = [];

  constructor(
    private readonly sim: Simulation,
    private readonly onEvent: (event: StepEvent) => void = () => {},
  ) {}

  get isRunning(): boolean { return this.running; }
  get pendingPresses(): readonly number[] { return this.pending; }

  /**
   * Position logique (en ticks, fractionnaire) à l'instant `t`.
   * `(t − anchor) × 120 / 1000` est exact pour les instants entiers en ms et
   * monotone : `press` et `advance` utilisent la même fonction, donc un appui
   * délivré après une image ne peut pas tomber sur un tick déjà simulé par elle.
   */
  private ticksAt(t: number): number {
    return this.baseTick + ((t - this.anchor) * TICK_RATE) / 1000;
  }

  /** Démarre ou reprend : le tick courant est ancré à `now`, sans rattrapage. */
  resume(now: number): void {
    if (this.running || this.sim.status === 'ended') return;
    this.anchor = now;
    this.baseTick = this.sim.tick;
    this.running = true;
  }

  /** Gèle le temps logique et oublie les appuis non traités. */
  pause(): void {
    this.running = false;
    this.pending = [];
  }

  /**
   * Enregistre un appui. Renvoie le tick attribué, ou null si l'appui est ignoré
   * (pause, partie finie, doublon du même tick).
   */
  press(timeStamp: number): number | null {
    if (!this.running || this.sim.status === 'ended') return null;
    const tick = Math.max(this.sim.tick + 1, Math.ceil(this.ticksAt(timeStamp)));
    const last = this.pending[this.pending.length - 1];
    // Même tick (ou horodatage antérieur) que le dernier appui en attente : fusion.
    if (last !== undefined && tick <= last) return null;
    this.pending.push(tick);
    return tick;
  }

  /** Simule tous les ticks échus à `now`. Renvoie le nombre de ticks simulés. */
  advance(now: number): number {
    if (!this.running) return 0;
    let target = Math.floor(this.ticksAt(now));
    if (target - this.sim.tick > MAX_CATCHUP_TICKS) {
      // Temps perdu abandonné : on recale l'ancre sur `now`.
      target = this.sim.tick + MAX_CATCHUP_TICKS;
      this.anchor = now;
      this.baseTick = target;
    }
    let steps = 0;
    while (this.sim.tick < target && this.sim.status === 'running') {
      const next = this.sim.tick + 1;
      let press = false;
      while (this.pending.length > 0 && this.pending[0]! <= next) {
        this.pending.shift();
        press = true;
      }
      const event = this.sim.step(press);
      steps++;
      if (event) this.onEvent(event);
    }
    if (this.sim.status === 'ended') {
      this.running = false;
      this.pending = [];
    }
    return steps;
  }

  /** Fraction écoulée du tick suivant, dans [0, 1], pour interpoler l'affichage. */
  alpha(now: number): number {
    if (!this.running) return 0;
    const a = this.ticksAt(now) - this.sim.tick;
    return a < 0 ? 0 : a > 1 ? 1 : a;
  }
}
