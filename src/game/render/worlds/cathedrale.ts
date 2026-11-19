/**
 * Cathédrale oubliée (Épique, V8, collection sombre) : le parvis désert au crépuscule, gargouilles
 * et corbeaux ; puis on monte dans la nef entre les piliers et les cierges, devant la grande rose
 * dont les vitraux projettent des rayons colorés dans la poussière ; on passe les tuyaux de l'orgue,
 * les voûtes effondrées ouvertes sur la nuit, jusqu'au clocher et à sa cloche sous la lune.
 *
 * Lumière : la pierre est sombre mais chaude, éclairée par les cierges (ambre) et par les vitraux
 * (rubis, émeraude, ambre) ; jamais un aplat noir : chaque plan a son ton.
 * Découvertes : un chat noir sur un banc, une armure oubliée, une volée de corbeaux, la cloche
 * qui sonne au sommet.
 */
import { CREAM, css, hex, mix, type Rgb } from '../color';
import {
  altitude, byStage, drifters, egg, fade, hash, layerY, orb, reveal, sx, TAU,
  type Scene, type SceneEnv,
} from '../scene';
import type { Theme } from '../theme-types';
import { bird, glow, star, twinkle } from './kit';

const BLOCKS = ['#B9A58A', '#8E6E58', '#C8B79A', '#7A6656', '#A8957C', '#6E5A4C'].map(hex);
const GLASS: readonly Rgb[] = [[200, 40, 50], [40, 150, 90], [230, 160, 40], [60, 90, 170], [200, 40, 50], [230, 160, 40]];

/** Arc brisé gothique (contour plein) de largeur `w` et hauteur `h`, pied en (x, y). */
function gothicArch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const r = w * 0.9;
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 2, y - h + w * 0.5);
  ctx.arc(x + w / 2 - r, y - h + w * 0.5, r, 0, -Math.acos((r - w / 2) / r), true);
  ctx.arc(x - w / 2 + r, y - h + w * 0.5, r, Math.PI + Math.acos((r - w / 2) / r), Math.PI, true);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
}

/** Façade : deux tours, portail, rose (éteinte au parvis). */
function facade(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, stone: Rgb, lit: number): void {
  ctx.fillStyle = css(stone);
  ctx.fillRect(x - 60 * s, y - 70 * s, 120 * s, 70 * s);
  ctx.fillRect(x - 64 * s, y - 120 * s, 34 * s, 120 * s);
  ctx.fillRect(x + 30 * s, y - 120 * s, 34 * s, 120 * s);
  // Flèches.
  ctx.beginPath();
  ctx.moveTo(x - 66 * s, y - 120 * s);
  ctx.lineTo(x - 47 * s, y - 158 * s);
  ctx.lineTo(x - 28 * s, y - 120 * s);
  ctx.moveTo(x + 28 * s, y - 120 * s);
  ctx.lineTo(x + 47 * s, y - 158 * s);
  ctx.lineTo(x + 66 * s, y - 120 * s);
  ctx.fill();
  // Portail et fenêtres des tours.
  ctx.fillStyle = css(mix(stone, [0, 0, 0], 0.55));
  ctx.beginPath();
  gothicArch(ctx, x, y, 26 * s, 44 * s);
  gothicArch(ctx, x - 47 * s, y - 70 * s, 10 * s, 28 * s);
  gothicArch(ctx, x + 47 * s, y - 70 * s, 10 * s, 28 * s);
  ctx.fill();
  // Rose : lueur des cierges derrière, de plus en plus vive.
  ctx.fillStyle = css(mix(stone, [0, 0, 0], 0.5));
  ctx.beginPath();
  ctx.arc(x, y - 92 * s, 16 * s, 0, TAU);
  ctx.fill();
  if (lit > 0.02) {
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = css(GLASS[k % GLASS.length]!, 0.75 * lit);
      ctx.beginPath();
      ctx.moveTo(x, y - 92 * s);
      ctx.arc(x, y - 92 * s, 13 * s, (k / 8) * TAU, ((k + 0.85) / 8) * TAU);
      ctx.fill();
    }
    glow(ctx, x, y - 92 * s, 30 * s, [255, 190, 110], 0.35 * lit);
  }
}

