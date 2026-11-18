/**
 * Cité néon (Légendaire, V6) : une ville la nuit. La rue sous la pluie et ses enseignes, les
 * façades aux fenêtres allumées, les toits (château d'eau, antennes), le trafic aérien, le
 * dessus des nuages éclairés par la ville, puis un anneau orbital. Découvertes : un chat sur un
 * toit, un drone livreur de pizza, un panneau « STACK OR CRASH ».
 */
import { CREAM, css, hex, mix, roundedRect, type Rgb } from '../color';
import {
  altitude, byStage, cloud, drifters, egg, fade, glowRect, hash, layerY, orb, reveal, starfield, sx, TAU,
  type Scene, type SceneEnv,
} from '../scene';
import type { Theme } from '../theme-types';
import { glow, star, twinkle } from './kit';

const BLOCKS = ['#FF4FB8', '#3FE0FF', '#B46CFF', '#FFD24A', '#56F0A0', '#FF7A5C'].map(hex);
const SIGNS: readonly Rgb[] = [[255, 79, 184], [63, 224, 255], [255, 210, 74], [86, 240, 160], [180, 108, 255]];

/** Rangée d'immeubles : silhouettes rectangulaires, fenêtres et enseignes. */
function skyline(env: SceneEnv, p: number, seed: number, minH: number, maxH: number, color: Rgb, windows: number, signs: boolean): void {
  const { ctx, t, motion } = env;
  const s = env.scale;
  const base = layerY(env, 0, p);
  if (layerY(env, maxH, p) > env.h + 10) return;
  let x = -env.w / 2 / s - 20;
  let k = 0;
  while (x < env.w / 2 / s + 20 && k < 40) {
    const bw = 24 + hash(seed, k) * 34;
    const bh = minH + hash(seed, k + 100) * (maxH - minH);
    const left = sx(env, x);
    const top = layerY(env, bh, p);
    ctx.fillStyle = css(color);
    ctx.fillRect(left, top, bw * s + 1, base - top + 2);
    if (hash(seed, k + 300) > 0.6) {
      // Antenne et feu rouge clignotant.
      ctx.fillRect(left + bw * s * 0.5 - 0.8, top - 16 * s, 1.6, 16 * s);
      const on = !motion || Math.sin(t * 2.5 + k) > 0.2;
      if (on) glow(ctx, left + bw * s * 0.5, top - 16 * s, 5 * s, [255, 60, 60], 0.9);
    }
    if (windows > 0 && env.full) {
      const cols = Math.max(1, Math.floor(bw / 7));
      const rows = Math.min(30, Math.floor(bh / 9));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const id = k * 997 + r * 31 + c;
          const lit = hash(seed, id) < windows;
          if (!lit) continue;
          const flick = motion && hash(seed, id + 7) > 0.97 ? (Math.sin(t * 3 + id) > 0 ? 1 : 0.3) : 1;
          const wy = top + (4 + r * 9) * s;
          if (wy > env.h || wy < -10) continue;
          ctx.fillStyle = `rgba(255,${200 + Math.floor(hash(seed, id + 3) * 50)},${120 + Math.floor(hash(seed, id + 5) * 80)},${(0.75 * flick).toFixed(3)})`;
          ctx.fillRect(left + (3 + c * 7) * s, wy, 3.5 * s, 4.5 * s);
        }
      }
    }
    if (signs && hash(seed, k + 500) > 0.55) {
      const c = SIGNS[k % SIGNS.length]!;
      const sy = top + (12 + hash(seed, k + 600) * Math.max(4, bh - 40)) * s;
      const pulse = motion ? 0.75 + 0.25 * Math.sin(t * 4 + k * 2) : 1;
      if (hash(seed, k + 700) > 0.5) glowRect(ctx, left + 4 * s, sy, 4 * s, 22 * s, c, pulse);
      else glowRect(ctx, left + 5 * s, sy, Math.max(8, bw - 10) * s, 5 * s, c, pulse);
    }
    x += bw + 2 + hash(seed, k + 200) * 6;
    k++;
  }
}

