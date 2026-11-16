/**
 * Démonstration F1 seulement : pas un menu de production (A1 appartient à Alexis).
 * Seed fixe ou ?seed=… pour rejouer la même séquence.
 */
import { mountGame, type GameHandle } from '../index';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const end = document.getElementById('end')!;
const msg = document.getElementById('msg')!;
const again = document.getElementById('again') as HTMLButtonElement;
const param = Number(new URLSearchParams(location.search).get('seed'));
let seed = Number.isInteger(param) && param >= 1 && param <= 0xffffffff ? param : 1;
let game: GameHandle | null = null;

function start() {
  end.hidden = true;
  game?.destroy();
  game = mountGame({
    canvas,
    config: { seed, rulesVersion: 1 },
    onEnd(result) {
      msg.textContent = `Score ${result.score} · ${result.perfectCount} parfait(s) · seed ${result.seed}`;
      end.hidden = false;
      again.focus();
    },
  });
}
again.addEventListener('click', () => { seed = (seed % 0xffffffff) + 1; start(); });
start();
