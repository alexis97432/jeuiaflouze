/**
 * Montagne (Rare, V7) : un village de chalets au col, les alpages, la forêt de sapins, le glacier,
 * la lumière rose du soir sur les sommets (alpenglow), puis la nuit d'altitude et sa comète.
 * Plans : sommets enneigés au loin, forêt, téléphérique qui monte, aigle, parapente.
 * Découvertes : un yéti qui salue derrière un sapin, un chien du Saint-Bernard et son tonnelet.
 */
import { CREAM, INK, css, hex, mix, type Rgb } from '../color';
import {
  altitude, byStage, drifters, egg, fade, hash, layerY, orb, reveal, ridge, silhouette, starfield, sx, TAU,
  type Scene, type SceneEnv,
} from '../scene';
import type { Theme } from '../theme-types';
import { bird, star, twinkle } from './kit';

const BLOCKS = ['#C8423B', '#2E8B57', '#3667B5', '#E39A1F', '#7A4FB0', '#1C9AA8'].map(hex);

function pine(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: Rgb, snow: number): void {
  ctx.fillStyle = css(color);
  for (let k = 0; k < 3; k++) {
    const w = (12 - k * 3) * s;
    const top = y - (10 + k * 8) * s;
    ctx.beginPath();
    ctx.moveTo(x - w, top + 10 * s);
    ctx.lineTo(x, top - 4 * s);
    ctx.lineTo(x + w, top + 10 * s);
    ctx.closePath();
    ctx.fill();
  }
  if (snow > 0.02) {
    ctx.fillStyle = `rgba(255,255,255,${(0.85 * snow).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(x - 3 * s, y - 28 * s);
    ctx.lineTo(x, y - 32 * s);
    ctx.lineTo(x + 3 * s, y - 28 * s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#5A3A22';
  ctx.fillRect(x - 1.2 * s, y - 4 * s, 2.4 * s, 4 * s);
}

function chalet(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lit: number): void {
  ctx.fillStyle = '#8C5A34';
  ctx.fillRect(x - 11 * s, y - 13 * s, 22 * s, 13 * s);
  ctx.fillStyle = '#5B3A22';
  ctx.beginPath();
  ctx.moveTo(x - 15 * s, y - 12 * s);
  ctx.lineTo(x, y - 24 * s);
  ctx.lineTo(x + 15 * s, y - 12 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(x - 15 * s, y - 13.5 * s, 30 * s, 2 * s);
  ctx.fillStyle = lit > 0 ? `rgba(255,205,110,${(0.5 + lit * 0.5).toFixed(3)})` : '#3B2A1E';
  ctx.fillRect(x - 7 * s, y - 9 * s, 4 * s, 4 * s);
  ctx.fillRect(x + 3 * s, y - 9 * s, 4 * s, 4 * s);
}

function yeti(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, wave: number): void {
  ctx.fillStyle = '#F4F7FB';
  ctx.beginPath();
  ctx.ellipse(x, y - 9 * s, 6 * s, 9 * s, 0, 0, TAU);
  ctx.arc(x, y - 19 * s, 4.5 * s, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(x + 5 * s, y - 13 * s);
  ctx.rotate(-1.2 + wave);
  ctx.beginPath();
  ctx.ellipse(0, -4 * s, 1.8 * s, 4.5 * s, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#7FA6D6';
  ctx.fillRect(x - 2.5 * s, y - 21 * s, 5 * s, 3 * s);
  ctx.fillStyle = '#1D2440';
  ctx.fillRect(x - 1.8 * s, y - 20.5 * s, 1 * s, 1 * s);
  ctx.fillRect(x + 0.8 * s, y - 20.5 * s, 1 * s, 1 * s);
}

function stBernard(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, tail: number): void {
  ctx.fillStyle = '#B8743F';
  ctx.beginPath();
  ctx.ellipse(x, y - 6 * s, 7 * s, 4 * s, 0, 0, TAU);
  ctx.arc(x + 7 * s, y - 9 * s, 3.2 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + 6 * s, y - 8 * s, 3 * s, 3 * s);
  ctx.fillStyle = '#B8743F';
  for (const dx of [-5, -2, 2, 5]) ctx.fillRect(x + dx * s, y - 3 * s, 1.4 * s, 3 * s);
  ctx.save();
  ctx.translate(x - 7 * s, y - 7 * s);
  ctx.rotate(-0.6 + tail);
  ctx.fillRect(-4 * s, -0.7 * s, 4 * s, 1.4 * s);
  ctx.restore();
  // Le tonnelet.
  ctx.fillStyle = '#7A4A26';
  ctx.fillRect(x + 4 * s, y - 5.5 * s, 3 * s, 2.4 * s);
}

const scene: Scene = {
  far(env: SceneEnv) {
    const { ctx, w, h } = env;
    const night = fade(env, 42, 52);
    const glow = fade(env, 28, 36) * (1 - night);
    orb(ctx, w * 0.8, h * (0.14 + glow * 0.24), 20 + glow * 10, mix([255, 252, 240], [255, 170, 150], glow), 1, 1 - night);
    if (night > 0) {
      starfield(env, 100, night, 23);
      orb(ctx, w * 0.2, h * 0.12, 13, [236, 240, 255], 0.7, night);
      // Comète : longue traîne bleutée, immobile dans le ciel (elle avance de nuit en nuit).
      const cx = w * 0.62;
      const cy = h * 0.1;
      const g = ctx.createLinearGradient(cx, cy, cx - 90, cy + 34);
      g.addColorStop(0, `rgba(220,240,255,${(0.75 * night).toFixed(3)})`);
      g.addColorStop(1, 'rgba(160,200,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - 90, cy + 34);
      ctx.stroke();
      orb(ctx, cx, cy, 2.4, [240, 248, 255], 1.4, night);
    }
  },
  back(env: SceneEnv) {
    const { ctx } = env;
    // Crête lointaine bleutée (profondeur), puis grands sommets : roche et calottes de neige.
    const haze = byStage(env, [[186, 206, 230], [178, 200, 228], [168, 192, 226], [160, 184, 222], [210, 150, 170], [50, 64, 104]]);
    silhouette(env, 0.05, 0, (x) => 120 + 40 * Math.abs(ridge(x, 29, 0.006)), css(haze, 0.8));
    const rock = byStage(env, [[150, 168, 196], [140, 160, 192], [130, 150, 186], [120, 140, 180], [176, 110, 140], [40, 52, 90]]);
    const peaks = (x: number) => 92 + 62 * Math.abs(ridge(x, 13, 0.008)) + 26 * Math.abs(Math.sin(x * 0.017));
    silhouette(env, 0.08, 0, peaks, css(rock));
    const snowTone = byStage(env, [[250, 252, 255], [248, 250, 255], [244, 248, 255], [240, 246, 255], [255, 210, 220], [150, 170, 220]]);
    {
      // Calotte : épouse la crête au-dessus de la limite des neiges, bord inférieur dentelé.
      const snowLine = 128;
      const w = env.w;
      ctx.fillStyle = css(snowTone, 0.95);
      let seg: [number, number, number][] = [];
      const flush = () => {
        if (seg.length > 1) {
          ctx.beginPath();
          ctx.moveTo(seg[0]![0], seg[0]![1]);
          for (const [px, yt] of seg) ctx.lineTo(px, yt);
          for (let i = seg.length - 1; i >= 0; i--) ctx.lineTo(seg[i]![0], seg[i]![2]);
          ctx.closePath();
          ctx.fill();
        }
        seg = [];
      };
      for (let px = 0; px <= w + 6; px += 6) {
        const X = (px - w / 2) / env.scale;
        const top = peaks(X);
        if (top > snowLine) {
          const depth = (top - snowLine) * 0.6 + 3 * Math.sin(X * 0.35);
          seg.push([px, layerY(env, top, 0.08), layerY(env, top - Math.max(1, depth), 0.08)]);
        } else flush();
      }
      flush();
    }
    // Forêt de sapins et chalets du col.
    const forest = byStage(env, [[54, 120, 84], [50, 114, 80], [44, 104, 76], [40, 96, 80], [70, 70, 90], [20, 34, 60]]);
    const slope = (x: number) => 30 + 16 * ridge(x, 17, 0.018);
    silhouette(env, 0.28, 0, slope, css(mix(forest, [200, 220, 200], 0.35)));
    const s = env.scale * 0.85;
    const snow = fade(env, 18, 26);
    const lit = fade(env, 34, 46);
    for (let k = 0; k < 14; k++) {
      const x = -190 + k * 29 + hash(k, 3) * 10;
      const X = sx(env, x);
      const Y = layerY(env, slope(x) - 1, 0.28);
      if (Y > env.h + 40) continue;
      if (k === 4 || k === 10) chalet(ctx, X, Y, s, lit);
      else pine(ctx, X, Y, s * (0.8 + hash(k, 5) * 0.4), forest, snow);
      if (k === 7 && egg(env, 3, 0.25)) yeti(ctx, X + 8 * s, Y, s * 0.8, env.motion ? Math.sin(env.t * 4) * 0.5 : 0.2);
      if (k === 4 && egg(env, 4, 0.35)) stBernard(ctx, X + 18 * s, Y, s * 0.8, env.motion ? Math.sin(env.t * 8) * 0.4 : 0);
    }
    // Téléphérique : un câble en diagonale et une cabine qui monte (vers 14 étages).
    const cableSeen = reveal(env, 14);
    if (cableSeen > 0) {
      const y0 = layerY(env, altitude(env, 8, 0.4), 0.4);
      const y1 = layerY(env, altitude(env, 22, 0.4), 0.4);
      ctx.globalAlpha = cableSeen;
      ctx.strokeStyle = 'rgba(40,40,60,0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-10, y0);
      ctx.lineTo(env.w + 10, y1);
      ctx.stroke();
      const p = env.motion ? (env.t % 20) / 20 : 0.45;
      const cx = -10 + p * (env.w + 20);
      const cy = y0 + p * (y1 - y0);
      ctx.strokeStyle = 'rgba(40,40,60,0.8)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy + 8);
      ctx.stroke();
      ctx.fillStyle = '#D23B3B';
      ctx.fillRect(cx - 8, cy + 8, 16, 11);
      ctx.fillStyle = 'rgba(220,240,255,0.9)';
      ctx.fillRect(cx - 6, cy + 10, 5, 4);
      ctx.fillRect(cx + 1, cy + 10, 5, 4);
      ctx.globalAlpha = 1;
    }
    // Aigle qui plane en cercles (vers 24 étages).
    const ey = layerY(env, altitude(env, 24, 0.45), 0.45);
    if (reveal(env, 24) > 0 && ey > -40 && ey < env.h + 40) {
      const a = env.motion ? env.t * 0.4 : 1;
      ctx.save();
      ctx.translate(sx(env, Math.cos(a) * 90), ey + Math.sin(a) * 18);
      bird(ctx, 16, env.motion ? Math.sin(env.t * 2) * 0.3 : 0.2, [70, 50, 40], reveal(env, 24));
      ctx.restore();
    }
    // Parapente (vers 32 étages).
    const gy = layerY(env, altitude(env, 32, 0.5), 0.5);
    const glide = reveal(env, 32);
    if (glide > 0 && gy > -60 && gy < env.h + 40) {
      const gx = env.motion ? sx(env, -150 + ((env.t * 9) % 300)) : sx(env, 60);
      ctx.globalAlpha = glide;
      ctx.fillStyle = '#FF7A3D';
      ctx.beginPath();
      ctx.ellipse(gx, gy, 20, 6, 0, Math.PI, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,40,60,0.6)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(gx - 18, gy);
      ctx.lineTo(gx, gy + 18);
      ctx.lineTo(gx + 18, gy);
      ctx.stroke();
      ctx.fillStyle = '#2D3A66';
      ctx.fillRect(gx - 2, gy + 17, 4, 5);
      ctx.globalAlpha = 1;
    }
  },
  near(env: SceneEnv) {
    // Flocons : à partir de la forêt, plus denses au glacier.
    const snow = fade(env, 8, 14) * (0.6 + 0.4 * fade(env, 18, 24));
    if (snow > 0.02) {
      drifters(env, 30, 83, (ctx, x, y, i, phase) => {
        ctx.fillStyle = `rgba(255,255,255,${(0.8 * snow).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x + (env.motion ? Math.sin(env.t + i) * 4 : 0), y, 1 + phase * 1.6, 0, TAU);
        ctx.fill();
      }, { x: 6, y: 26 });
    }
  },
  ground(env: SceneEnv, top: number) {
    const { ctx, w, h } = env;
    if (top >= h) return;
    const night = fade(env, 44, 52);
    ctx.fillStyle = css(mix([110, 176, 96], [40, 60, 70], night));
    ctx.fillRect(0, top, w, h - top);
    // Sentier et fleurs d'alpage.
    ctx.fillStyle = css(mix([196, 170, 130], [80, 80, 90], night), 0.9);
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h);
    ctx.quadraticCurveTo(w * 0.5, top + 10, w * 0.62, top);
    ctx.lineTo(w * 0.66, top);
    ctx.quadraticCurveTo(w * 0.56, top + 12, w * 0.5, h);
    ctx.closePath();
    ctx.fill();
    for (let k = 0; k < 30; k++) {
      const c = (['#FFFFFF', '#F7D24A', '#B28CF0', '#FF8FB0'] as const)[k % 4]!;
      ctx.fillStyle = night > 0.5 ? 'rgba(200,210,240,0.5)' : c;
      const x = hash(k, 51) * w;
      const y = top + 5 + hash(k, 52) * Math.max(0, h - top - 6);
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, TAU);
      ctx.fill();
    }
  },
};

