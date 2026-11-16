import { FIELD_WIDTH, MILLI, START_WIDTH, type Block, type StepEvent } from '../core';

/** Hauteur d'un étage, unités logiques. */
export const BLOCK_HEIGHT = 22;
/** Bornes des effets : jamais plus d'objets que ça, quelle que soit la série. */
export const MAX_DEBRIS = 16;
export const MAX_SPARKS = 48;

const FIELD_U = FIELD_WIDTH / MILLI;
/** Hauteur logique minimale visible : garde des blocs lisibles sur écran large. */
const MIN_VIEW_HEIGHT = 560;
const GRAVITY = 1400; // u/s²

export interface ViewState {
  readonly stack: readonly Block[];
  /** Bloc mobile déjà interpolé (milli), ou null après la fin. */
  readonly moving: Block | null;
  readonly score: number;
  readonly perfectStreak: number;
  readonly pause: 'none' | 'shell' | 'hidden';
}

interface Debris { x: number; y: number; w: number; vx: number; vy: number; rot: number; vr: number; age: number; hue: number }
interface Spark { x: number; y: number; vx: number; vy: number; age: number; life: number }

function hueFor(floor: number): number {
  return (205 + floor * 11) % 360;
}

/**
 * Rendu Canvas 2D. Ne lit que des états de la simulation ou ses événements :
 * aucun effet visuel ne modifie les règles.
 */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private cssW = 1;
  private cssH = 1;
  private dpr = 1;
  private camera = 0;
  private trauma = 0;
  private flash = 0;
  private flashFloor = 0;
  private streakLabel = 0;
  private streakValue = 0;
  private landing = 0;
  private landingFloor = -1;
  private lastNow: number | null = null;
  private readonly debris: Debris[] = [];
  private readonly sparks: Spark[] = [];
  private seed = 0x9e3779b9;

  constructor(private readonly canvas: HTMLCanvasElement, public reducedMotion: boolean) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
  }

  get debrisCount(): number { return this.debris.length; }
  get sparkCount(): number { return this.sparks.length; }
  get backingSize(): { width: number; height: number; dpr: number } {
    return { width: this.canvas.width, height: this.canvas.height, dpr: this.dpr };
  }

  /** Ajuste la résolution interne à la taille CSS × devicePixelRatio. Renvoie true si changé. */
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): boolean {
    const dpr = Math.min(Math.max(devicePixelRatio || 1, 1), 3);
    const w = Math.max(1, Math.round(cssWidth * dpr));
    const h = Math.max(1, Math.round(cssHeight * dpr));
    this.cssW = Math.max(1, cssWidth);
    this.cssH = Math.max(1, cssHeight);
    this.dpr = dpr;
    if (this.canvas.width === w && this.canvas.height === h) return false;
    this.canvas.width = w;
    this.canvas.height = h;
    return true;
  }

  /** Événement de simulation → effets visuels bornés. */
  onEvent(event: StepEvent): void {
    if (event.kind === 'placed') {
      this.landing = 1;
      this.landingFloor = event.floor;
      if (event.cut) this.addDebris(event.cut, event.floor, event.placed.left > event.cut.left ? -1 : 1);
      if (event.perfect) {
        this.flash = 1;
        this.flashFloor = event.floor;
        this.streakValue = event.perfectStreak;
        this.streakLabel = event.perfectStreak >= 2 ? 1 : 0;
        if (!this.reducedMotion) this.addSparks(event.placed, event.floor, 8 + Math.min(event.perfectStreak * 2, 16));
      }
    } else {
      this.addDebris(event.moving, event.floor, 0);
      if (!this.reducedMotion) this.trauma = Math.min(1, this.trauma + 0.65);
    }
  }

  draw(view: ViewState, now: number): void {
    const dt = this.lastNow === null ? 0 : Math.min((now - this.lastNow) / 1000, 0.1);
    this.lastNow = now;
    this.update(dt, view);

    const { ctx, dpr } = this;
    const scale = Math.min(this.cssW / FIELD_U, this.cssH / MIN_VIEW_HEIGHT);
    const viewH = this.cssH / scale;
    const offsetX = (this.cssW - FIELD_U * scale) / 2;
    let shakeX = 0;
    let shakeY = 0;
    if (this.trauma > 0 && !this.reducedMotion) {
      const s = this.trauma * this.trauma * 10;
      shakeX = s * Math.sin(now * 0.047);
      shakeY = s * Math.sin(now * 0.061);
    }
    const topFloor = view.stack.length;

    // Fond : dégradé qui glisse avec la hauteur.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const hue = hueFor(Math.floor(this.camera / BLOCK_HEIGHT));
    const g = ctx.createLinearGradient(0, 0, 0, this.cssH);
    g.addColorStop(0, `hsl(${(hue + 40) % 360} 45% 16%)`);
    g.addColorStop(1, `hsl(${hue} 50% 8%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    // Monde : x en unités, y vers le haut depuis le sol.
    const groundY = this.cssH - 0.12 * this.cssH;
    const toScreenY = (yUnits: number) => groundY - (yUnits - this.camera) * scale + shakeY;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (offsetX + shakeX), 0);
    const yScreen = (y: number) => toScreenY(y) / scale;

    // Liseré du terrain.
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, 0, FIELD_U, this.cssH / scale);

    // Étages visibles : y monde entre le bas et le haut de l'écran (+1 de marge).
    const bottomY = this.camera - (this.cssH - groundY) / scale;
    const topY = bottomY + viewH;
    const firstVisible = Math.max(0, Math.floor(bottomY / BLOCK_HEIGHT) - 1);
    const lastVisible = Math.ceil(topY / BLOCK_HEIGHT) + 1;
    for (let i = firstVisible; i < Math.min(view.stack.length, lastVisible); i++) {
      const b = view.stack[i]!;
      let lift = 0;
      if (i === this.landingFloor && this.landing > 0 && !this.reducedMotion) lift = this.landing * this.landing * 4;
      this.block(b.left / MILLI, yScreen((i + 1) * BLOCK_HEIGHT + lift), b.width / MILLI, hueFor(i), 1);
    }

    // Halo du parfait.
    if (this.flash > 0 && this.flashFloor < view.stack.length) {
      const b = view.stack[this.flashFloor]!;
      const grow = this.reducedMotion ? 0 : (1 - this.flash) * 10;
      ctx.strokeStyle = `rgba(255,255,255,${(this.flash * 0.9).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.left / MILLI - grow, yScreen((this.flashFloor + 1) * BLOCK_HEIGHT) - grow, b.width / MILLI + grow * 2, BLOCK_HEIGHT + grow * 2);
    }

    if (view.moving) {
      this.block(view.moving.left / MILLI, yScreen((topFloor + 1) * BLOCK_HEIGHT), view.moving.width / MILLI, hueFor(topFloor), 1);
    }

    for (const d of this.debris) {
      const alpha = this.reducedMotion ? Math.max(0, 1 - d.age / 0.45) : Math.max(0, 1 - d.age / 1.6);
      ctx.save();
      ctx.translate(d.x + d.w / 2, yScreen(d.y) + BLOCK_HEIGHT / 2);
      ctx.rotate(d.rot);
      this.block(-d.w / 2, -BLOCK_HEIGHT / 2, d.w, d.hue, alpha);
      ctx.restore();
    }

    ctx.fillStyle = '#fff';
    for (const s of this.sparks) {
      ctx.globalAlpha = Math.max(0, 1 - s.age / s.life);
      ctx.fillRect(s.x - 1.5, yScreen(s.y) - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;

    // HUD canvas : score et série. Les menus restent en DOM (A1).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    const big = Math.round(Math.min(64, this.cssW * 0.16));
    ctx.font = `700 ${big}px system-ui, sans-serif`;
    ctx.fillText(String(view.score), this.cssW / 2, this.cssH * 0.06);
    if (this.streakLabel > 0) {
      ctx.globalAlpha = Math.min(1, this.streakLabel * 1.5);
      ctx.font = `700 ${Math.round(big * 0.34)}px system-ui, sans-serif`;
      ctx.fillStyle = `hsl(${hueFor(topFloor)} 90% 80%)`;
      ctx.fillText(`PARFAIT ×${this.streakValue}`, this.cssW / 2, this.cssH * 0.06 + big * 1.1);
      ctx.globalAlpha = 1;
    }
    if (view.pause !== 'none') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, this.cssW, this.cssH);
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.round(big * 0.4)}px system-ui, sans-serif`;
      ctx.fillText(view.pause === 'hidden' ? 'Touchez pour reprendre' : 'Pause', this.cssW / 2, this.cssH / 2);
    }
  }

  /** true si un effet est encore en cours (le rendu peut alors s'arrêter). */
  get animating(): boolean {
    return this.debris.length > 0 || this.sparks.length > 0 || this.flash > 0 || this.trauma > 0 ||
      this.streakLabel > 0 || this.landing > 0 || Math.abs(this.camera - this.cameraTarget) > 0.05;
  }

  private cameraTarget = 0;

  private update(dt: number, view: ViewState): void {
    const viewH = this.cssH / Math.min(this.cssW / FIELD_U, this.cssH / MIN_VIEW_HEIGHT);
    // Le bloc mobile reste vers 40 % de la hauteur depuis le haut.
    this.cameraTarget = Math.max(0, (view.stack.length + 1) * BLOCK_HEIGHT - viewH * 0.5);
    if (this.reducedMotion) this.camera = this.cameraTarget;
    else this.camera += (this.cameraTarget - this.camera) * (1 - Math.exp(-dt * 7));
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.flash = Math.max(0, this.flash - dt * 3.5);
    this.landing = Math.max(0, this.landing - dt * 12);
    this.streakLabel = Math.max(0, this.streakLabel - dt * 0.8);

    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]!;
      d.age += dt;
      if (!this.reducedMotion) {
        d.vy -= GRAVITY * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.rot += d.vr * dt;
      }
      if (d.age > (this.reducedMotion ? 0.45 : 1.6)) this.debris.splice(i, 1);
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]!;
      s.age += dt;
      s.vy -= GRAVITY * 0.5 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.age >= s.life) this.sparks.splice(i, 1);
    }
  }

  private block(x: number, y: number, w: number, hue: number, alpha: number): void {
    const { ctx } = this;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `hsl(${hue} 68% 56%)`;
    ctx.fillRect(x, y, w, BLOCK_HEIGHT);
    ctx.fillStyle = `hsl(${hue} 80% 72%)`;
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = `hsl(${hue} 60% 40%)`;
    ctx.fillRect(x, y + BLOCK_HEIGHT - 3, w, 3);
    ctx.globalAlpha = 1;
  }

  private addDebris(b: Block, floor: number, side: -1 | 0 | 1): void {
    if (this.debris.length >= MAX_DEBRIS) this.debris.shift();
    const w = b.width / MILLI;
    const push = side === 0 ? 0 : side * (40 + 60 * (w / (START_WIDTH / MILLI)));
    this.debris.push({
      x: b.left / MILLI, y: (floor + 1) * BLOCK_HEIGHT, w, vx: push, vy: 60,
      rot: 0, vr: side === 0 ? 0.6 : side * 2.2, age: 0, hue: hueFor(floor),
    });
  }

  private addSparks(b: Block, floor: number, count: number): void {
    const y = (floor + 1) * BLOCK_HEIGHT;
    for (let i = 0; i < count; i++) {
      if (this.sparks.length >= MAX_SPARKS) this.sparks.shift();
      const r1 = this.rand();
      const r2 = this.rand();
      const left = r1 < 0.5;
      this.sparks.push({
        x: left ? b.left / MILLI : (b.left + b.width) / MILLI,
        y: y - BLOCK_HEIGHT * r2,
        vx: (left ? -1 : 1) * (60 + 160 * this.rand()),
        vy: 80 + 200 * this.rand(),
        age: 0,
        life: 0.35 + 0.3 * r2,
      });
    }
  }

  /** Aléa purement visuel, séparé de la simulation. */
  private rand(): number {
    let x = this.seed;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    this.seed = x;
    return x / 4294967296;
  }
}
