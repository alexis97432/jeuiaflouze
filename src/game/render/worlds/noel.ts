/**
 * Veillée de Noël (Épique, V8, collection saisonnière) : un village de maisons à colombages sous la
 * neige, fenêtres dorées et fumée des cheminées ; le marché de Noël et son grand sapin ; l'atelier
 * illuminé et ses rouages ; la forêt hivernale, ses lanternes et le lac gelé des patineurs ; la neige
 * sur les cimes ; enfin la nuit claire de l'étoile du berger.
 *
 * Direction : nuit d'hiver chaude, pas un fond rouge et vert. Lumière dorée des fenêtres et des
 * lanternes contre la neige bleutée et le bois sombre ; verre givré, métal doré, bois sculpté.
 * Découvertes : un traîneau qui passe devant la lune, un bonhomme de neige à l'écharpe, un chat
 * à la fenêtre, un renard dans la forêt.
 */
import { CREAM, css, hex, mix, type Rgb } from '../color';
import {
  altitude, byStage, drifters, egg, fade, hash, layerY, orb, reveal, ridge, silhouette, sx, TAU,
  type Scene, type SceneEnv,
} from '../scene';
import type { Theme } from '../theme-types';
import { glow, ledge, puff, star, twinkle } from './kit';

const BLOCKS = ['#B23A32', '#2E6A4A', '#D8B060', '#E8E2D6', '#7A4A30', '#4A7A70'].map(hex);
const WARM: Rgb = [255, 196, 110];
const SNOW: Rgb = [232, 236, 240];
const BULBS: readonly Rgb[] = [[255, 196, 110], [255, 120, 80], [255, 236, 190], [140, 220, 160]];

/** Maison à colombages, toit enneigé, fenêtres dorées, cheminée ; renvoie le haut de la cheminée. */
function house(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, w: number, h: number, wall: Rgb, lit: number, cat: boolean): [number, number] {
  ctx.fillStyle = css(wall);
  ctx.fillRect(x - w / 2 * s, y - h * s, w * s, h * s);
  // Colombages.
  ctx.strokeStyle = css(mix(wall, [40, 26, 20], 0.65));
  ctx.lineWidth = 1.1 * s;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 * s, y - h * 0.5 * s);
  ctx.lineTo(x + w / 2 * s, y - h * 0.5 * s);
  ctx.moveTo(x - w / 4 * s, y - h * s);
  ctx.lineTo(x - w / 4 * s, y);
  ctx.moveTo(x + w / 4 * s, y - h * s);
  ctx.lineTo(x + w / 4 * s, y);
  ctx.stroke();
  // Toit pointu et neige qui déborde.
  ctx.fillStyle = '#3A2A24';
  ctx.beginPath();
  ctx.moveTo(x - (w / 2 + 4) * s, y - h * s);
  ctx.lineTo(x, y - (h + w * 0.55) * s);
  ctx.lineTo(x + (w / 2 + 4) * s, y - h * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(SNOW);
  ctx.beginPath();
  ctx.moveTo(x - (w / 2 + 5) * s, y - h * s + 1 * s);
  ctx.lineTo(x, y - (h + w * 0.55) * s - 1.5 * s);
  ctx.lineTo(x + (w / 2 + 5) * s, y - h * s + 1 * s);
  ctx.lineTo(x + (w / 2 + 2) * s, y - h * s + 3 * s);
  ctx.lineTo(x, y - (h + w * 0.55) * s + 3 * s);
  ctx.lineTo(x - (w / 2 + 2) * s, y - h * s + 3 * s);
  ctx.closePath();
  ctx.fill();
  // Fenêtres.
  for (const [fx, fy] of [[-w / 4 - 0.5, h * 0.72], [w / 4 + 0.5, h * 0.72], [-w / 4 - 0.5, h * 0.3], [w / 4 + 0.5, h * 0.3]] as const) {
    const on = lit * (hash(Math.round(x + fx * 7), Math.round(fy)) > 0.25 ? 1 : 0.15);
    ctx.fillStyle = on > 0.2 ? css(mix([60, 46, 40], WARM, on)) : '#2A2224';
    ctx.fillRect(x + (fx - 3) * s, y - (fy + 3) * s, 6 * s, 6 * s);
    if (on > 0.2) glow(ctx, x + fx * s, y - fy * s, 9 * s, WARM, 0.35 * on);
  }
  if (cat) {
    ctx.fillStyle = '#1A1416';
    ctx.beginPath();
    ctx.arc(x + (w / 4 + 0.5) * s, y - (h * 0.72 - 1.5) * s, 1.6 * s, 0, TAU);
    ctx.fill();
    ctx.fillRect(x + (w / 4 - 1) * s, y - (h * 0.72 + 0.6) * s, 0.8 * s, 1 * s);
    ctx.fillRect(x + (w / 4 + 1.2) * s, y - (h * 0.72 + 0.6) * s, 0.8 * s, 1 * s);
  }
  // Cheminée.
  const cx = x + w * 0.22 * s;
  const cy = y - (h + w * 0.32) * s;
  ctx.fillStyle = '#4A3A34';
  ctx.fillRect(cx - 2 * s, cy - 4 * s, 4 * s, 8 * s);
  ctx.fillStyle = css(SNOW);
  ctx.fillRect(cx - 2.4 * s, cy - 5 * s, 4.8 * s, 1.4 * s);
  return [cx, cy - 5 * s];
}