function gargoyle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number, stone: Rgb): void {
  ctx.fillStyle = css(stone);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dir * 14 * s, y - 2 * s);
  ctx.lineTo(x + dir * 18 * s, y - 6 * s);
  ctx.lineTo(x + dir * 12 * s, y - 7 * s);
  ctx.lineTo(x + dir * 8 * s, y - 12 * s);
  ctx.lineTo(x + dir * 4 * s, y - 6 * s);
  ctx.lineTo(x, y - 8 * s);
  ctx.closePath();
  ctx.fill();
}

/** Pilier de nef avec chapiteau, et départ d'arc vers son voisin. */
function pillar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, h: number, stone: Rgb): void {
  ctx.fillStyle = css(stone);
  ctx.fillRect(x - 5 * s, y - h * s, 10 * s, h * s);
  ctx.fillRect(x - 7 * s, y - h * s - 3 * s, 14 * s, 3 * s);
  ctx.fillStyle = css(mix(stone, [255, 230, 190], 0.12));
  ctx.fillRect(x - 5 * s, y - h * s, 2.5 * s, h * s); // flanc éclairé par les cierges
}

function candle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, motion: boolean): void {
  ctx.fillStyle = '#E8DCC0';
  ctx.fillRect(x - 1 * s, y - 7 * s, 2 * s, 7 * s);
  const f = motion ? 0.85 + 0.15 * Math.sin(t * 11 + x) : 1;
  ctx.fillStyle = 'rgba(255,200,90,0.95)';
  ctx.beginPath();
  ctx.ellipse(x, y - 9 * s, 1 * s, 2 * s * f, 0, 0, TAU);
  ctx.fill();
  glow(ctx, x, y - 9 * s, 12 * s, [255, 170, 70], 0.45 * f);
}

/** Tuyaux d'orgue en bronze. */
function organ(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, bronze: Rgb): void {
  for (let k = -8; k <= 8; k++) {
    const h = (56 - Math.abs(k) * 4.2) * s;
    const X = x + k * 6.5 * s;
    const g = ctx.createLinearGradient(X - 2.5 * s, 0, X + 2.5 * s, 0);
    g.addColorStop(0, css(mix(bronze, [255, 230, 180], 0.35)));
    g.addColorStop(0.45, css(bronze));
    g.addColorStop(1, css(mix(bronze, [0, 0, 0], 0.5)));
    ctx.fillStyle = g;
    ctx.fillRect(X - 2.5 * s, y - h, 5 * s, h);
    ctx.fillStyle = css(mix(bronze, [0, 0, 0], 0.65));
    ctx.fillRect(X - 1.5 * s, y - h * 0.2, 3 * s, 1.4 * s);
  }
  ctx.fillStyle = '#2A1E16';
  ctx.fillRect(x - 60 * s, y, 120 * s, 10 * s);
}

