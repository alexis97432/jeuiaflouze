/**
 * Confiserie (Commun) : un village sucré, puis des collines de guimauve, une pluie de
 * vermicelles, une fête des ballons, un coucher caramel et une nuit bonbon sous une lune en
 * chocolat croquée. Découvertes : un ourson en gomme sur un nuage, une fusée-cupcake.
 */
import { CREAM, INK, css, hex, lighten, mix, roundedRect, type Rgb } from '../color';
import {
  altitude, byStage, cloud, drifters, egg, fade, hash, layerY, orb, reveal, ridge, silhouette, starfield, sx, TAU,
  type Scene, type SceneEnv,
} from '../scene';
import type { Theme } from '../theme-types';
import { balloon, puff, star, twinkle } from './kit';

const BLOCKS = ['#FF665E', '#62DEBF', '#8B75ED', '#FFB840', '#FF7FB0', '#4FB3F0'].map(hex);

function lollipop(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: Rgb, spin: number): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2.2 * s;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 22 * s);
  ctx.stroke();
  ctx.fillStyle = css(color);
  ctx.beginPath();
  ctx.arc(x, y - 28 * s, 9 * s, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  for (let a = 0; a < TAU * 2.2; a += 0.3) {
    const r = (a / (TAU * 2.2)) * 8 * s;
    const px = x + Math.cos(a + spin) * r;
    const py = y - 28 * s + Math.sin(a + spin) * r;
    if (a === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function gingerHouse(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = '#C98A55';
  ctx.fillRect(x - 12 * s, y - 16 * s, 24 * s, 16 * s);
  ctx.fillStyle = '#FFF4F8';
  ctx.beginPath();
  ctx.moveTo(x - 15 * s, y - 15 * s);
  ctx.lineTo(x, y - 29 * s);
  ctx.lineTo(x + 15 * s, y - 15 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FF7FB0';
  ctx.fillRect(x - 3.5 * s, y - 9 * s, 7 * s, 9 * s);
  ctx.fillStyle = '#FFE27A';
  ctx.fillRect(x + 5 * s, y - 12 * s, 4 * s, 4 * s);
  ctx.fillRect(x - 9 * s, y - 12 * s, 4 * s, 4 * s);
}

function chocolateMoon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number): void {
  ctx.save();
  // Morceau croqué : la lune est découpée par un disque (règle pair-impair), le ciel reste visible.
  ctx.beginPath();
  ctx.rect(x - r * 4, y - r * 4, r * 8, r * 8);
  ctx.arc(x + r * 0.95, y - r * 0.2, r * 0.42, 0, TAU);
  ctx.clip('evenodd');
  orb(ctx, x, y, r, [122, 72, 44], 0.6, alpha);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(160,104,70,0.9)';
  for (const [dx, dy, rr] of [[-0.35, -0.3, 0.16], [-0.1, 0.35, 0.12], [0.25, -0.1, 0.1]] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, rr * r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function candyPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number, spin: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  ctx.fillStyle = '#FF9AC6';
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let k = -3; k < 4; k++) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.5);
    ctx.fillRect(-r * 1.5, k * r * 0.34 + ((spin * 4) % (r * 0.68)), r * 3, r * 0.12);
    ctx.restore();
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = alpha * 0.9;
  ctx.strokeStyle = '#FFE27A';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.8, r * 0.42, -0.35, 0.15 * Math.PI, 0.85 * Math.PI, true);
  ctx.stroke();
  ctx.restore();
}

function gummyBear(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, wave: number): void {
  ctx.fillStyle = 'rgba(120,220,130,0.92)';
  ctx.beginPath();
  ctx.ellipse(x, y, 7 * s, 9 * s, 0, 0, TAU);
  ctx.arc(x, y - 12 * s, 6 * s, 0, TAU);
  ctx.arc(x - 5 * s, y - 17 * s, 2.4 * s, 0, TAU);
  ctx.arc(x + 5 * s, y - 17 * s, 2.4 * s, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(x + 7 * s, y - 4 * s);
  ctx.rotate(-1.1 + wave);
  ctx.beginPath();
  ctx.ellipse(0, -5 * s, 2.4 * s, 5 * s, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(30,60,30,0.8)';
  ctx.fillRect(x - 2.6 * s, y - 13.5 * s, 1.2 * s, 1.2 * s);
  ctx.fillRect(x + 1.6 * s, y - 13.5 * s, 1.2 * s, 1.2 * s);
}

function cupcakeRocket(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.5);
  ctx.fillStyle = 'rgba(255,170,60,0.85)';
  ctx.beginPath();
  ctx.moveTo(-6 * s, 12 * s);
  ctx.lineTo(0, 22 * s + Math.sin(t * 30) * 3 * s);
  ctx.lineTo(6 * s, 12 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4FB3F0';
  ctx.beginPath();
  ctx.moveTo(-8 * s, 0);
  ctx.lineTo(8 * s, 0);
  ctx.lineTo(6 * s, 12 * s);
  ctx.lineTo(-6 * s, 12 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFE0EE';
  ctx.beginPath();
  ctx.arc(-4 * s, -1 * s, 5 * s, 0, TAU);
  ctx.arc(4 * s, -1 * s, 5 * s, 0, TAU);
  ctx.arc(0, -6 * s, 6 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#E5374F';
  ctx.beginPath();
  ctx.arc(0, -12 * s, 2.6 * s, 0, TAU);
  ctx.fill();
  ctx.restore();
}

const scene: Scene = {
  far(env: SceneEnv) {
    const { ctx, w, h } = env;
    const night = fade(env, 42, 52);
    const dusk = fade(env, 27, 38) * (1 - night);
    orb(ctx, w * 0.78, h * (0.17 + dusk * 0.3), 24 + dusk * 20, mix([255, 248, 226], [255, 160, 90], dusk), 1, 1 - night);
    const planet = fade(env, 30, 42);
    if (planet > 0) candyPlanet(ctx, w * 0.17, h * 0.33, 20, planet, env.motion ? env.t : 0);
    if (night > 0) {
      starfield(env, 70, night, 11);
      chocolateMoon(ctx, w * 0.26, h * 0.17, 28, night);
      if (env.motion && env.full) {
        // Étoile filante : un passage toutes les 7 s.
        const p = (env.t % 7) / 1.1;
        if (p < 1) {
          const x = w * (0.9 - p * 0.6);
          const y = h * (0.08 + p * 0.18);
          const g = ctx.createLinearGradient(x, y, x + 60, y - 18);
          g.addColorStop(0, `rgba(255,250,235,${(night * (1 - p)).toFixed(3)})`);
          g.addColorStop(1, 'rgba(255,250,235,0)');
          ctx.strokeStyle = g;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 60, y - 18);
          ctx.stroke();
        }
      }
    }
  },
  back(env: SceneEnv) {
    const { ctx } = env;
    // Montagnes de guimauve, au loin.
    const far = byStage(env, [[255, 226, 238], [255, 214, 232], [255, 210, 228], [226, 200, 250], [255, 186, 160], [120, 80, 170]]);
    silhouette(env, 0.12, 0, (x) => 70 + 50 * ridge(x, 3, 0.012) + 22 * Math.abs(Math.sin(x * 0.02)), css(far, 0.9));
    // Collines sucrées, sucettes et maisons en pain d'épice.
    const hill = byStage(env, [[247, 182, 206], [247, 176, 204], [240, 170, 206], [214, 166, 236], [240, 150, 130], [90, 60, 140]]);
    const hillH = (x: number) => 26 + 18 * ridge(x, 8, 0.02);
    silhouette(env, 0.3, 0, hillH, css(hill));
    const hillTop = layerY(env, 60, 0.3);
    if (hillTop < env.h + 40) {
      const s = env.scale * 0.9;
      for (const [x, kind, c] of [[-150, 'pop', 0], [-95, 'house', 0], [-30, 'pop', 3], [70, 'pop', 1], [125, 'house', 0], [175, 'pop', 4]] as const) {
        const X = sx(env, x);
        const Y = layerY(env, hillH(x) - 2, 0.3);
        if (kind === 'pop') lollipop(ctx, X, Y, s, BLOCKS[c]!, env.motion ? env.t * 0.6 + x : x);
        else gingerHouse(ctx, X, Y, s);
      }
    }
    // Nuages de barbe à papa : une première couche vers 10 étages, une seconde vers 24.
    for (const [floor, p, tint] of [[11, 0.5, [255, 240, 248]], [24, 0.5, [236, 222, 255]]] as const) {
      const y = layerY(env, altitude(env, floor, p), p);
      const seen = reveal(env, floor);
      if (y < -80 || y > env.h + 80 || seen <= 0) continue;
      for (let k = 0; k < 5; k++) {
        const drift = env.motion ? Math.sin(env.t * 0.15 + k) * 10 : 0;
        cloud(ctx, sx(env, -170 + k * 85 + hash(floor, k) * 30) + drift, y + hash(floor, k + 9) * 40 - 20, (0.9 + hash(floor, k + 3) * 0.6) * env.scale, tint, 0.85 * seen, [255, 180, 210]);
      }
      if (floor === 11 && egg(env, 1, 0.5)) {
        gummyBear(ctx, sx(env, 30), y - 20 * env.scale, env.scale, env.motion ? Math.sin(env.t * 5) * 0.4 : 0);
      }
    }
    // Montgolfière en sucre d'orge, atteinte vers 20 étages ; elle dérive lentement.
    const by = layerY(env, altitude(env, 20, 0.45), 0.45);
    const balloonSeen = reveal(env, 20);
    if (by > -120 && by < env.h + 60 && balloonSeen > 0) {
      const bx = sx(env, env.motion ? -140 + ((env.t * 5) % 280) : 90);
      const s = env.scale;
      ctx.globalAlpha = balloonSeen;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(bx, by - 30 * s, 22 * s, 27 * s, 0, 0, TAU);
      ctx.clip();
      for (let k = -3; k <= 3; k++) {
        ctx.fillStyle = k % 2 === 0 ? '#FF665E' : '#FFF4DB';
        ctx.fillRect(bx + k * 7 * s - 3.5 * s, by - 60 * s, 7 * s, 60 * s);
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(80,50,40,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx - 12 * s, by - 8 * s);
      ctx.lineTo(bx - 6 * s, by + 6 * s);
      ctx.moveTo(bx + 12 * s, by - 8 * s);
      ctx.lineTo(bx + 6 * s, by + 6 * s);
      ctx.stroke();
      ctx.fillStyle = '#B97A4A';
      roundedRect(ctx, bx - 7 * s, by + 6 * s, 14 * s, 9 * s, 2 * s);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Découverte : une fusée-cupcake traverse le ciel caramel.
    if (egg(env, 2, 0.5) && env.motion && reveal(env, 38) > 0.5) {
      const ry = layerY(env, altitude(env, 38, 0.35), 0.35);
      if (ry > -60 && ry < env.h + 60) {
        const p = (env.t % 12) / 12;
        cupcakeRocket(ctx, -40 + p * (env.w + 80), ry - p * 60, env.scale * 0.9, env.t);
      }
    }
  },
  near(env: SceneEnv) {
    const k = fade(env, 7, 11) * (1 - fade(env, 28, 34));
    if (k > 0.02) {
      drifters(env, 26, 77, (ctx, x, y, i, phase) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(phase * 6 + (env.motion ? env.t * (1 + phase) : 0));
        ctx.fillStyle = css(BLOCKS[i % BLOCKS.length]!, 0.7 * k);
        roundedRect(ctx, -4, -1.3, 8, 2.6, 1.3);
        ctx.fill();
        ctx.restore();
      }, { x: 8, y: 34 });
    }
    const night = fade(env, 44, 52);
    if (night > 0.02) {
      drifters(env, 14, 91, (ctx, x, y, i) => {
        const a = night * (env.motion ? 0.4 + 0.4 * Math.sin(env.t * 2 + i) : 0.6);
        ctx.fillStyle = `rgba(255,240,250,${a.toFixed(3)})`;
        ctx.fillRect(x, y, 1.6, 1.6);
      }, { x: 3, y: -6 });
    }
  },
  ground(env: SceneEnv, top: number) {
    const { ctx, w, h } = env;
    if (top >= h) return;
    const night = fade(env, 44, 52);
    const body = mix([247, 182, 206], [110, 70, 150], night);
    const icing = mix([255, 240, 246], [200, 170, 230], night);
    ctx.fillStyle = css(body);
    ctx.fillRect(0, top, w, h - top);
    // Glaçage qui coule sur le bord.
    ctx.fillStyle = css(icing);
    ctx.beginPath();
    ctx.moveTo(0, top);
    for (let x = 0; x <= w + 18; x += 18) {
      const drip = 6 + hash(Math.floor(x / 18), 4) * 10;
      ctx.lineTo(x, top + 4);
      ctx.quadraticCurveTo(x + 4, top + drip + 4, x + 9, top + 5);
    }
    ctx.lineTo(w, top);
    ctx.closePath();
    ctx.fill();
    for (let k = 0; k < 36; k++) {
      const x = hash(k, 21) * w;
      const y = top + 14 + hash(k, 22) * Math.max(0, h - top - 18);
      if (y > h) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(hash(k, 23) * 6);
      ctx.fillStyle = css(lighten(BLOCKS[k % BLOCKS.length]!, 0.1), 0.8);
      ctx.fillRect(-3, -1, 6, 2);
      ctx.restore();
    }
  },
};

export const confiserie: Theme = {
  id: 'confiserie',
  name: 'Confiserie',
  rarity: 'commun',
  blocks: BLOCKS,
  sparks: ['#FF665E', '#8B75ED', '#62DEBF', '#FFB840'].map(hex),
  ground: { top: hex('#FFD1E1'), body: hex('#F7B6CE') },
  audio: { wave: 'triangle', root: 523.25, scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24] },
  scene,
  tiers: [
    { name: 'Village sucré', skyTop: hex('#FFD1E4'), skyBottom: CREAM, ink: INK, decor: (ctx, it) => puff(ctx, 0.7 + it.r2 * 0.6, [255, 255, 255], 0.75) },
    {
      name: 'Collines de guimauve', skyTop: hex('#FFC6DE'), skyBottom: hex('#FFE9CF'), ink: INK,
      decor: (ctx, it, t, motion) => {
        // Bonbon emballé qui tourne doucement.
        const c = BLOCKS[Math.floor(it.r1 * BLOCKS.length)]!;
        ctx.rotate(it.r2 * 6 + (motion ? t * 0.5 : 0));
        ctx.fillStyle = css(c, 0.7);
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 5, 0, 0, TAU);
        ctx.moveTo(-6, 0);
        ctx.lineTo(-12, -5);
        ctx.lineTo(-12, 5);
        ctx.moveTo(6, 0);
        ctx.lineTo(12, -5);
        ctx.lineTo(12, 5);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(-3, -3, 2, 6);
      },
    },
    {
      name: 'Pluie de vermicelles', skyTop: hex('#FFC4DA'), skyBottom: hex('#FFE6C2'), ink: INK,
      decor: (ctx, it, t, motion) => {
        for (let k = 0; k < 5; k++) {
          const a = it.r1 * 10 + k * 1.7 + (motion ? t * 0.4 : 0);
          ctx.save();
          ctx.translate(Math.cos(k * 2.1 + it.r2 * 6) * 22, Math.sin(k * 1.3 + it.r3 * 6) * 16);
          ctx.rotate(a);
          ctx.fillStyle = css(BLOCKS[(k + Math.floor(it.r3 * 6)) % BLOCKS.length]!, 0.55);
          roundedRect(ctx, -5, -1.6, 10, 3.2, 1.6);
          ctx.fill();
          ctx.restore();
        }
      },
    },
    {
      name: 'Fête des ballons', skyTop: hex('#C6B2FF'), skyBottom: hex('#FFC4D8'), ink: INK,
      decor: (ctx, it, t, motion) => balloon(ctx, BLOCKS[Math.floor(it.r1 * BLOCKS.length)]!, motion ? Math.sin(t * 0.8 + it.r2 * 6) * 3 : 0, 0.65),
    },
    {
      name: 'Coucher caramel', skyTop: hex('#FF9F8E'), skyBottom: hex('#FFD596'), ink: INK,
      decor: (ctx, it, t, motion) => {
        // Cristaux de sucre qui brillent dans la lumière dorée.
        star(ctx, 3 + it.r2 * 4, [255, 248, 220], twinkle(it, t, motion, 0.75));
      },
    },
    {
      name: 'Nuit bonbon', skyTop: hex('#4B2F86'), skyBottom: hex('#C27AD6'), ink: CREAM,
      decor: (ctx, it, t, motion) => star(ctx, 4 + it.r2 * 5, CREAM, twinkle(it, t, motion, 0.8)),
    },
  ],
};