export const montagne: Theme = {
  id: 'montagne',
  name: 'Montagne',
  rarity: 'rare',
  blocks: BLOCKS,
  sparks: ['#FFFFFF', '#9AD0FF', '#FFD166', '#7BD389'].map(hex),
  ground: { top: hex('#8CC970'), body: hex('#6EB05E') },
  audio: { wave: 'sine', root: 523.25, scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24] },
  scene,
  tiers: [
    {
      name: 'Village du col', skyTop: hex('#A9C8FF'), skyBottom: hex('#F4FAFF'), ink: INK,
      decor: (ctx, it, t, motion) => bird(ctx, 7 + it.r2 * 4, motion ? Math.sin(t * 6 + it.r1 * 9) * 0.5 : 0, [60, 70, 90], 0.6),
    },
    {
      name: 'Alpages', skyTop: hex('#B6DEFF'), skyBottom: hex('#E8F6EC'), ink: INK,
      decor: (ctx, it, t, motion) => {
        // Papillon d'alpage.
        const flap = motion ? Math.abs(Math.sin(t * 10 + it.r1 * 7)) : 0.6;
        ctx.fillStyle = it.r2 > 0.5 ? 'rgba(255,170,60,0.8)' : 'rgba(140,120,255,0.8)';
        ctx.beginPath();
        ctx.ellipse(-3, 0, 3.5 * flap + 0.5, 3, 0, 0, TAU);
        ctx.ellipse(3, 0, 3.5 * flap + 0.5, 3, 0, 0, TAU);
        ctx.fill();
      },
    },
    {
      name: 'Forêt de sapins', skyTop: hex('#A2CEF2'), skyBottom: hex('#DDEEF6'), ink: INK,
      decor: (ctx, it, t, motion) => {
        // Pomme de pin qui tombe en tournant.
        ctx.rotate((motion ? t : 0) + it.r1 * 6);
        ctx.fillStyle = 'rgba(120,80,50,0.75)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 3, 5, 0, 0, TAU);
        ctx.fill();
      },
    },
    {
      name: 'Glacier', skyTop: hex('#8FBDEB'), skyBottom: hex('#E3F0FA'), ink: INK,
      decor: (ctx, it, t, motion) => star(ctx, 3 + it.r2 * 3, [255, 255, 255], twinkle(it, t, motion, 0.7)),
    },
    {
      name: 'Rose du soir', skyTop: hex('#E28A9C'), skyBottom: hex('#FFD1B5'), ink: INK,
      decor: (ctx, it, t, motion) => star(ctx, 3 + it.r2 * 3, [255, 236, 236], twinkle(it, t, motion, 0.65)),
    },
    {
      name: 'Nuit d’altitude', skyTop: hex('#0E1A3A'), skyBottom: hex('#2E4A7A'), ink: CREAM,
      decor: (ctx, it, t, motion) => star(ctx, 4 + it.r2 * 5, CREAM, twinkle(it, t, motion, 0.85)),
    },
  ],
};