/** Sapin enneigé (option : lanterne ou décorations). */
function snowyFir(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, h: number, green: Rgb, deco: number, t: number): void {
  ctx.fillStyle = '#3A2A20';
  ctx.fillRect(x - 1.2 * s, y - 4 * s, 2.4 * s, 4 * s);
  for (let k = 0; k < 4; k++) {
    const base = y - 4 * s - k * h * 0.2 * s;
    const half = (h * 0.3 - k * h * 0.06) * s;
    ctx.fillStyle = css(green);
    ctx.beginPath();
    ctx.moveTo(x - half, base);
    ctx.lineTo(x, base - h * 0.34 * s);
    ctx.lineTo(x + half, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(SNOW, 0.9);
    ctx.beginPath();
    ctx.moveTo(x - half * 0.8, base - 1 * s);
    ctx.lineTo(x, base - h * 0.3 * s);
    ctx.lineTo(x + half * 0.3, base - h * 0.12 * s);
    ctx.closePath();
    ctx.fill();
  }
  if (deco > 0.02) {
    for (let k = 0; k < 10; k++) {
      const yy = y - 6 * s - hash(k, Math.round(x)) * h * 0.75 * s;
      const span = (1 - (y - yy) / (h * 1.05 * s)) * h * 0.26 * s;
      const xx = x + (hash(k + 20, Math.round(x)) - 0.5) * 2 * span;
      const on = 0.55 + 0.45 * Math.sin(t * 2.5 + k * 1.9);
      glow(ctx, xx, yy, 3.5 * s, BULBS[k % BULBS.length]!, deco * on);
    }
    // Étoile dorée au sommet.
    ctx.save();
    ctx.translate(x, y - (h * 0.98 + 4) * s);
    star(ctx, 3.4 * s, [255, 214, 120], deco);
    ctx.restore();
  }
}

/** Échoppe du marché : toit à rayures, guirlande d'ampoules. */
function stall(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, stripe: Rgb, t: number, motion: boolean): void {
  ctx.fillStyle = '#4A3428';
  ctx.fillRect(x - 16 * s, y - 14 * s, 32 * s, 14 * s);
  ctx.fillStyle = css(mix(WARM, [120, 70, 40], 0.4));
  ctx.fillRect(x - 13 * s, y - 11 * s, 26 * s, 7 * s);
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = k % 2 ? css(SNOW) : css(stripe);
    ctx.beginPath();
    ctx.moveTo(x - 18 * s + k * 6 * s, y - 14 * s);
    ctx.lineTo(x - 15 * s + k * 6 * s, y - 22 * s);
    ctx.lineTo(x - 12 * s + k * 6 * s, y - 14 * s);
    ctx.closePath();
    ctx.fill();
  }
  for (let k = 0; k < 7; k++) {
    const on = motion ? 0.5 + 0.5 * Math.sin(t * 3 + k * 1.3 + x) : 0.8;
    glow(ctx, x - 15 * s + k * 5 * s, y - 13 * s + Math.sin(k) * 0.8 * s, 3 * s, BULBS[k % BULBS.length]!, on);
  }
}

