/**
 * Récif (Épique, V6) : une ascension depuis le fond marin. Jardin de coraux, eaux turquoise
 * (une tortue passe), la surface franchie vers 20 étages, le grand large et son phare, puis une
 * aurore sur la mer. Découvertes : une pieuvre qui salue, une bouteille à la mer, une baleine.
 */
import { CREAM, INK, css, hex, mix, type Rgb } from '../color';
import {
  altitude, byStage, cloud, drifters, egg, fade, hash, layerY, orb, rays, reveal, ridge, silhouette, starfield, sx, TAU,
  type Scene, type SceneEnv,
} from '../scene';
import type { Theme } from '../theme-types';
import { bird, fish, glow, puff } from './kit';

const BLOCKS = ['#FF7F6E', '#3FD0C8', '#FFC85A', '#7A8CFF', '#FF9FCB', '#58C46E'].map(hex);
const CORALS: readonly Rgb[] = [[255, 120, 110], [255, 170, 90], [255, 140, 190], [140, 120, 255]];

/** La surface : à cette altitude, on quitte l'eau. */
const SURFACE = 20;

function coral(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c: Rgb, kind: number, sway: number): void {
  ctx.fillStyle = css(c);
  ctx.strokeStyle = css(c);
  ctx.lineCap = 'round';
  if (kind === 0) {
    // Corail branchu.
    ctx.lineWidth = 3.2 * s;
    const branch = (bx: number, by: number, len: number, a: number, depth: number) => {
      const ex = bx + Math.cos(a) * len + sway * depth;
      const ey = by + Math.sin(a) * len;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      if (depth < 3) {
        branch(ex, ey, len * 0.7, a - 0.5, depth + 1);
        branch(ex, ey, len * 0.7, a + 0.45, depth + 1);
      }
    };
    branch(x, y, 14 * s, -Math.PI / 2, 0);
  } else if (kind === 1) {
    // Éventail.
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x + sway, y - 4 * s, 20 * s, Math.PI * 1.1, Math.PI * 1.9);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    // Cerveau / boule.
    ctx.beginPath();
    ctx.ellipse(x, y - 7 * s, 13 * s, 9 * s, 0, Math.PI, TAU);
    ctx.fill();
  }
}