function bell(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, swing: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(swing);
  const g = ctx.createLinearGradient(-12 * s, 0, 12 * s, 0);
  g.addColorStop(0, '#C9A14A');
  g.addColorStop(0.4, '#8A6A2A');
  g.addColorStop(1, '#3E2E14');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-5 * s, 2 * s);
  ctx.quadraticCurveTo(-7 * s, 12 * s, -13 * s, 22 * s);
  ctx.lineTo(13 * s, 22 * s);
  ctx.quadraticCurveTo(7 * s, 12 * s, 5 * s, 2 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const scene: Scene = {
  far(env: SceneEnv) {
    const { ctx, w, h } = env;
    // Dehors (parvis, voûtes effondrées, clocher) : lune et étoiles ; dedans : pénombre chaude.
    const outside = 1 - fade(env, 4, 8) + fade(env, 30, 38);
    const moon = Math.min(1, outside);
    orb(ctx, w * 0.24, h * 0.15, 13, [240, 232, 210], 0.9, moon * 0.9);
    if (moon > 0.05) {
      for (let k = 0; k < 50; k++) {
        const a = moon * 0.7 * (env.motion ? 0.6 + 0.4 * Math.sin(env.t * 1.1 + k) : 0.8);
        ctx.fillStyle = `rgba(240,232,210,${a.toFixed(3)})`;
        ctx.fillRect(hash(k, 801) * w, hash(k, 802) * h * 0.6, 1, 1);
      }
    }
  },
  back(env: SceneEnv) {
    const { ctx } = env;
    const s = env.scale;
    const stone = byStage(env, [[78, 70, 66], [70, 60, 54], [66, 56, 50], [60, 52, 46], [56, 52, 52], [46, 44, 46]]);
    // Parvis : la façade au fond (disparaît quand on entre).
    const out = 1 - fade(env, 3, 7);
    if (out > 0.02) {
      const fy = layerY(env, 8, 0.15);
      ctx.globalAlpha = out;
      // Façade large : ses deux tours encadrent la tour du joueur.
      const k = 1.9;
      facade(ctx, sx(env, 0), fy, s * k, mix(stone, [120, 108, 96], 0.25), fade(env, 0, 4));
      gargoyle(ctx, sx(env, -64 * k), fy - 112 * s * k, s * 1.3, -1, stone);
      gargoyle(ctx, sx(env, 64 * k), fy - 112 * s * k, s * 1.3, 1, stone);
      ctx.globalAlpha = 1;
    }
    // Nef : deux rangées de piliers en perspective (la plus lointaine plus pâle), cierges.
    const nave = fade(env, 3, 7) * (1 - fade(env, 32, 40));
    if (nave > 0.02) {
      ctx.globalAlpha = nave;
      for (const [p, gap, haze, hh] of [[0.18, 44, 0.45, 150], [0.3, 64, 0.15, 190]] as const) {
        const tone = mix(stone, [120, 96, 72], haze);
        for (let k = -4; k <= 4; k++) {
          const X = sx(env, k * gap);
          const Y = layerY(env, 0, p);
          if (Y < -40) continue;
          pillar(ctx, X, Y, s, hh, tone);
          // Arcs entre les piliers.
          ctx.strokeStyle = css(tone);
          ctx.lineWidth = 5 * s;
          ctx.beginPath();
          ctx.arc(X + gap * s / 2, Y - hh * s, gap * s / 2, Math.PI, 0);
          ctx.stroke();
        }
      }
      // Cierges au pied des piliers proches.
      const cy = layerY(env, 2, 0.3);
      if (cy < env.h + 20) for (let k = -3; k <= 3; k++) candle(ctx, sx(env, k * 64 + 18), cy, s * 1.2, env.t, env.motion);
      ctx.globalAlpha = 1;
    }
    // Grande rose et rayons colorés (vers 12 étages).
    const ry = layerY(env, altitude(env, 13, 0.35), 0.35);
    const rose = reveal(env, 13) * (1 - fade(env, 30, 36));
    if (rose > 0.02 && ry > -160 && ry < env.h + 160) {
      const X = sx(env, 70);
      const R = 46 * s;
      ctx.globalAlpha = rose;
      ctx.fillStyle = css(mix(stone, [0, 0, 0], 0.4));
      ctx.beginPath();
      ctx.arc(X, ry, R + 6 * s, 0, TAU);
      ctx.fill();
      for (let k = 0; k < 12; k++) {
        const a0 = (k / 12) * TAU;
        ctx.fillStyle = css(GLASS[k % GLASS.length]!, 0.9);
        ctx.beginPath();
        ctx.moveTo(X, ry);
        ctx.arc(X, ry, R, a0 + 0.04, a0 + TAU / 12 - 0.04);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = css(mix(stone, [0, 0, 0], 0.3));
      ctx.beginPath();
      ctx.arc(X, ry, R * 0.28, 0, TAU);
      ctx.fill();
      glow(ctx, X, ry, R * 2, [255, 200, 140], 0.3);
      // Rayons colorés qui descendent vers la gauche, dans la poussière.
      for (let k = 0; k < 4; k++) {
        const c = GLASS[k]!;
        const sway = env.motion ? Math.sin(env.t * 0.3 + k) * 4 : 0;
        const g = ctx.createLinearGradient(X, ry, X - 160 * s, ry + 260 * s);
        g.addColorStop(0, css(c, 0.22));
        g.addColorStop(1, css(c, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(X - R * 0.6 + k * 10 * s, ry - R * 0.3);
        ctx.lineTo(X - R * 0.3 + k * 10 * s, ry + R * 0.3);
        ctx.lineTo(X - 150 * s + k * 26 * s + sway, ry + 280 * s);
        ctx.lineTo(X - 190 * s + k * 26 * s + sway, ry + 280 * s);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // Orgue (vers 22 étages).
    const oy = layerY(env, altitude(env, 24, 0.4), 0.4);
    const org = reveal(env, 24) * (1 - fade(env, 36, 42));
    if (org > 0.02 && oy > -120 && oy < env.h + 200) {
      ctx.globalAlpha = org;
      organ(ctx, sx(env, -80), oy + 50 * s, s, byStage(env, [[150, 110, 60], [150, 110, 60], [146, 106, 58], [140, 100, 56], [120, 90, 54], [100, 80, 50]]));
      if (egg(env, 2, 0.45)) {
        // Une armure oubliée au pied de l'orgue.
        const ax = sx(env, -20);
        const ay = oy + 50 * s;
        ctx.fillStyle = '#6E6A66';
        ctx.fillRect(ax - 3 * s, ay - 18 * s, 6 * s, 10 * s);
        ctx.fillRect(ax - 2.5 * s, ay - 8 * s, 2 * s, 8 * s);
        ctx.fillRect(ax + 0.5 * s, ay - 8 * s, 2 * s, 8 * s);
        ctx.beginPath();
        ctx.arc(ax, ay - 21 * s, 3.2 * s, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#A8A29A';
        ctx.fillRect(ax - 2.4 * s, ay - 21.5 * s, 4.8 * s, 0.8 * s);
      }
      ctx.globalAlpha = 1;
    }
    // Voûtes effondrées (35+) : nervures brisées sur le ciel nocturne, lierre.
    const vault = fade(env, 32, 40);
    if (vault > 0.02) {
      const vy = layerY(env, altitude(env, 40, 0.5), 0.5);
      ctx.globalAlpha = vault;
      ctx.strokeStyle = css(mix(stone, [140, 130, 120], 0.2));
      ctx.lineWidth = 7 * s;
      for (const [x0, a1] of [[-140, 0.55], [140, 0.6], [-40, 0.35]] as const) {
        ctx.beginPath();
        ctx.arc(sx(env, x0), vy + 80 * s, 120 * s, Math.PI * 1.02, Math.PI * (1.02 + a1));
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(60,96,52,0.8)';
      ctx.lineWidth = 1.4 * s;
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        const x = sx(env, -160 + k * 60);
        ctx.moveTo(x, vy - 30 * s);
        ctx.quadraticCurveTo(x + 6 * s, vy, x - 4 * s, vy + 26 * s);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // Clocher et cloche (50) : elle se balance, et sonne parfois.
    const top = fade(env, 46, 52);
    if (top > 0.02) {
      const by = layerY(env, altitude(env, 52, 0.55), 0.55);
      ctx.globalAlpha = top;
      ctx.fillStyle = css(mix(stone, [30, 30, 34], 0.3));
      ctx.fillRect(sx(env, 110) - 40 * s, by - 50 * s, 80 * s, 110 * s);
      ctx.fillStyle = css([20, 20, 26]);
      ctx.beginPath();
      gothicArch(ctx, sx(env, 110), by + 40 * s, 50 * s, 80 * s);
      ctx.fill();
      bell(ctx, sx(env, 110), by - 22 * s, s * 1.3, env.motion ? Math.sin(env.t * 1.6) * 0.35 : 0.1);
      ctx.globalAlpha = 1;
    }
  },
  near(env: SceneEnv) {
    const { ctx } = env;
    // Poussière dorée dans la lumière (dedans), flocons de cendre froide dehors en haut.
    const inside = fade(env, 4, 8) * (1 - fade(env, 34, 40));
    if (inside > 0.02) {
      drifters(env, 22, 71, (c, x, y, k) => {
        const a = inside * (env.motion ? 0.25 + 0.3 * Math.sin(env.t * 0.8 + k) : 0.4);
        c.fillStyle = `rgba(255,220,160,${Math.max(0, a).toFixed(3)})`;
        c.fillRect(x, y, 1.2, 1.2);
      }, { x: 3, y: -2 });
    }
    // Volée de corbeaux (parvis et sommet).
    const crows = Math.max(1 - fade(env, 2, 6), fade(env, 34, 42));
    if (crows > 0.05 && egg(env, 1, 0.75)) {
      const p = env.motion ? (env.t % 22) / 22 : 0.5;
      for (let k = 0; k < 5; k++) {
        const x = -60 + p * (env.w + 120) - k * 22 - hash(k, 61) * 14;
        const y = env.h * 0.24 + hash(k, 62) * 30 + Math.sin(env.t * 2 + k) * 3;
        ctx.save();
        ctx.translate(x, y);
        bird(ctx, 0.7 + hash(k, 63) * 0.4, env.motion ? Math.sin(env.t * 9 + k) * 3 : 0, [24, 22, 24], 0.85 * crows);
        ctx.restore();
      }
    }
    // Chat noir sur un banc (nef), yeux qui brillent.
    if (egg(env, 3, 0.5) && env.full) {
      const by = layerY(env, 4, 1);
      if (by > 0 && by < env.h && fade(env, 5, 8) > 0.5 && env.height < 30) {
        ctx.fillStyle = '#3A2A1E';
        ctx.fillRect(14, by, 70, 5);
        ctx.fillRect(18, by + 5, 4, 12);
        ctx.fillRect(76, by + 5, 4, 12);
        ctx.fillStyle = '#141214';
        ctx.beginPath();
        ctx.ellipse(50, by - 4, 7, 4.5, 0, 0, TAU);
        ctx.arc(56, by - 9, 3.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#E8C04A';
        ctx.fillRect(55, by - 10, 1.2, 1.2);
        ctx.fillRect(58, by - 10, 1.2, 1.2);
      }
    }
  },
  ground(env: SceneEnv, top: number) {
    const { ctx, w, h } = env;
    if (top >= h) return;
    // Dalles de pierre usées, joints, reflets des cierges.
    ctx.fillStyle = css(byStage(env, [[70, 62, 56], [62, 54, 48], [58, 50, 44], [54, 48, 42], [50, 46, 44], [42, 40, 42]]));
    ctx.fillRect(0, top, w, h - top);
    ctx.strokeStyle = 'rgba(20,16,14,0.55)';
    ctx.lineWidth = 1;
    for (let row = 0; row < 5; row++) {
      const y = top + 6 + row * 11;
      if (y > h) break;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      for (let x = (row % 2) * 22; x < w; x += 44) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 11);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,190,110,0.08)';
    ctx.fillRect(0, top, w, 5);
  },
};

export const cathedrale: Theme = {
  id: 'cathedrale',
  name: 'Cathédrale oubliée',
  rarity: 'epique',
  blocks: BLOCKS,
  sparks: ['#FFC870', '#E8483A', '#4CC88A', '#FFF1D6'].map(hex),
  ground: { top: hex('#4A403A'), body: hex('#3E3630') },
  audio: { wave: 'sine', root: 220, scale: [0, 2, 3, 5, 7, 8, 11, 12, 14, 15, 17] },
  scene,
  tiers: [
    { name: 'Parvis abandonné', skyTop: hex('#2A2522'), skyBottom: hex('#6E5A48'), ink: CREAM, decor: (ctx, it, t, motion) => star(ctx, 1.5 + it.r2, [240, 232, 210], twinkle(it, t, motion, 0.4)) },
    { name: 'La nef', skyTop: hex('#221C19'), skyBottom: hex('#4E3E32'), ink: CREAM, decor: (ctx, it, t, motion) => glow(ctx, 0, 0, 6, [255, 190, 110], twinkle(it, t, motion, 0.35)) },
    { name: 'Sous la grande rose', skyTop: hex('#201918'), skyBottom: hex('#4A3530'), ink: CREAM, decor: (ctx, it, t, motion) => glow(ctx, 0, 0, 7, GLASS[Math.floor(it.r1 * 4)]!, twinkle(it, t, motion, 0.35)) },
    { name: 'Les grandes orgues', skyTop: hex('#1C1614'), skyBottom: hex('#3E2E26'), ink: CREAM, decor: (ctx, it, t, motion) => glow(ctx, 0, 0, 5, [255, 220, 160], twinkle(it, t, motion, 0.3)) },
    {
      name: 'Voûtes effondrées', skyTop: hex('#16171C'), skyBottom: hex('#34322F'), ink: CREAM,
      decor: (ctx, it, t, motion) => bird(ctx, 0.6 + it.r2 * 0.4, motion ? Math.sin(t * 8 + it.r1 * 9) * 3 : 0, [20, 20, 22], 0.8),
    },
    { name: 'Clocher sous la lune', skyTop: hex('#111219'), skyBottom: hex('#2C2A30'), ink: CREAM, decor: (ctx, it, t, motion) => star(ctx, 2 + it.r2 * 3, [240, 232, 210], twinkle(it, t, motion, 0.7)) },
  ],
};
