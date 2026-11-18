/**
 * Fête foraine (Épique, V7) : l'entrée et ses guirlandes, l'allée des stands, la grande roue qui
 * tourne, les montagnes russes et leur wagon, le crépuscule forain, puis la nuit des feux
 * d'artifice (doux : éclosions lentes, jamais de flash). Découvertes : un ballon en forme de chat
 * qui s'échappe, un ticket d'or qui vole au vent.
 */
import { CREAM, INK, css, hex, lighten, mix, roundedRect, type Rgb } from '../color';
import {
  altitude, byStage, drifters, egg, fade, hash, layerY, orb, reveal, silhouette, starfield, sx, TAU,
  type Scene, type SceneEnv,
} from '../scene';
import type { Theme } from '../theme-types';
import { balloon, star, twinkle } from './kit';

const BLOCKS = ['#FF4F6D', '#16A58E', '#E7A100', '#4F7BFF', '#B04FE0', '#FF7F2A'].map(hex);
const BULBS: readonly Rgb[] = [[255, 220, 120], [255, 140, 170], [140, 220, 255], [190, 255, 150]];

function circusTent(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, a: Rgb, b: Rgb): void {
  const w = 34 * s;
  const h = 22 * s;
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = css(k % 2 === 0 ? a : b);
    ctx.beginPath();
    ctx.moveTo(x - w + (k * 2 * w) / 6, y);
    ctx.lineTo(x - w + ((k + 1) * 2 * w) / 6, y);
    ctx.lineTo(x, y - h - 12 * s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = css(a);
  ctx.fillRect(x - 0.8 * s, y - h - 20 * s, 1.6 * s, 9 * s);
  ctx.beginPath();
  ctx.moveTo(x, y - h - 20 * s);
  ctx.lineTo(x + 7 * s, y - h - 17 * s);
  ctx.lineTo(x, y - h - 14 * s);
  ctx.fill();
}

/** Grande roue : rayons, nacelles qui restent à l'horizontale, ampoules qui clignent doucement. */
function ferrisWheel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number, night: number, t: number, motion: boolean): void {
  ctx.strokeStyle = 'rgba(70,60,110,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.6, y + r * 1.25);
  ctx.lineTo(x, y);
  ctx.lineTo(x + r * 0.6, y + r * 1.25);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  const n = 10;
  for (let k = 0; k < n; k++) {
    const a = angle + (k / n) * TAU;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    ctx.strokeStyle = 'rgba(70,60,110,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.fillStyle = css(BLOCKS[k % BLOCKS.length]!);
    roundedRect(ctx, px - 5, py + 1, 10, 7, 2);
    ctx.fill();
    if (night > 0.02) {
      const on = motion ? 0.55 + 0.45 * Math.sin(t * 2 + k * 0.9) : 0.8;
      ctx.fillStyle = css(BULBS[k % BULBS.length]!, night * on);
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, TAU);
      ctx.fill();
    }
  }
}

/** Manège : toit rayé, chevaux de bois qui montent et descendent. */
function carousel(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, motion: boolean): void {
  ctx.fillStyle = '#FFE7B0';
  ctx.fillRect(x - 24 * s, y - 4 * s, 48 * s, 4 * s);
  for (let k = 0; k < 4; k++) {
    const px = x + (-18 + k * 12) * s;
    const bob = motion ? Math.sin(t * 2.4 + k * 1.6) * 3 * s : 0;
    ctx.fillStyle = 'rgba(200,170,90,0.9)';
    ctx.fillRect(px - 0.6 * s, y - 26 * s, 1.2 * s, 22 * s);
    ctx.fillStyle = css(lighten(BLOCKS[(k * 2) % BLOCKS.length]!, 0.2));
    ctx.beginPath();
    ctx.ellipse(px, y - 13 * s + bob, 5 * s, 2.6 * s, 0, 0, TAU);
    ctx.ellipse(px + 4.5 * s, y - 16 * s + bob, 1.8 * s, 2.6 * s, 0.4, 0, TAU);
    ctx.fill();
  }
  for (let k = 0; k < 8; k++) {
    ctx.fillStyle = k % 2 === 0 ? '#FF4F6D' : '#FFF4DB';
    ctx.beginPath();
    ctx.moveTo(x - 26 * s + k * 6.5 * s, y - 26 * s);
    ctx.lineTo(x - 26 * s + (k + 1) * 6.5 * s, y - 26 * s);
    ctx.lineTo(x, y - 38 * s);
    ctx.closePath();
    ctx.fill();
  }
}