function jelly(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, alpha: number): void {
  ctx.fillStyle = `rgba(255,170,230,${(0.55 * alpha).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(x, y, 9 * s, 7 * s, 0, Math.PI, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,190,240,${(0.5 * alpha).toFixed(3)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = -2; k <= 2; k++) {
    ctx.moveTo(x + k * 3 * s, y);
    ctx.quadraticCurveTo(x + k * 3 * s + Math.sin(t * 2 + k) * 3 * s, y + 8 * s, x + k * 3 * s, y + 15 * s);
  }
  ctx.stroke();
}

const scene: Scene = {
  far(env: SceneEnv) {
    const { ctx, w, h, t, motion } = env;
    const under = 1 - fade(env, SURFACE - 1, SURFACE + 2);
    // Sous l'eau : rayons de lumière qui ondulent, plus forts près de la surface.
    if (under > 0) rays(env, [180, 240, 255], 0.22 * under * (0.5 + fade(env, 0, SURFACE) * 0.6), 6, 7);
    // Une baleine lointaine passe (découverte).
    if (under > 0 && egg(env, 31, 0.55)) {
      const k = fade(env, 6, 9) * (1 - fade(env, 14, 17));
      if (k > 0) {
        const x = motion ? w * 1.2 - ((t * 9) % (w * 1.6)) : w * 0.6;
        ctx.fillStyle = `rgba(10,40,70,${(0.45 * k).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(x, h * 0.3, 70, 20, 0, 0, TAU);
        ctx.moveTo(x + 60, h * 0.3);
        ctx.lineTo(x + 100, h * 0.3 - 18);
        ctx.lineTo(x + 96, h * 0.3 + 14);
        ctx.fill();
      }
    }
    // Au-dessus de l'eau : soleil et nuages, puis la nuit et son aurore.
    const above = fade(env, SURFACE, SURFACE + 3);
    const night = fade(env, 42, 52);
    if (above > 0) {
      orb(ctx, w * 0.8, h * 0.18, 24, [255, 246, 220], 1.2, above * (1 - night));
      for (let k = 0; k < 3; k++) cloud(ctx, w * (0.15 + k * 0.32), h * (0.12 + hash(k, 5) * 0.1), 0.9 + hash(k, 6) * 0.4, [255, 255, 255], 0.75 * above * (1 - night));
    }
    if (night > 0) {
      starfield(env, 70, night, 211);
      orb(ctx, w * 0.22, h * 0.16, 15, [235, 240, 255], 0.9, night);
      for (let k = 0; k < 3; k++) {
        const g = ctx.createLinearGradient(0, h * 0.05, 0, h * 0.5);
        g.addColorStop(0, 'rgba(180,120,255,0)');
        g.addColorStop(0.3, `rgba(120,255,190,${(0.28 * night).toFixed(3)})`);
        g.addColorStop(1, 'rgba(120,255,190,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        const x0 = w * (0.1 + k * 0.3);
        ctx.moveTo(x0, h * 0.05);
        for (let x = 0; x <= w * 0.4; x += 12) ctx.lineTo(x0 + x, h * 0.08 + Math.sin(x * 0.03 + k + (motion ? t * 0.4 : 0)) * 14);
        ctx.lineTo(x0 + w * 0.4, h * 0.5);
        ctx.lineTo(x0, h * 0.5);
        ctx.closePath();
        ctx.fill();
      }
    }
  },
  back(env: SceneEnv) {
    const { ctx, t, motion } = env;
    const s = env.scale;
    // Arches rocheuses lointaines.
    const rock = byStage(env, [[16, 70, 100], [20, 84, 116], [30, 110, 140], [40, 120, 150], [60, 110, 140], [20, 40, 70]]);
    silhouette(env, 0.12, 0, (x) => 70 + 45 * ridge(x, 61, 0.012), css(rock, 0.85));
    // Récif : bancs de corail et algues qui ondulent.
    const reefY = layerY(env, 10, 0.35);
    if (reefY < env.h + 80 && reefY > -200) {
      silhouette(env, 0.35, 0, (x) => 14 + 8 * ridge(x, 62, 0.03), css(byStage(env, [[24, 60, 80], [26, 70, 90], [30, 80, 100], [30, 80, 100], [30, 80, 100], [20, 40, 60]])));
      for (let k = 0; k < 11; k++) {
        const x = -200 + k * 38 + hash(k, 90) * 12;
        const y = layerY(env, 14 + 8 * ridge(x, 62, 0.03), 0.35);
        coral(ctx, sx(env, x), y, s, CORALS[k % CORALS.length]!, k % 3, motion ? Math.sin(t * 0.9 + k) * 2 * s : 0);
      }
      ctx.strokeStyle = 'rgba(80,190,120,0.75)';
      ctx.lineWidth = 2.2 * s;
      for (let k = 0; k < 9; k++) {
        const x = sx(env, -185 + k * 46);
        const y = layerY(env, 12, 0.35);
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 1; j <= 5; j++) ctx.lineTo(x + Math.sin(j * 0.9 + (motion ? t * 1.2 : 0) + k) * 4 * s, y - j * 9 * s);
        ctx.stroke();
      }
      if (egg(env, 32, 0.5)) {
        // Pieuvre qui salue depuis le corail.
        const ox = sx(env, 100);
        const oy = layerY(env, 26, 0.35);
        ctx.fillStyle = '#C86BD8';
        ctx.beginPath();
        ctx.ellipse(ox, oy, 9 * s, 10 * s, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#C86BD8';
        ctx.lineWidth = 2.4 * s;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.moveTo(ox - 6 * s + k * 4 * s, oy + 7 * s);
          ctx.quadraticCurveTo(ox - 8 * s + k * 5 * s, oy + 16 * s, ox - 10 * s + k * 6 * s + (k === 3 && motion ? Math.sin(t * 6) * 5 * s : 0), oy + (k === 3 ? 2 : 18) * s);
          ctx.stroke();
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(ox - 4 * s, oy - 3 * s, 2.5 * s, 2.5 * s);
        ctx.fillRect(ox + 2 * s, oy - 3 * s, 2.5 * s, 2.5 * s);
      }
    }
    // Tortue de mer, croisée vers 12 étages.
    const ty = layerY(env, altitude(env, 12, 0.45), 0.45);
    const turtleSeen = reveal(env, 12);
    if (ty > -60 && ty < env.h + 60 && turtleSeen > 0) {
      ctx.globalAlpha = turtleSeen;
      const tx = sx(env, motion ? 200 - ((t * 7) % 400) : 40);
      const fl = motion ? Math.sin(t * 2) * 0.5 : 0.2;
      ctx.fillStyle = '#4E9A6A';
      ctx.save();
      ctx.translate(tx, ty);
      for (const [dx, dy, a] of [[-8, -7, -0.6 + fl], [-8, 7, 0.6 - fl], [8, -6, -0.4 - fl], [8, 6, 0.4 + fl]] as const) {
        ctx.save();
        ctx.translate(dx * s, dy * s);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(-4 * s, 0, 7 * s, 2.6 * s, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#7A5A3A';
      ctx.beginPath();
      ctx.ellipse(0, 0, 13 * s, 9 * s, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,230,180,0.35)';
      ctx.beginPath();
      ctx.ellipse(-2 * s, -2 * s, 6 * s, 4 * s, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#4E9A6A';
      ctx.beginPath();
      ctx.arc(-15 * s, 0, 4 * s, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // La surface : une ligne d'eau scintillante franchie vers 20 étages.
    const wy = layerY(env, altitude(env, SURFACE, 0.6), 0.6);
    const surfaceSeen = reveal(env, SURFACE);
    if (wy > -40 && wy < env.h + 40 && surfaceSeen > 0) {
      ctx.globalAlpha = surfaceSeen;
      ctx.fillStyle = 'rgba(200,245,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(0, wy + 6);
      for (let x = 0; x <= env.w + 10; x += 10) ctx.lineTo(x, wy + Math.sin(x * 0.06 + (motion ? t * 2 : 0)) * 3);
      ctx.lineTo(env.w, wy + 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x <= env.w + 10; x += 10) ctx.lineTo(x, wy + Math.sin(x * 0.06 + (motion ? t * 2 : 0)) * 3);
      ctx.stroke();
      if (egg(env, 33, 0.6)) {
        // Bouteille à la mer qui danse sur l'eau.
        const bx = sx(env, -110);
        const bob = motion ? Math.sin(t * 2) * 3 : 0;
        ctx.save();
        ctx.translate(bx, wy - 4 + bob);
        ctx.rotate(-0.4);
        ctx.fillStyle = 'rgba(120,200,160,0.85)';
        ctx.fillRect(-9 * s, -4 * s, 15 * s, 8 * s);
        ctx.fillRect(6 * s, -2 * s, 5 * s, 4 * s);
        ctx.fillStyle = '#FFF4DB';
        ctx.fillRect(-6 * s, -2 * s, 8 * s, 4 * s);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // Grand large : île et phare lointains, mouettes.
    const isle = layerY(env, altitude(env, 32, 0.25), 0.25);
    if (isle > -80 && isle < env.h + 120 && reveal(env, 32) > 0) {
      ctx.globalAlpha = reveal(env, 32);
      const night = fade(env, 44, 52);
      ctx.fillStyle = css(mix([60, 110, 120], [20, 30, 50], night));
      ctx.beginPath();
      ctx.ellipse(sx(env, 130), isle, 70 * s, 16 * s, 0, Math.PI, TAU);
      ctx.fill();
      const lx = sx(env, 130);
      ctx.fillStyle = '#FFF4DB';
      ctx.fillRect(lx - 4 * s, isle - 46 * s, 8 * s, 34 * s);
      ctx.fillStyle = '#FF665E';
      ctx.fillRect(lx - 4 * s, isle - 38 * s, 8 * s, 6 * s);
      ctx.fillRect(lx - 4 * s, isle - 24 * s, 8 * s, 6 * s);
      const beam = motion ? (t * 0.8) % TAU : 0.6;
      glow(ctx, lx, isle - 50 * s, 10 * s, [255, 240, 160], 0.9);
      if (night > 0) {
        ctx.fillStyle = `rgba(255,240,160,${(0.18 * night).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(lx, isle - 50 * s);
        ctx.lineTo(lx + Math.cos(beam) * 260, isle - 50 * s + Math.sin(beam) * 20 - 14);
        ctx.lineTo(lx + Math.cos(beam) * 260, isle - 50 * s + Math.sin(beam) * 20 + 14);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  },
  near(env: SceneEnv) {
    const under = 1 - fade(env, SURFACE - 1, SURFACE + 1);
    if (under > 0.02) {
      drifters(env, 18, 301, (ctx, x, y, i) => {
        const r = 1.5 + (i % 4);
        ctx.strokeStyle = `rgba(210,250,255,${(0.6 * under).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x + (env.motion ? Math.sin(env.t * 2 + i) * 2 : 0), y, r, 0, TAU);
        ctx.stroke();
      }, { x: 0, y: -28 });
      drifters(env, 10, 333, (ctx, x, y, i) => {
        ctx.save();
        ctx.translate(x, y);
        fish(ctx, 10 + (i % 3) * 3, CORALS[i % CORALS.length]!, 0.75 * under, env.motion ? Math.sin(env.t * 8 + i) * 1.5 : 0);
        ctx.restore();
      }, { x: 22, y: 2 });
    }
    const air = fade(env, SURFACE + 2, SURFACE + 6) * (1 - fade(env, 44, 50));
    if (air > 0.02) {
      drifters(env, 6, 377, (ctx, x, y, i) => {
        ctx.save();
        ctx.translate(x, y);
        bird(ctx, 1.1, env.motion ? Math.sin(env.t * 5 + i) * 3 : 1, [250, 250, 255], 0.85 * air);
        ctx.restore();
      }, { x: 18, y: 1 });
    }
  },
  ground(env: SceneEnv, top: number) {
    const { ctx, w, h } = env;
    if (top >= h) return;
    ctx.fillStyle = '#E8D3A2';
    ctx.fillRect(0, top, w, h - top);
    ctx.fillStyle = '#F4E4BC';
    ctx.beginPath();
    ctx.moveTo(0, top + 4);
    for (let x = 0; x <= w + 20; x += 20) ctx.quadraticCurveTo(x + 10, top - 3, x + 20, top + 4);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    for (let k = 0; k < 9; k++) {
      const x = hash(k, 41) * w;
      const y = top + 12 + hash(k, 42) * Math.max(0, h - top - 16);
      if (y > h) continue;
      if (k % 3 === 0) {
        ctx.fillStyle = '#FF8A6E';
        ctx.beginPath();
        for (let j = 0; j < 10; j++) {
          const a = (j / 10) * TAU;
          const r = j % 2 === 0 ? 6 : 2.6;
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,240,230,0.9)';
        ctx.beginPath();
        ctx.ellipse(x, y, 4, 3, 0, Math.PI, TAU);
        ctx.fill();
      }
    }
  },
};

export const recif: Theme = {
  id: 'recif',
  name: 'Récif',
  rarity: 'epique',
  blocks: BLOCKS,
  sparks: ['#FFF4DB', '#3FD0C8', '#FFC85A'].map(hex),
  ground: { top: hex('#F4E4BC'), body: hex('#E8D3A2') },
  audio: { wave: 'sine', root: 349.23, scale: [0, 2, 5, 7, 9, 12, 14, 17, 19, 21, 24] },
  scene,
  tiers: [
    {
      name: 'Fond marin', skyTop: hex('#08605A'), skyBottom: hex('#08304A'), ink: CREAM,
      decor: (ctx, it, t, motion) => {
        ctx.strokeStyle = 'rgba(210,250,255,0.5)';
        ctx.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(k * 5 - 5, -k * 7 + (motion ? -((t * 10 + it.r1 * 30) % 20) : 0), 1.5 + it.r2 * 2, 0, TAU);
          ctx.stroke();
        }
      },
    },
    {
      name: 'Jardin de coraux', skyTop: hex('#11638A'), skyBottom: hex('#0B3D5E'), ink: CREAM,
      decor: (ctx, it, t, motion) => fish(ctx, 12 + it.r2 * 6, CORALS[Math.floor(it.r1 * CORALS.length)]!, 0.75, motion ? Math.sin(t * 8 + it.r3 * 9) * 1.5 : 0),
    },
    {
      name: 'Eaux turquoise', skyTop: hex('#1C93B4'), skyBottom: hex('#0F607F'), ink: CREAM,
      decor: (ctx, it, t, motion) => jelly(ctx, 0, motion ? Math.sin(t + it.r1 * 6) * 4 : 0, 0.9 + it.r2 * 0.5, motion ? t : 0, 0.85),
    },
    {
      name: 'Surface', skyTop: hex('#86D6F2'), skyBottom: hex('#2FA8CC'), ink: INK,
      decor: (ctx, it) => puff(ctx, 0.6 + it.r2 * 0.4, [255, 255, 255], 0.7),
    },
    {
      name: 'Grand large', skyTop: hex('#6EC1F0'), skyBottom: hex('#CFF0FF'), ink: INK,
      decor: (ctx, it, t, motion) => bird(ctx, 1, motion ? Math.sin(t * 5 + it.r1 * 9) * 3 : 1, [255, 255, 255], 0.8),
    },
    {
      name: 'Aurore marine', skyTop: hex('#0B1438'), skyBottom: hex('#1F4A6E'), ink: CREAM,
      decor: (ctx, it, t, motion) => glow(ctx, 0, 0, 6 + it.r2 * 6, [140, 255, 200], motion ? 0.35 + 0.3 * Math.sin(t * 1.5 + it.r1 * 9) : 0.5),
    },
  ],
};
