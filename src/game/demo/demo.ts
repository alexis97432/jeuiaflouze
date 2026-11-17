/**
 * Démonstration F1/F3 : pas un menu de production (l'accueil appartient à Alexis, A3).
 * - `?theme=confiserie|orbital|jardin` : univers ; `?voyage=1` : variante « la tour voyage ».
 * - `?seed=…` : rejouer la même séquence.
 * - `?skin=gomme|marbre|bonbon|verre|strie|ceramique` : apparence des blocs (F4).
 * - `?compare=1` : les trois univers côte à côte, joués par un pilote automatique, même seed.
 * - `?apparences=1` : planche des 18 aperçus univers × apparence (`renderAppearancePreview`).
 * Utilise `createGame` (interne) pour la variante voyage et le pilote ; le reste passe par
 * l'option publique `appearance`.
 */
import { createGame } from '../render/mount';
import { isSkinId, SKIN_IDS, type SkinId } from '../render/blocks';
import { renderAppearancePreview } from '../render/preview';
import { THEME_IDS, isThemeId, type ThemeId } from '../render/themes';

type Game = ReturnType<typeof createGame>;
const params = new URLSearchParams(location.search);
const seedParam = Number(params.get('seed'));
let seed = Number.isInteger(seedParam) && seedParam >= 1 && seedParam <= 0xffffffff ? seedParam : 7;
const themeParam = params.get('theme');
const theme: ThemeId = isThemeId(themeParam) ? themeParam : 'confiserie';
const skinParam = params.get('skin');
const skin: SkinId = isSkinId(skinParam) ? skinParam : 'gomme';
const voyage = params.get('voyage') === '1';
const compare = params.get('compare') === '1';
const board = params.get('apparences') === '1';

const nav = document.getElementById('nav')!;
const label = (id: string) => ({ confiserie: 'Confiserie', orbital: 'Orbital', jardin: 'Jardin' } as Record<string, string>)[id] ?? id;
const links: [string, string, boolean][] = [
  ...THEME_IDS.map((id): [string, string, boolean] => [label(id), `?theme=${id}&skin=${skin}`, !compare && !board && !voyage && theme === id]),
  ['Voyage', `?voyage=1&skin=${skin}`, voyage && !compare && !board],
  ['Comparer', '?compare=1', compare],
  ['Apparences', '?apparences=1', board],
];
for (const [text, href, current] of links) {
  const a = document.createElement('a');
  a.textContent = text;
  a.href = href;
  if (current) a.setAttribute('aria-current', 'page');
  nav.append(a);
}

/** Pilote de démonstration : appuie quand l'écart prévu est petit, parfois imparfait. */
function autopilot(game: Game, canvas: HTMLCanvasElement, tolerance: number) {
  let n = 0;
  const loop = () => {
    const { sim, destroyed } = game.inspect();
    if (destroyed || sim.status === 'ended') return;
    const lead = sim.moving.left + sim.direction * sim.speed * 2;
    const tol = n % 4 === 3 ? tolerance * 4 : tolerance;
    if (Math.abs(lead - sim.base.left) <= tol) {
      n++;
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse', button: 0 }));
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

if (board) {
  document.body.classList.add('compare');
  const grid = document.getElementById('grid')!;
  grid.classList.add('board');
  for (const id of THEME_IDS) {
    for (const sk of SKIN_IDS) {
      const link = document.createElement('a');
      link.href = `?theme=${id}&skin=${sk}`;
      link.className = 'tile';
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      const caption = document.createElement('span');
      caption.textContent = `${label(id)} · ${sk}`;
      link.append(canvas, caption);
      grid.append(link);
      renderAppearancePreview(canvas, { theme: id, skin: sk });
    }
  }
} else if (compare) {
  document.body.classList.add('compare');
  const grid = document.getElementById('grid')!;
  for (const id of THEME_IDS) {
    const cell = document.createElement('figure');
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', `Univers ${label(id)}, partie automatique`);
    const caption = document.createElement('figcaption');
    caption.textContent = label(id);
    cell.append(canvas, caption);
    grid.append(cell);
    const game = createGame({ canvas, config: { seed, rulesVersion: 1 }, onEnd() {}, sound: false, appearance: { theme: id, skin } });
    autopilot(game, canvas, 2500);
  }
} else {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const end = document.getElementById('end')!;
  const msg = document.getElementById('msg')!;
  const again = document.getElementById('again') as HTMLButtonElement;
  let game: Game | null = null;
  const start = () => {
    end.hidden = true;
    game?.destroy();
    game = createGame({
      canvas,
      config: { seed, rulesVersion: 1 },
      appearance: { theme, skin },
      voyage,
      onEnd(result) {
        msg.textContent = `Score ${result.score} · ${result.perfectCount} parfait(s) · seed ${result.seed}`;
        end.hidden = false;
        again.focus();
      },
    });
  };
  again.addEventListener('click', () => { seed = (seed % 0xffffffff) + 1; start(); });
  start();
}