/** Feu d'artifice doux : une éclosion qui grandit et s'éteint en 1,6 s, sans flash. */
function firework(ctx: CanvasRenderingContext2D, x: number, y: number, p: number, color: Rgb, alpha: number): void {
  const r = 8 + p * 34;
  const a = alpha * Math.max(0, 1 - p) * 0.75;
  if (a <= 0.01) return;
  ctx.fillStyle = css(color, a);
  for (let k = 0; k < 14; k++) {
    const ang = (k / 14) * TAU;
    ctx.beginPath();
    ctx.arc(x + Math.cos(ang) * r, y + Math.sin(ang) * r + p * p * 10, 1.6, 0, TAU);
    ctx.fill();
  }
}

function catBalloon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.strokeStyle = 'rgba(80,60,80,0.6)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x, y + 10 * s);
  ctx.lineTo(x, y + 26 * s);
  ctx.stroke();
  ctx.fillStyle = '#B04FE0';
  ctx.beginPath();
  ctx.arc(x, y, 9 * s, 0, TAU);
  ctx.moveTo(x - 8 * s, y - 4 * s);
  ctx.lineTo(x - 7 * s, y - 13 * s);
  ctx.lineTo(x - 2 * s, y - 8 * s);
  ctx.moveTo(x + 8 * s, y - 4 * s);
  ctx.lineTo(x + 7 * s, y - 13 * s);
  ctx.lineTo(x + 2 * s, y - 8 * s);
  ctx.fill();
  ctx.fillStyle = '#FFF4DB';
  ctx.fillRect(x - 4 * s, y - 2 * s, 2 * s, 2 * s);
  ctx.fillRect(x + 2 * s, y - 2 * s, 2 * s, 2 * s);
}

