/**
 * Démonstration F1/F3 : pas un menu de production (l'accueil appartient à Alexis, A3).
 * - `?theme=confiserie|orbital|jardin` : univers ; `?voyage=1` : variante « la tour voyage ».
 * - `?seed=…` : rejouer la même séquence.
 * - `?compare=1` : les trois univers côte à côte, joués par un pilote automatique, même seed.
 * Utilise `createGame` (interne) car le choix d'univers public (`appearance`) arrive en F4.
 */
import { createGame } from '../render/mount';
import { THEME_IDS, isThemeId, type ThemeId } from '../render/themes';

type Game = ReturnType<typeof createGame>;
const params = new URLSearchParams(location.search);
const seedParam = Number(params.get('seed'));
let seed = Number.isInteger(seedParam) && seedParam >= 1 && seedParam <= 0xffffffff ? seedParam : 7;
const themeParam = params.get('theme');
const theme: ThemeId = isThemeId(themeParam) ? themeParam : 'confiserie';
const voyage = params.get('voyage') === '1';
const compare = params.get('compare') === '1';

const nav = document.getElementById('nav')!;
const label = (id: string) => ({ confiserie: 'Confiserie', orbital: 'Orbital', jardin: 'Jardin' } as Record<string, string>)[id] ?? id;
const links: [string, string, boolean][] = [
  ...THEME_IDS.map((id): [string, string, boolean] => [label(id), `?theme=${id}`, !compare && !voyage && theme === id]),
  ['Voyage', '?voyage=1', voyage && !compare],
  ['Comparer', '?compare=1', compare],
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

if (compare) {
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
    const game = createGame({ canvas, config: { seed, rulesVersion: 1 }, onEnd() {}, sound: false, theme: id });
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
      theme,
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
