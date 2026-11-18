/**
 * Orbital (Épique) : le pas de tir à l'aube, la haute atmosphère et sa mer de nuages, la
 * courbure de la Terre dans la stratosphère, l'orbite basse (satellites, station), la ceinture
 * d'astéroïdes sous une grande lune, puis la nébuleuse. Découvertes : un canard en scaphandre,
 * un petit drapeau planté sur la lune.
 */
import { CREAM, css, hex, roundedRect, type Rgb } from '../color';
import {
  altitude, byStage, cloud, drifters, egg, fade, hash, layerY, orb, reveal, starfield, sx, TAU,
  type Scene, type SceneEnv,
} from '../scene';
import type { Theme } from '../theme-types';
import { glow, star, twinkle } from './kit';

const BLOCKS = ['#62DEBF', '#8B75ED', '#4FB3F0', '#FFC65C', '#FF665E', '#D9D2FF'].map(hex);

function satellite(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, spin: number, blink: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle = '#3B5BA8';
  ctx.fillRect(-22 * s, -4 * s, 15 * s, 8 * s);
  ctx.fillRect(7 * s, -4 * s, 15 * s, 8 * s);
  ctx.strokeStyle = 'rgba(200,220,255,0.6)';
  ctx.lineWidth = 0.6;
  for (let k = 1; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(-22 * s + k * 5 * s, -4 * s);
    ctx.lineTo(-22 * s + k * 5 * s, 4 * s);
    ctx.moveTo(7 * s + k * 5 * s, -4 * s);
    ctx.lineTo(7 * s + k * 5 * s, 4 * s);
    ctx.stroke();
  }
  ctx.fillStyle = '#D9D2FF';
  roundedRect(ctx, -7 * s, -6 * s, 14 * s, 12 * s, 3 * s);
  ctx.fill();
  ctx.fillStyle = blink ? '#FF665E' : '#7A4040';
  ctx.beginPath();
  ctx.arc(0, -8 * s, 1.6 * s, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function asteroid(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, seed: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#6E6A86';
  ctx.beginPath();
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU;
    const rr = r * (0.75 + hash(seed, k) * 0.35);
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(40,36,60,0.6)';
  ctx.beginPath();
  ctx.arc(r * 0.2, -r * 0.15, r * 0.22, 0, TAU);
  ctx.arc(-r * 0.3, r * 0.25, r * 0.14, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(-r * 0.25, -r * 0.3, r * 0.35, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function nebula(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: Rgb, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, css(color, 0.32 * alpha));
  g.addColorStop(0.6, css(color, 0.12 * alpha));
  g.addColorStop(1, css(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const scene: Scene = {
  far(env: SceneEnv) {
    const { ctx, w, h, t, motion } = env;
    // Aube au sol, étoiles dès la stratosphère.
    const sun = 1 - fade(env, 8, 18);
    if (sun > 0) orb(ctx, w * 0.8, h * (0.62 - fade(env, 0, 10) * 0.2), 26, [255, 214, 150], 1.4, sun);
    const space = fade(env, 7, 16);
    starfield(env, 90, space, 101, 0.01);
    // Courbure de la Terre : un grand arc lumineux qui apparaît puis s'éloigne en bas.
    const earth = fade(env, 8, 14) * (1 - fade(env, 34, 44) * 0.6);
    if (earth > 0) {
      const r = w * 2.2;
      const cy = h * 0.98 + r - fade(env, 8, 22) * h * 0.16 + fade(env, 22, 45) * h * 0.25;
      const g = ctx.createRadialGradient(w / 2, cy, r * 0.97, w / 2, cy, r * 1.04);
      g.addColorStop(0, css([60, 140, 220], earth));
      g.addColorStop(0.55, css([140, 210, 255], 0.9 * earth));
      g.addColorStop(1, css([140, 210, 255], 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(w / 2, cy, r * 1.04, 0, TAU);
      ctx.fill();
      ctx.fillStyle = css([40, 90, 170], earth);
      ctx.beginPath();
      ctx.arc(w / 2, cy, r * 0.985, 0, TAU);
      ctx.fill();
      ctx.fillStyle = css([255, 255, 255], 0.35 * earth);
      for (let k = 0; k < 7; k++) {
        ctx.beginPath();
        ctx.ellipse(w * hash(k, 70), cy - r * 0.985 + 10 + hash(k, 71) * 22, 30 + hash(k, 72) * 40, 4, 0, 0, TAU);
        ctx.fill();
      }
    }
    // Grande lune (ceinture d'astéroïdes), puis nébuleuse colorée et galaxie spirale.
    const moon = fade(env, 30, 38);
    if (moon > 0) {
      const mx = w * 0.22;
      const my = h * 0.24;
      orb(ctx, mx, my, 34, [214, 214, 226], 0.6, moon);
      ctx.fillStyle = css([170, 170, 188], moon);
      for (const [dx, dy, rr] of [[-10, -8, 7], [9, 6, 9], [12, -14, 4], [-14, 12, 5]] as const) {
        ctx.beginPath();
        ctx.arc(mx + dx, my + dy, rr, 0, TAU);
        ctx.fill();
      }
      if (egg(env, 21, 0.6)) {
        ctx.strokeStyle = css([240, 240, 250], moon);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(mx + 6, my - 33);
        ctx.lineTo(mx + 6, my - 48);
        ctx.stroke();
        ctx.fillStyle = css([255, 102, 94], moon);
        ctx.fillRect(mx + 6, my - 48, 10, 6);
      }
    }
    const deep = fade(env, 42, 52);
    if (deep > 0) {
      nebula(ctx, w * 0.3, h * 0.3, w * 0.55, [139, 117, 237], deep);
      nebula(ctx, w * 0.75, h * 0.18, w * 0.45, [98, 222, 191], deep);
      nebula(ctx, w * 0.6, h * 0.55, w * 0.4, [255, 102, 160], deep * 0.8);
      // Galaxie spirale lointaine.
      ctx.save();
      ctx.translate(w * 0.8, h * 0.4);
      ctx.rotate(motion ? t * 0.03 : 0.4);
      ctx.scale(1, 0.45);
      for (let k = 0; k < 90; k++) {
        const a = k * 0.35;
        const r = 2 + k * 0.42;
        for (const arm of [0, Math.PI]) {
          ctx.fillStyle = `rgba(230,220,255,${(deep * (1 - k / 95) * 0.7).toFixed(3)})`;
          ctx.fillRect(Math.cos(a + arm) * r, Math.sin(a + arm) * r, 1.4, 1.4);
        }
      }
      ctx.restore();
      if (motion && env.full) {
        // Comète : un passage lent toutes les 10 s.
        const p = (t % 10) / 3;
        if (p < 1) {
          const x = w * (0.1 + p * 0.8);
          const y = h * (0.12 + p * 0.06);
          const g = ctx.createLinearGradient(x, y, x - 90, y - 12);
          g.addColorStop(0, `rgba(220,250,255,${(deep * 0.9).toFixed(3)})`);
          g.addColorStop(1, 'rgba(220,250,255,0)');
          ctx.strokeStyle = g;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 90, y - 12);
          ctx.stroke();
          glow(ctx, x, y, 6, [230, 255, 255], deep);
        }
      }
    }
  },
  back(env: SceneEnv) {
    const { ctx, t, motion } = env;
    const s = env.scale;
    // Pas de tir : tour de lancement, fusée, antennes.
    const gy = layerY(env, 0, 0.35);
    if (gy < env.h + 220 && gy > -100) {
      const steel = byStage(env, [[58, 60, 96], [50, 52, 90], [40, 42, 80], [30, 32, 64], [24, 24, 50], [20, 18, 44]]);
      ctx.fillStyle = css(steel);
      const tx = sx(env, -150);
      ctx.fillRect(tx - 9 * s, gy - 150 * s, 18 * s, 150 * s);
      ctx.strokeStyle = css(steel);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        ctx.moveTo(tx - 9 * s, gy - k * 15 * s);
        ctx.lineTo(tx + 9 * s, gy - (k + 1) * 15 * s);
      }
      ctx.moveTo(tx + 9 * s, gy - 110 * s);
      ctx.lineTo(tx + 24 * s, gy - 110 * s);
      ctx.stroke();
      ctx.fillStyle = '#E8E4F0';
      roundedRect(ctx, tx + 24 * s, gy - 130 * s, 16 * s, 130 * s, 6 * s);
      ctx.fill();
      ctx.fillStyle = '#FF665E';
      ctx.beginPath();
      ctx.moveTo(tx + 24 * s, gy - 126 * s);
      ctx.lineTo(tx + 32 * s, gy - 150 * s);
      ctx.lineTo(tx + 40 * s, gy - 126 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(tx + 20 * s, gy - 18 * s, 4 * s, 18 * s);
      ctx.fillRect(tx + 40 * s, gy - 18 * s, 4 * s, 18 * s);
      const blink = !motion || Math.sin(t * 4) > 0;
      ctx.fillStyle = blink ? '#FF665E' : '#5A2A2A';
      ctx.beginPath();
      ctx.arc(tx, gy - 154 * s, 2.5 * s, 0, TAU);
      ctx.fill();
      // Antenne parabolique.
      const dx = sx(env, 150);
      ctx.fillStyle = css(steel);
      ctx.fillRect(dx - 2 * s, gy - 40 * s, 4 * s, 40 * s);
      ctx.save();
      ctx.translate(dx, gy - 44 * s);
      ctx.rotate(-0.6 + (motion ? Math.sin(t * 0.3) * 0.2 : 0));
      ctx.fillStyle = '#D9D2FF';
      ctx.beginPath();
      ctx.ellipse(0, 0, 22 * s, 9 * s, 0, Math.PI, TAU);
      ctx.fill();
      ctx.restore();
    }
    // Mer de nuages, traversée vers 6 étages.
    const cy = layerY(env, altitude(env, 6, 0.5), 0.5);
    if (cy > -100 && cy < env.h + 120) {
      const tint = byStage(env, [[255, 236, 220], [240, 240, 255], [220, 226, 250], [200, 210, 240], [180, 190, 230], [170, 170, 220]]);
      for (let k = 0; k < 7; k++) cloud(ctx, sx(env, -190 + k * 64), cy + hash(k, 41) * 30, s * (1 + hash(k, 42) * 0.5), tint, 0.92, [180, 190, 230]);
    }
    // Satellites et station, en orbite basse (20 étages).
    for (const [floor, x, size] of [[17, -120, 1], [23, 130, 1.2], [28, -40, 0.9]] as const) {
      const y = layerY(env, altitude(env, floor, 0.45), 0.45);
      const seen = reveal(env, floor);
      if (y < -60 || y > env.h + 60 || seen <= 0) continue;
      ctx.globalAlpha = seen;
      satellite(ctx, sx(env, x + (motion ? Math.sin(t * 0.2 + floor) * 20 : 0)), y, s * size, motion ? t * 0.15 + floor : floor, !motion || Math.sin(t * 3 + floor) > 0.6);
    }
    ctx.globalAlpha = 1;
    const st = layerY(env, altitude(env, 25, 0.35), 0.35);
    const stationSeen = reveal(env, 25);
    if (st > -80 && st < env.h + 80 && stationSeen > 0) {
      ctx.globalAlpha = stationSeen;
      const x0 = sx(env, 40 + (motion ? (t * 3) % 60 - 30 : 0));
      ctx.fillStyle = '#C9C2EE';
      ctx.fillRect(x0 - 50 * s, st - 2 * s, 100 * s, 4 * s);
      for (const dx of [-46, -30, 30, 46]) {
        ctx.fillStyle = '#3B5BA8';
        ctx.fillRect(x0 + dx * s - 6 * s, st - 16 * s, 12 * s, 32 * s);
      }
      ctx.fillStyle = '#E8E4F0';
      roundedRect(ctx, x0 - 14 * s, st - 8 * s, 28 * s, 16 * s, 5 * s);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Ceinture d'astéroïdes (35–45 étages).
    const belt = fade(env, 28, 33);
    for (let k = 0; k < 9 && belt > 0; k++) {
      const y = layerY(env, altitude(env, 34 + k * 1.3, 0.55), 0.55);
      if (y < -40 || y > env.h + 40) continue;
      ctx.globalAlpha = belt;
      asteroid(ctx, sx(env, -180 + hash(k, 80) * 360), y, (5 + hash(k, 81) * 10) * s, motion ? t * (0.2 + hash(k, 82)) : k, k);
    }
    ctx.globalAlpha = 1;
    // Découverte : un canard en scaphandre qui flotte.
    if (egg(env, 22, 0.6) && reveal(env, 39) > 0.5) {
      const dy = layerY(env, altitude(env, 39, 0.4), 0.4);
      if (dy > -50 && dy < env.h + 50) {
        const dx = sx(env, 120) + (motion ? Math.sin(t * 0.7) * 10 : 0);
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(motion ? Math.sin(t * 0.5) * 0.3 : 0.2);
        ctx.fillStyle = '#FFD84A';
        ctx.beginPath();
        ctx.ellipse(0, 4 * s, 10 * s, 7 * s, 0, 0, TAU);
        ctx.arc(6 * s, -4 * s, 5.5 * s, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#FF9A3C';
        ctx.beginPath();
        ctx.moveTo(10.5 * s, -4 * s);
        ctx.lineTo(15 * s, -2.5 * s);
        ctx.lineTo(10.5 * s, -1 * s);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200,240,255,0.85)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(6 * s, -4 * s, 9 * s, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
  },
  near(env: SceneEnv) {
    const dust = fade(env, 18, 26);
    if (dust > 0.02) {
      drifters(env, 14, 131, (ctx, x, y) => {
        ctx.fillStyle = `rgba(220,230,255,${(0.35 * dust).toFixed(3)})`;
        ctx.fillRect(x, y, 6, 0.8);
      }, { x: -30, y: 4 });
    }
  },
  ground(env: SceneEnv, top: number) {
    const { ctx, w, h } = env;
    if (top >= h) return;
    ctx.fillStyle = '#4A4675';
    ctx.fillRect(0, top, w, h - top);
    ctx.fillStyle = '#6E6A9E';
    ctx.fillRect(0, top, w, Math.min(6, h - top));
    // Bandes de sécurité du pas de tir.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top + 8, w, 7);
    ctx.clip();
    for (let x = -14; x < w + 14; x += 14) {
      ctx.fillStyle = '#FFC65C';
      ctx.beginPath();
      ctx.moveTo(x, top + 15);
      ctx.lineTo(x + 7, top + 8);
      ctx.lineTo(x + 14, top + 8);
      ctx.lineTo(x + 7, top + 15);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },
};

const STAR_INK: Rgb = CREAM;

export const orbital: Theme = {
  id: 'orbital',
  name: 'Orbital',
  rarity: 'epique',
  blocks: BLOCKS,
  sparks: ['#FFF4DB', '#62DEBF', '#FFC65C'].map(hex),
  ground: { top: hex('#6E6A9E'), body: hex('#4A4675') },
  audio: { wave: 'sine', root: 440, scale: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24] },
  scene,
  tiers: [
    {
      name: 'Pas de tir', skyTop: hex('#2E4F8E'), skyBottom: hex('#F4BE8E'), ink: CREAM,
      decor: (ctx, it) => {
        // Traînée de vapeur.
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-18, 6 * it.r1);
        ctx.quadraticCurveTo(0, -6, 18 + it.r2 * 8, 2);
        ctx.stroke();
      },
    },
    {
      name: 'Haute atmosphère', skyTop: hex('#20407A'), skyBottom: hex('#8FB4DE'), ink: CREAM,
      decor: (ctx, it) => {
        // Avion de ligne et sa traînée.
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-30, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(0, -1, 7, 2);
        ctx.fillRect(2 + it.r1, -4, 2, 8);
      },
    },
    {
      name: 'Stratosphère', skyTop: hex('#12204E'), skyBottom: hex('#3D5D9A'), ink: CREAM,
      decor: (ctx, it, t, motion) => star(ctx, 2 + it.r2 * 2.5, STAR_INK, twinkle(it, t, motion, 0.7)),
    },
    {
      name: 'Orbite basse', skyTop: hex('#0B1235'), skyBottom: hex('#1E2A5C'), ink: CREAM,
      decor: (ctx, it) => {
        const r = 10 + it.r2 * 9;
        const c = BLOCKS[Math.floor(it.r1 * BLOCKS.length)]!;
        ctx.fillStyle = css(c, 0.45);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = css(CREAM, 0.4);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.8, r * 0.45, -0.35 + it.r3 * 0.3, 0, TAU);
        ctx.stroke();
      },
    },
    {
      name: 'Ceinture d’astéroïdes', skyTop: hex('#070A22'), skyBottom: hex('#1A1640'), ink: CREAM,
      decor: (ctx, it, t, motion) => {
        const pts: [number, number][] = [];
        for (let k = 0; k < 4; k++) pts.push([Math.cos(k * 1.9 + it.r1 * 6) * 26, Math.sin(k * 2.7 + it.r2 * 6) * 18]);
        ctx.strokeStyle = css(CREAM, 0.25);
        ctx.lineWidth = 1;
        ctx.beginPath();
        pts.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
        for (const [x, y] of pts) {
          ctx.save();
          ctx.translate(x, y);
          star(ctx, 3, CREAM, twinkle(it, t, motion, 0.8));
          ctx.restore();
        }
      },
    },
    {
      name: 'Nébuleuse', skyTop: hex('#070820'), skyBottom: hex('#33174F'), ink: CREAM,
      decor: (ctx, it) => {
        const c = it.r1 < 0.5 ? hex('#8B75ED') : hex('#62DEBF');
        const r = 26 + it.r2 * 20;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, css(c, 0.32));
        g.addColorStop(1, css(c, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
      },
    },
  ],
};