const scene: Scene = {
  far(env: SceneEnv) {
    const { ctx, w, h } = env;
    const night = fade(env, 42, 52);
    const dusk = fade(env, 27, 38) * (1 - night);
    orb(ctx, w * 0.2, h * (0.16 + dusk * 0.28), 20 + dusk * 14, mix([255, 250, 230], [255, 150, 120], dusk), 1, 1 - night);
    if (night > 0) {
      starfield(env, 60, night * 0.8, 71);
      // Feux d'artifice : au plus deux éclosions à la fois, une toutes les 1,3 s environ.
      const period = 1.6;
      const n = env.motion ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const cycle = env.motion ? Math.floor((env.t + k * 0.55) / period) : k;
        const p = env.motion ? ((env.t + k * 0.55) % period) / period : 0.35;
        const x = w * (0.15 + hash(cycle, k * 7 + 1) * 0.7);
        const y = h * (0.12 + hash(cycle, k * 7 + 2) * 0.22);
        firework(ctx, x, y, p, BULBS[(cycle + k) % BULBS.length]!, night);
      }
    }
  },
  back(env: SceneEnv) {
    const { ctx } = env;
    const night = fade(env, 42, 52);
    // Ville au loin, puis la fête.
    const town = byStage(env, [[230, 210, 236], [226, 204, 234], [212, 196, 240], [196, 182, 240], [150, 110, 180], [44, 30, 76]]);
    silhouette(env, 0.1, 0, (x) => 40 + (Math.floor((x + 400) / 26) % 3) * 12 + Math.floor(hash(Math.floor((x + 400) / 26), 2) * 18), css(town, 0.85), 6);
    // Grande roue (parallaxe faible, elle domine la fête).
    const wy = layerY(env, 92, 0.18);
    if (wy < env.h + 120) {
      const angle = env.motion ? env.t * 0.12 : 0.3;
      ferrisWheel(ctx, sx(env, 110), wy, 58 * env.scale, angle, Math.max(night, fade(env, 34, 44) * 0.7), env.t, env.motion);
    }
    // Chapiteaux et manège.
    const groundTone = byStage(env, [[255, 222, 200], [255, 214, 196], [244, 206, 214], [228, 196, 228], [190, 130, 170], [60, 40, 90]]);
    silhouette(env, 0.3, 0, () => 12, css(groundTone));
    const s = env.scale * 0.85;
    const baseY = layerY(env, 12, 0.3);
    if (baseY < env.h + 60) {
      circusTent(ctx, sx(env, -130), baseY, s, [255, 79, 109], [255, 244, 219]);
      circusTent(ctx, sx(env, 175), baseY, s * 0.8, [79, 123, 255], [255, 244, 219]);
      carousel(ctx, sx(env, -45), baseY, s, env.t, env.motion);
      // Guirlande d'ampoules entre les chapiteaux.
      ctx.strokeStyle = 'rgba(70,60,110,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const x0 = sx(env, -130);
      const x1 = sx(env, 175);
      const y0 = baseY - 34 * s;
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2, y0 + 22 * s, x1, y0);
      ctx.stroke();
      for (let k = 1; k < 12; k++) {
        const p = k / 12;
        const bx = x0 + (x1 - x0) * p;
        const by = y0 + 22 * s * 2 * p * (1 - p) * 2 * 0.5;
        const on = env.motion ? 0.6 + 0.4 * Math.sin(env.t * 1.5 + k) : 0.85;
        ctx.fillStyle = css(BULBS[k % BULBS.length]!, (0.45 + 0.55 * night) * on);
        ctx.beginPath();
        ctx.arc(bx, by, 2.2, 0, TAU);
        ctx.fill();
      }
    }
    // Montagnes russes : la voie et un wagon qui la parcourt (vers 16 étages).
    const ry = layerY(env, altitude(env, 16, 0.4), 0.4);
    const track = reveal(env, 16);
    if (track > 0 && ry > -80 && ry < env.h + 80) {
      const curve = (u: number) => ry + Math.sin(u * TAU * 1.5) * 26 - u * 20;
      ctx.globalAlpha = track;
      ctx.strokeStyle = 'rgba(200,60,90,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let k = 0; k <= 40; k++) {
        const u = k / 40;
        const X = -20 + u * (env.w + 40);
        if (k === 0) ctx.moveTo(X, curve(u));
        else ctx.lineTo(X, curve(u));
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(200,60,90,0.35)';
      ctx.lineWidth = 1;
      for (let k = 1; k < 10; k++) {
        const u = k / 10;
        const X = -20 + u * (env.w + 40);
        ctx.beginPath();
        ctx.moveTo(X, curve(u));
        ctx.lineTo(X, curve(u) + 60);
        ctx.stroke();
      }
      const u = env.motion ? (env.t % 7) / 7 : 0.3;
      const X = -20 + u * (env.w + 40);
      ctx.fillStyle = '#FFD15C';
      roundedRect(ctx, X - 9, curve(u) - 9, 18, 8, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Ballons qui montent, dont parfois un ballon-chat (vers 26 étages).
    const by = layerY(env, altitude(env, 26, 0.5), 0.5);
    if (reveal(env, 26) > 0 && by > -80 && by < env.h + 80) {
      for (let k = 0; k < 3; k++) {
        ctx.save();
        ctx.translate(sx(env, -120 + k * 95), by + hash(k, 41) * 40 + (env.motion ? Math.sin(env.t + k) * 6 : 0));
        balloon(ctx, BLOCKS[(k * 2 + 1) % BLOCKS.length]!, env.motion ? Math.sin(env.t * 0.8 + k) * 3 : 0, 0.8 * reveal(env, 26));
        ctx.restore();
      }
      if (egg(env, 5, 0.45)) catBalloon(ctx, sx(env, 30), by - 30 * env.scale, env.scale);
    }
  },
  near(env: SceneEnv) {
    const party = fade(env, 4, 8) * (1 - fade(env, 36, 44));
    if (party > 0.02) {
      drifters(env, 24, 97, (ctx, x, y, i, phase) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(phase * 6 + (env.motion ? env.t * (1.5 + phase) : 0));
        ctx.fillStyle = css(BLOCKS[i % BLOCKS.length]!, 0.75 * party);
        ctx.fillRect(-3, -1.5, 6, 3);
        ctx.restore();
      }, { x: 10, y: 30 });
    }
    // Ticket d'or qui vole au vent (découverte).
    if (egg(env, 6, 0.3) && env.motion && fade(env, 10, 14) > 0.5) {
      const p = (env.t % 14) / 14;
      const { ctx } = env;
      ctx.save();
      ctx.translate(-30 + p * (env.w + 60), env.h * (0.35 + Math.sin(p * TAU * 2) * 0.08));
      ctx.rotate(Math.sin(env.t * 3) * 0.6);
      ctx.fillStyle = '#F2C14E';
      roundedRect(ctx, -9, -5, 18, 10, 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(120,80,20,0.7)';
      ctx.fillRect(-5, -1, 10, 2);
      ctx.restore();
    }
  },
  ground(env: SceneEnv, top: number) {
    const { ctx, w, h } = env;
    if (top >= h) return;
    const night = fade(env, 44, 52);
    // Allée en damier rouge et crème.
    const a = mix([214, 72, 92], [90, 40, 80], night);
    const b = mix([255, 240, 214], [120, 100, 140], night);
    const size = 14;
    for (let y = top, row = 0; y < h; y += size, row++) {
      for (let x = 0, col = 0; x < w; x += size, col++) {
        ctx.fillStyle = css((row + col) % 2 === 0 ? a : b);
        ctx.fillRect(x, y, size, size);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, top, w, 3);
  },
};

export const foire: Theme = {
  id: 'foire',
  name: 'Fête foraine',
  rarity: 'epique',
  blocks: BLOCKS,
  sparks: ['#FFD15C', '#FF4F6D', '#4F7BFF', '#16A58E'].map(hex),
  ground: { top: hex('#FFF0D6'), body: hex('#D6485C') },
  audio: { wave: 'square', root: 587.33, scale: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 19] },
  scene,
  tiers: [
    {
      name: 'Entrée de la fête', skyTop: hex('#F39BC6'), skyBottom: hex('#FFF6E0'), ink: INK,
      decor: (ctx, it, t, motion) => balloon(ctx, BLOCKS[Math.floor(it.r1 * BLOCKS.length)]!, motion ? Math.sin(t * 0.9 + it.r2 * 6) * 3 : 0, 0.6),
    },
    {
      name: 'Allée des stands', skyTop: hex('#FFD2E6'), skyBottom: hex('#FFEFD0'), ink: INK,
      decor: (ctx, it, t, motion) => {
        // Barbe à papa sur son bâton.
        ctx.rotate(motion ? Math.sin(t + it.r1 * 6) * 0.2 : 0);
        ctx.fillStyle = 'rgba(255,170,210,0.8)';
        ctx.beginPath();
        ctx.arc(0, -4, 6, 0, TAU);
        ctx.arc(-4, -1, 4, 0, TAU);
        ctx.arc(4, -1, 4, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,250,240,0.9)';
        ctx.fillRect(-0.6, 2, 1.2, 9);
      },
    },
    {
      name: 'Grande roue', skyTop: hex('#D2C2FF'), skyBottom: hex('#FFE2EE'), ink: INK,
      decor: (ctx, it, t, motion) => star(ctx, 3 + it.r2 * 3, [255, 255, 255], twinkle(it, t, motion, 0.6)),
    },
    {
      name: 'Montagnes russes', skyTop: hex('#B4A0FF'), skyBottom: hex('#FFD0E0'), ink: INK,
      decor: (ctx, it, t, motion) => balloon(ctx, BLOCKS[Math.floor(it.r2 * BLOCKS.length)]!, motion ? Math.sin(t + it.r3 * 6) * 3 : 0, 0.65),
    },
    {
      name: 'Crépuscule forain', skyTop: hex('#6E44BE'), skyBottom: hex('#FF9FB0'), ink: CREAM,
      decor: (ctx, it, t, motion) => star(ctx, 3 + it.r2 * 4, [255, 230, 240], twinkle(it, t, motion, 0.7)),
    },
    {
      name: 'Feux d’artifice', skyTop: hex('#120E30'), skyBottom: hex('#3A1F5C'), ink: CREAM,
      decor: (ctx, it, t, motion) => star(ctx, 4 + it.r2 * 5, CREAM, twinkle(it, t, motion, 0.85)),
    },
  ],
};