function car(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number, color: Rgb): void {
  const g = ctx.createLinearGradient(x, y, x - dir * 50 * s, y);
  g.addColorStop(0, css(color, 0.7));
  g.addColorStop(1, css(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(Math.min(x, x - dir * 50 * s), y - 1.2 * s, 50 * s, 2.4 * s);
  ctx.fillStyle = '#2A2350';
  roundedRect(ctx, x - 9 * s, y - 4 * s, 18 * s, 7 * s, 3 * s);
  ctx.fill();
  glow(ctx, x + dir * 8 * s, y, 6 * s, [255, 250, 220], 0.9);
}

const scene: Scene = {
  far(env: SceneEnv) {
    const { ctx, w, h, t, motion } = env;
    // Lueur de la ville à l'horizon, qui s'éloigne pendant la montée.
    const glowK = 1 - fade(env, 30, 50) * 0.7;
    const g = ctx.createLinearGradient(0, h * 0.45, 0, h);
    g.addColorStop(0, 'rgba(255,79,184,0)');
    g.addColorStop(1, `rgba(255,79,184,${(0.35 * glowK).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);
    starfield(env, 70, 0.25 + fade(env, 30, 42) * 0.75, 401, 0.01);
    orb(ctx, w * 0.8, h * 0.14, 20, [255, 236, 210], 1.2, 0.9);
    // Anneau orbital (50 étages) : un arc immense ponctué de lumières.
    const ring = fade(env, 44, 54);
    if (ring > 0) {
      ctx.save();
      ctx.globalAlpha = ring;
      ctx.strokeStyle = 'rgba(190,200,255,0.55)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.95, w * 0.95, h * 0.62, -0.08, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(120,130,200,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      for (let k = 0; k < 22; k++) {
        const a = Math.PI * 1.1 + (k / 22) * Math.PI * 0.8;
        const lx = w / 2 + Math.cos(a - 0.08) * w * 0.95;
        const ly = h * 0.95 + Math.sin(a - 0.08) * h * 0.62;
        const on = !motion || Math.sin(t * 3 - k * 0.5) > 0;
        if (on) glow(ctx, lx, ly, 5, SIGNS[k % SIGNS.length]!, 0.9);
      }
      ctx.restore();
    }
  },
  back(env: SceneEnv) {
    const { ctx, t, motion } = env;
    const s = env.scale;
    // Deux rangées d'immeubles : lointaine (violette), proche (plus haute, avec enseignes).
    skyline(env, 0.14, 7, 60, 170, byStage(env, [[54, 30, 96], [50, 30, 92], [46, 28, 88], [40, 26, 80], [36, 24, 72], [30, 20, 64]]), 0.22, false);
    skyline(env, 0.32, 19, 80, 300, byStage(env, [[30, 18, 60], [28, 16, 58], [26, 16, 54], [24, 14, 50], [22, 14, 46], [20, 12, 42]]), 0.3, true);
    // Panneau publicitaire sur les toits (vers 10 étages) : la découverte du nom du jeu.
    const by = layerY(env, altitude(env, 11, 0.4), 0.4);
    if (by > -60 && by < env.h + 60 && reveal(env, 11) > 0) {
      ctx.globalAlpha = reveal(env, 11);
      const bx = sx(env, -170);
      ctx.fillStyle = '#140C2C';
      ctx.fillRect(bx, by - 26 * s, 96 * s, 30 * s);
      ctx.fillRect(bx + 10 * s, by + 4 * s, 3 * s, 20 * s);
      ctx.fillRect(bx + 82 * s, by + 4 * s, 3 * s, 20 * s);
      const on = !motion || hash(Math.floor(t * 2), 9) > 0.08;
      ctx.font = `800 ${Math.round(10 * s)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (on && egg(env, 41, 0.7)) {
        ctx.fillStyle = 'rgba(63,224,255,0.95)';
        ctx.fillText('STACK OR', bx + 48 * s, by - 17 * s);
        ctx.fillStyle = 'rgba(255,79,184,0.95)';
        ctx.fillText('CRASH', bx + 48 * s, by - 6 * s);
      } else if (on) {
        glowRect(ctx, bx + 10 * s, by - 18 * s, 76 * s, 4 * s, [255, 210, 74], 0.9);
      }
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 1;
    }
    // Découverte : le chat sur un toit, yeux brillants.
    if (egg(env, 42, 0.6)) {
      const cy = layerY(env, altitude(env, 8, 0.32), 0.32);
      if (cy > -40 && cy < env.h + 40 && reveal(env, 8) > 0.5) {
        const cx = sx(env, 150);
        ctx.fillStyle = '#0C0820';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 7 * s, 5 * s, 0, 0, TAU);
        ctx.arc(cx + 6 * s, cy - 6 * s, 4 * s, 0, TAU);
        ctx.moveTo(cx + 3 * s, cy - 9 * s);
        ctx.lineTo(cx + 4 * s, cy - 13 * s);
        ctx.lineTo(cx + 6 * s, cy - 10 * s);
        ctx.moveTo(cx + 7 * s, cy - 10 * s);
        ctx.lineTo(cx + 9 * s, cy - 13 * s);
        ctx.lineTo(cx + 9.5 * s, cy - 9 * s);
        ctx.fill();
        const blink = motion && t % 4 < 0.15;
        if (!blink) {
          glow(ctx, cx + 4.6 * s, cy - 6.5 * s, 2.5 * s, [180, 255, 120], 1);
          glow(ctx, cx + 7.6 * s, cy - 6.5 * s, 2.5 * s, [180, 255, 120], 1);
        }
      }
    }
    // Trafic aérien (18–30 étages) : voitures volantes et leurs traînées.
    for (let k = 0; k < 6; k++) {
      const y = layerY(env, altitude(env, 18 + k * 2.2, 0.5), 0.5);
      const seen = reveal(env, 18 + k * 2.2);
      if (y < -30 || y > env.h + 30 || seen <= 0) continue;
      ctx.globalAlpha = seen;
      const dir = k % 2 === 0 ? 1 : -1;
      const speed = 40 + hash(k, 3) * 40;
      const span = env.w + 120;
      const x = motion ? (dir > 0 ? ((t * speed + k * 97) % span) - 60 : env.w + 60 - ((t * speed + k * 97) % span)) : hash(k, 5) * env.w;
      car(ctx, x, y, s, dir, SIGNS[k % SIGNS.length]!);
    }
    ctx.globalAlpha = 1;
    // Dirigeable à écran (vers 26 étages) et, parfois, un drone à pizza.
    const zy = layerY(env, altitude(env, 26, 0.42), 0.42);
    if (zy > -80 && zy < env.h + 80 && reveal(env, 26) > 0) {
      ctx.globalAlpha = reveal(env, 26);
      const zx = sx(env, motion ? 160 - ((t * 4) % 320) : 60);
      ctx.fillStyle = '#3A3266';
      ctx.beginPath();
      ctx.ellipse(zx, zy, 48 * s, 15 * s, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2A2350';
      ctx.fillRect(zx - 10 * s, zy + 13 * s, 20 * s, 6 * s);
      const c = SIGNS[Math.floor((motion ? t / 2 : 0) % SIGNS.length)]!;
      glowRect(ctx, zx - 28 * s, zy - 5 * s, 56 * s, 9 * s, c, 0.75);
      ctx.globalAlpha = 1;
    }
    if (egg(env, 43, 0.5)) {
      const dy = layerY(env, altitude(env, 22, 0.5), 0.5);
      if (dy > -40 && dy < env.h + 40 && reveal(env, 22) > 0.5) {
        const dx = sx(env, motion ? -150 + ((t * 18) % 300) : -60);
        ctx.fillStyle = '#C8C8DA';
        ctx.fillRect(dx - 10 * s, dy - 3 * s, 20 * s, 3 * s);
        for (const ox of [-10, 10]) {
          ctx.fillStyle = 'rgba(220,220,240,0.6)';
          ctx.fillRect(dx + ox * s - 6 * s, dy - 6 * s, 12 * s, 1.2 * s);
        }
        ctx.fillStyle = '#E8B04A';
        ctx.beginPath();
        ctx.moveTo(dx - 7 * s, dy + 2 * s);
        ctx.lineTo(dx + 7 * s, dy + 2 * s);
        ctx.lineTo(dx, dy + 13 * s);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#D8442E';
        ctx.beginPath();
        ctx.arc(dx - 1.5 * s, dy + 5 * s, 1.6 * s, 0, TAU);
        ctx.arc(dx + 2 * s, dy + 7 * s, 1.4 * s, 0, TAU);
        ctx.fill();
      }
    }
    // Au-dessus des nuages (35 étages), éclairés par la ville en dessous.
    const cy = layerY(env, altitude(env, 34, 0.5), 0.5);
    if (cy > -100 && cy < env.h + 120) {
      for (let k = 0; k < 6; k++) cloud(ctx, sx(env, -180 + k * 72), cy + hash(k, 77) * 30, s * (1.1 + hash(k, 78) * 0.4), [110, 80, 170], 0.9, [255, 79, 184]);
    }
  },
  near(env: SceneEnv) {
    const rain = 1 - fade(env, 12, 20);
    if (rain > 0.02) {
      drifters(env, 34, 501, (ctx, x, y) => {
        ctx.strokeStyle = `rgba(180,200,255,${(0.35 * rain).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + 11);
        ctx.stroke();
      }, { x: -40, y: 260 });
    }
    const sparks = fade(env, 20, 28);
    if (sparks > 0.02) {
      drifters(env, 10, 533, (ctx, x, y, i) => {
        glow(ctx, x, y, 4, SIGNS[i % SIGNS.length]!, 0.45 * sparks);
      }, { x: 4, y: -8 });
    }
  },
  ground(env: SceneEnv, top: number) {
    const { ctx, w, h, t, motion } = env;
    if (top >= h) return;
    // Rue mouillée : reflets des enseignes qui ondulent.
    ctx.fillStyle = '#120C26';
    ctx.fillRect(0, top, w, h - top);
    ctx.fillStyle = '#2A2350';
    ctx.fillRect(0, top, w, Math.min(5, h - top));
    for (let k = 0; k < 8; k++) {
      const x = hash(k, 61) * w;
      const c = SIGNS[k % SIGNS.length]!;
      const g = ctx.createLinearGradient(0, top + 6, 0, h);
      g.addColorStop(0, css(c, 0.45));
      g.addColorStop(1, css(c, 0));
      ctx.fillStyle = g;
      const wob = motion ? Math.sin(t * 2 + k) * 2 : 0;
      ctx.fillRect(x + wob, top + 6, 6 + hash(k, 62) * 10, h - top - 6);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let x = 0; x < w; x += 46) ctx.fillRect(x + 8, top + 14, 22, 2);
  },
};

export const cite: Theme = {
  id: 'cite',
  name: 'Cité néon',
  rarity: 'legendaire',
  blocks: BLOCKS,
  sparks: ['#FF4FB8', '#3FE0FF', '#FFD24A'].map(hex),
  ground: { top: hex('#2A2350'), body: hex('#120C26') },
  audio: { wave: 'square', root: 329.63, scale: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24] },
  scene,
  tiers: [
    {
      name: 'Rue', skyTop: hex('#1A1035'), skyBottom: hex('#3A1E5C'), ink: CREAM,
      decor: (ctx, it, t, motion) => glow(ctx, 0, 0, 5 + it.r2 * 5, SIGNS[Math.floor(it.r1 * SIGNS.length)]!, motion ? 0.35 + 0.25 * Math.sin(t * 2 + it.r3 * 9) : 0.45),
    },
    {
      name: 'Fenêtres allumées', skyTop: hex('#160D32'), skyBottom: hex('#36205C'), ink: CREAM,
      decor: (ctx, it) => {
        ctx.fillStyle = 'rgba(255,220,150,0.55)';
        for (let k = 0; k < 3; k++) ctx.fillRect(-8 + k * 6, -3 + (it.r1 * 4), 3.5, 4.5);
      },
    },
    {
      name: 'Toits', skyTop: hex('#120A2C'), skyBottom: hex('#2E1E5A'), ink: CREAM,
      decor: (ctx, it, t, motion) => glow(ctx, 0, 0, 4, [255, 60, 60], motion ? (Math.sin(t * 2.5 + it.r1 * 9) > 0.2 ? 0.8 : 0.15) : 0.6),
    },
    {
      name: 'Trafic aérien', skyTop: hex('#0E0A28'), skyBottom: hex('#26245E'), ink: CREAM,
      decor: (ctx, it, t, motion) => {
        const c = SIGNS[Math.floor(it.r1 * SIGNS.length)]!;
        glow(ctx, motion ? Math.sin(t * 0.8 + it.r2 * 9) * 10 : 0, 0, 5, c, 0.7);
      },
    },
    {
      name: 'Au-dessus des nuages', skyTop: hex('#0A0A24'), skyBottom: hex('#3A2A6A'), ink: CREAM,
      decor: (ctx, it, t, motion) => star(ctx, 2 + it.r2 * 3, CREAM, twinkle(it, t, motion, 0.7)),
    },
    {
      name: 'Anneau orbital', skyTop: hex('#05061A'), skyBottom: hex('#1E1448'), ink: CREAM,
      decor: (ctx, it, t, motion) => star(ctx, 3 + it.r2 * 4, mix(CREAM, [180, 200, 255], it.r1), twinkle(it, t, motion, 0.8)),
    },
  ],
};