/** Atelier : grande façade et verrière cintrée dorée, rouages en ombre chinoise. */
function workshop(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, motion: boolean): void {
  ctx.fillStyle = '#3E2C24';
  ctx.fillRect(x - 70 * s, y - 70 * s, 140 * s, 70 * s);
  ctx.fillStyle = css(SNOW);
  ctx.fillRect(x - 74 * s, y - 74 * s, 148 * s, 5 * s);
  for (const fx of [-40, 0, 40]) {
    const X = x + fx * s;
    const g = ctx.createLinearGradient(0, y - 60 * s, 0, y - 12 * s);
    g.addColorStop(0, 'rgb(255,214,140)');
    g.addColorStop(1, 'rgb(230,140,60)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(X - 14 * s, y - 12 * s);
    ctx.lineTo(X - 14 * s, y - 48 * s);
    ctx.arc(X, y - 48 * s, 14 * s, Math.PI, 0);
    ctx.lineTo(X + 14 * s, y - 12 * s);
    ctx.closePath();
    ctx.fill();
    glow(ctx, X, y - 36 * s, 34 * s, WARM, 0.35);
    // Rouage qui tourne derrière la vitre.
    ctx.save();
    ctx.translate(X + 3 * s, y - 30 * s);
    ctx.rotate(motion ? t * (fx === 0 ? 0.6 : -0.9) : 0.3);
    ctx.fillStyle = 'rgba(90,50,26,0.75)';
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      ctx.lineTo(Math.cos(a) * 9 * s, Math.sin(a) * 9 * s);
      ctx.lineTo(Math.cos(a + 0.2) * 11.5 * s, Math.sin(a + 0.2) * 11.5 * s);
      ctx.lineTo(Math.cos(a + 0.43) * 11.5 * s, Math.sin(a + 0.43) * 11.5 * s);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Croisillons de la verrière.
    ctx.strokeStyle = '#3E2C24';
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.moveTo(X, y - 62 * s);
    ctx.lineTo(X, y - 12 * s);
    ctx.moveTo(X - 14 * s, y - 34 * s);
    ctx.lineTo(X + 14 * s, y - 34 * s);
    ctx.stroke();
  }
}

function sleigh(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  ctx.fillStyle = 'rgba(20,18,22,0.92)';
  for (let k = 0; k < 3; k++) {
    const X = x + 16 * s + k * 13 * s;
    const hop = Math.sin(t * 6 + k) * 1.2 * s;
    ctx.beginPath();
    ctx.ellipse(X, y - 2 * s + hop, 5 * s, 2 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(X + 3 * s, y - 6 * s + hop, 1.4 * s, 4 * s);
    ctx.fillRect(X - 4 * s, y + hop, 1 * s, 3 * s);
    ctx.fillRect(X + 3 * s, y + hop, 1 * s, 3 * s);
  }
  ctx.beginPath();
  ctx.moveTo(x - 10 * s, y - 4 * s);
  ctx.lineTo(x + 6 * s, y - 4 * s);
  ctx.lineTo(x + 8 * s, y + 2 * s);
  ctx.lineTo(x - 8 * s, y + 2 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - 11 * s, y + 3 * s, 21 * s, 1 * s);
}

function snowman(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = css(SNOW);
  ctx.beginPath();
  ctx.arc(x, y - 6 * s, 6 * s, 0, TAU);
  ctx.arc(x, y - 15 * s, 4.2 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#B23A32';
  ctx.fillRect(x - 4.4 * s, y - 12 * s, 8.8 * s, 1.8 * s);
  ctx.fillRect(x + 2 * s, y - 12 * s, 1.8 * s, 5 * s);
  ctx.fillStyle = '#1A1416';
  ctx.fillRect(x - 3.5 * s, y - 21 * s, 7 * s, 1.2 * s);
  ctx.fillRect(x - 2.2 * s, y - 25 * s, 4.4 * s, 4 * s);
}

const scene: Scene = {
  far(env: SceneEnv) {
    const { ctx, w, h } = env;
    const clear = fade(env, 44, 52);
    // Lune et étoiles ; l'étoile du berger au sommet.
    orb(ctx, w * 0.74, h * 0.16, 14, [246, 238, 220], 1, 0.85);
    for (let k = 0; k < 60; k++) {
      const a = (0.35 + 0.55 * clear) * (env.motion ? 0.6 + 0.4 * Math.sin(env.t * 1.4 + k) : 0.8);
      ctx.fillStyle = `rgba(246,238,220,${a.toFixed(3)})`;
      ctx.fillRect(hash(k, 901) * w, hash(k, 902) * h * 0.55, 1, 1);
    }
    if (clear > 0.02) {
      ctx.save();
      ctx.translate(w * 0.32, h * 0.13);
      glow(ctx, 0, 0, 40, [255, 220, 150], 0.5 * clear);
      star(ctx, 9 * (env.motion ? 1 + 0.05 * Math.sin(env.t * 2) : 1), [255, 230, 170], clear);
      ctx.restore();
    }
    // Traîneau qui passe devant la lune (parfois, plus souvent en haut).
    if (egg(env, 1, 0.55) && fade(env, 30, 36) > 0.5 && env.motion) {
      const p = (env.t % 26) / 26;
      sleigh(ctx, -60 + p * (w + 120), h * 0.16 + Math.sin(p * Math.PI) * -20, 1, env.t);
    }
    // Halo chaud du village au ras de l'horizon.
    const g = ctx.createLinearGradient(0, h * 0.6, 0, h);
    g.addColorStop(0, 'rgba(255,170,90,0)');
    g.addColorStop(1, `rgba(255,170,90,${(0.18 * (1 - fade(env, 26, 36))).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
  },
  back(env: SceneEnv) {
    const { ctx } = env;
    const s = env.scale;
    // Collines enneigées lointaines et leurs sapins.
    const hill = byStage(env, [[150, 160, 176], [146, 154, 170], [140, 148, 164], [124, 140, 150], [130, 140, 160], [100, 110, 130]]);
    silhouette(env, 0.1, 0, (x) => 40 + 14 * ridge(x, 4, 0.012), css(hill));
    const firFar = mix([30, 60, 50], hill, 0.45);
    for (let k = 0; k < 14; k++) {
      const x = -220 + k * 34 + hash(k, 41) * 14;
      const Y = layerY(env, 40 + 14 * ridge(x, 4, 0.012) - 2, 0.1);
      if (Y < env.h + 40) snowyFir(ctx, sx(env, x), Y, s * 0.6, 26 + hash(k, 42) * 10, firFar, 0, 0);
    }
    // Village : deux rangées de maisons, fumée des cheminées.
    const village = 1 - fade(env, 16, 24);
    if (village > 0.02) {
      ctx.globalAlpha = village;
      const smoke: [number, number][] = [];
      for (const [p, row, tone] of [[0.18, 0, 0.35], [0.28, 1, 0.1]] as const) {
        const Y = layerY(env, 2, p);
        if (Y < -20) continue;
        for (let k = 0; k < 6; k++) {
          const x = -190 + k * 74 + row * 36 + hash(k, 51 + row) * 10;
          const wall = mix(mix([196, 168, 140], [150, 110, 90], hash(k, 53 + row)), hill, tone);
          smoke.push(house(ctx, sx(env, x), Y, s * (0.9 + row * 0.2), 30 + hash(k, 55) * 10, 26 + hash(k, 56) * 8, wall, 1, row === 1 && k === 2 && egg(env, 3, 0.6)));
        }
      }
      // Fumée lente qui s'élève et dérive.
      for (const [cx, cy] of smoke) {
        for (let k = 0; k < 3; k++) {
          const rise = ((env.motion ? env.t * 6 : 8) + k * 9) % 27;
          ctx.save();
          ctx.translate(cx + rise * 0.4 * s, cy - rise * s);
          puff(ctx, (0.12 + rise * 0.012) * s, [210, 210, 214], 0.28 * (1 - rise / 27));
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    }
    // Le village s'étage sur la montagne : corniches enneigées de part et d'autre de la tour.
    const snowTop: Rgb = [240, 244, 248];
    const rockBody: Rgb = mix([44, 46, 56], hill, 0.2);
    // Marché de Noël et grand sapin (vers 8 étages) : les lumières s'allument en montant.
    const my = layerY(env, altitude(env, 8, 0.34), 0.34);
    const market = reveal(env, 8) * (1 - fade(env, 22, 28));
    if (market > 0.02 && my > -140 && my < env.h + 140) {
      ledge(ctx, env.w, env.h, -1, my, sx(env, -50), snowTop, rockBody, market);
      ledge(ctx, env.w, env.h, 1, my, env.w - sx(env, 70), snowTop, rockBody, market);
      ctx.globalAlpha = market;
      const lights = fade(env, 5, 9);
      snowyFir(ctx, sx(env, -150), my, s * 1.3, 64, [26, 70, 46], lights, env.motion ? env.t : 0);
      stall(ctx, sx(env, -100), my, s, [178, 58, 50], env.t, env.motion);
      stall(ctx, sx(env, -66), my, s, [46, 106, 74], env.t, env.motion);
      stall(ctx, sx(env, 98), my, s, [178, 58, 50], env.t, env.motion);
      stall(ctx, sx(env, 140), my, s, [200, 150, 60], env.t, env.motion);
      ctx.globalAlpha = 1;
    }
    // Atelier illuminé (vers 20 étages), sur la corniche de droite.
    const wy = layerY(env, altitude(env, 20, 0.4), 0.4);
    const shop = reveal(env, 20) * (1 - fade(env, 32, 38));
    if (shop > 0.02 && wy > -120 && wy < env.h + 160) {
      ledge(ctx, env.w, env.h, 1, wy, env.w - sx(env, 30), snowTop, rockBody, shop);
      ledge(ctx, env.w, env.h, -1, wy + 18 * s, sx(env, -110), snowTop, rockBody, shop);
      ctx.globalAlpha = shop;
      workshop(ctx, sx(env, 105), wy, s * 0.75, env.t, env.motion);
      snowyFir(ctx, sx(env, -150), wy + 18 * s, s, 40, [30, 62, 48], 0, 0);
      ctx.globalAlpha = 1;
    }
    // Forêt hivernale, lanternes, étang gelé et patineurs (vers 30).
    const forest = fade(env, 26, 32) * (1 - fade(env, 46, 52));
    if (forest > 0.02) {
      const fy = layerY(env, altitude(env, 32, 0.45), 0.45);
      ledge(ctx, env.w, env.h, -1, fy, sx(env, -40), snowTop, rockBody, forest);
      ledge(ctx, env.w, env.h, 1, fy + 10 * s, env.w - sx(env, 60), snowTop, rockBody, forest);
      ctx.globalAlpha = forest;
      ctx.fillStyle = 'rgba(190,210,224,0.8)';
      ctx.beginPath();
      ctx.ellipse(sx(env, -110), fy + 3 * s, 46 * s, 4 * s, 0, 0, TAU);
      ctx.fill();
      for (let k = 0; k < 2; k++) {
        const p = env.motion ? ((env.t * 0.08 + k * 0.5) % 1) : 0.3 + k * 0.4;
        const X = sx(env, -110) + Math.cos(p * TAU) * 36 * s;
        const Y = fy + 3 * s + Math.sin(p * TAU) * 2.5 * s;
        ctx.fillStyle = '#1C1A20';
        ctx.fillRect(X - 1 * s, Y - 9 * s, 2.2 * s, 7 * s);
        ctx.beginPath();
        ctx.arc(X + 0.1 * s, Y - 10.5 * s, 1.6 * s, 0, TAU);
        ctx.fill();
      }
      for (const [x, dy] of [[-178, 0], [-60, 0], [90, 10], [130, 10], [168, 10]] as const) {
        snowyFir(ctx, sx(env, x), fy + dy * s, s * 0.9, 40 + hash(x, 62) * 14, [30, 62, 48], 0, 0);
        glow(ctx, sx(env, x) + 7 * s, fy + dy * s - 7 * s, 10 * s, WARM, 0.7 + (env.motion ? 0.2 * Math.sin(env.t * 4 + x) : 0));
      }
      if (egg(env, 4, 0.5)) {
        // Renard roux dans la neige.
        const X = sx(env, 150);
        const Y = fy + 10 * s;
        ctx.fillStyle = '#C8622A';
        ctx.beginPath();
        ctx.ellipse(X, Y - 3 * s, 6 * s, 2.6 * s, 0, 0, TAU);
        ctx.arc(X + 6 * s, Y - 5 * s, 2.2 * s, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#F0EDE8';
        ctx.beginPath();
        ctx.ellipse(X - 8 * s, Y - 4 * s, 3.6 * s, 1.6 * s, -0.4, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  },
  near(env: SceneEnv) {
    // Neige : légère au village, dense sur les cimes, presque arrêtée sous l'étoile.
    const heavy = fade(env, 32, 38) * (1 - fade(env, 46, 52));
    drifters(env, 26 + Math.round(heavy * 22), 21, (c, x, y, k) => {
      const big = k % 5 === 0;
      c.fillStyle = `rgba(246,248,252,${(big ? 0.9 : 0.65).toFixed(3)})`;
      c.beginPath();
      c.arc(x + (env.motion ? Math.sin(env.t + k) * 4 : 0), y, big ? 1.8 : 1.1, 0, TAU);
      c.fill();
    }, { x: -6, y: 18 + heavy * 16 });
    // Guirlande d'ampoules au-dessus de la rue du village.
    const street = 1 - fade(env, 6, 12);
    if (street > 0.02 && env.full) {
      const { ctx, w } = env;
      const y0 = layerY(env, 70, 0.6);
      if (y0 > -20 && y0 < env.h) {
        ctx.strokeStyle = `rgba(30,26,24,${(0.8 * street).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.quadraticCurveTo(w / 2, y0 + 26, w, y0);
        ctx.stroke();
        for (let k = 1; k < 12; k++) {
          const u = k / 12;
          const X = u * w;
          const Y = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * (y0 + 26) + u * u * y0;
          const on = env.motion ? 0.55 + 0.45 * Math.sin(env.t * 2 + k * 1.7) : 0.8;
          glow(ctx, X, Y + 3, 5, BULBS[k % BULBS.length]!, on * street);
        }
      }
    }
  },
  ground(env: SceneEnv, top: number) {
    const { ctx, w, h } = env;
    if (top >= h) return;
    // Neige bleutée dans l'ombre, flaques de lumière dorée, empreintes.
    ctx.fillStyle = css(byStage(env, [[214, 220, 230], [210, 216, 226], [204, 210, 222], [196, 204, 216], [190, 198, 212], [170, 178, 196]]));
    ctx.fillRect(0, top, w, h - top);
    for (let k = 0; k < 4; k++) {
      const g = ctx.createRadialGradient(hash(k, 71) * w, top + 4, 0, hash(k, 71) * w, top + 4, 50);
      g.addColorStop(0, 'rgba(255,200,120,0.32)');
      g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(hash(k, 71) * w - 50, top, 100, 40);
    }
    ctx.fillStyle = 'rgba(120,130,160,0.35)';
    for (let k = 0; k < 12; k++) {
      ctx.beginPath();
      ctx.ellipse(30 + k * (w - 60) / 12 + (k % 2) * 4, top + 10 + (k % 2) * 4, 2, 1, 0.3, 0, TAU);
      ctx.fill();
    }
    if (egg(env, 2, 0.65)) snowman(ctx, w * 0.12, top + 3, 1.1);
  },
};

export const noel: Theme = {
  id: 'noel',
  name: 'Veillée de Noël',
  rarity: 'epique',
  blocks: BLOCKS,
  sparks: ['#FFD27A', '#FF7A5A', '#FFFFFF', '#9CE0B0'].map(hex),
  ground: { top: hex('#E2E6EE'), body: hex('#D2D8E2') },
  audio: { wave: 'sine', root: 392, scale: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17] },
  scene,
  tiers: [
    { name: 'Village sous la neige', skyTop: hex('#1B2430'), skyBottom: hex('#5C6476'), ink: CREAM, decor: (ctx, it, t, motion) => star(ctx, 1.6 + it.r2, [246, 238, 220], twinkle(it, t, motion, 0.4)) },
    { name: 'Marché de Noël', skyTop: hex('#1D2129'), skyBottom: hex('#7A5C48'), ink: CREAM, decor: (ctx, it, t, motion) => glow(ctx, 0, 0, 5, BULBS[Math.floor(it.r1 * 4)]!, twinkle(it, t, motion, 0.5)) },
    { name: 'L’atelier illuminé', skyTop: hex('#1F1D24'), skyBottom: hex('#6E503C'), ink: CREAM, decor: (ctx, it, t, motion) => glow(ctx, 0, 0, 5, WARM, twinkle(it, t, motion, 0.45)) },
    {
      name: 'Forêt hivernale', skyTop: hex('#18222B'), skyBottom: hex('#526264'), ink: CREAM,
      decor: (ctx, it, t, motion) => {
        // Flocon à six branches.
        ctx.rotate(motion ? t * 0.5 + it.r1 * 6 : it.r1 * 6);
        ctx.strokeStyle = 'rgba(246,248,252,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI;
          ctx.moveTo(-Math.cos(a) * 4, -Math.sin(a) * 4);
          ctx.lineTo(Math.cos(a) * 4, Math.sin(a) * 4);
        }
        ctx.stroke();
      },
    },
    { name: 'Neige sur les cimes', skyTop: hex('#1A2029'), skyBottom: hex('#5C6270'), ink: CREAM, decor: (ctx, it, t, motion) => star(ctx, 2 + it.r2 * 2, [246, 248, 252], twinkle(it, t, motion, 0.5)) },
    { name: 'Nuit de l’étoile', skyTop: hex('#0F151D'), skyBottom: hex('#323846'), ink: CREAM, decor: (ctx, it, t, motion) => star(ctx, 2 + it.r2 * 3, [255, 230, 170], twinkle(it, t, motion, 0.75)) },
  ],
};
