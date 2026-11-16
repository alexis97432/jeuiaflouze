# F1 — rendu, entrée et boucle

Propriétaire : Claude Code FLK. API publique : [`src/game/index.ts`](../index.ts). Règles : [`../core/README.md`](../core/README.md).

## Intégration (A1)

```ts
import { mountGame } from './game';
const handle = mountGame({ canvas, config: { seed, rulesVersion: 1 }, onEnd(result) { /* écran résultat */ } });
// handle.pause() / handle.resume() / handle.destroy()
```

- Le canvas doit avoir une taille CSS (le jeu lit `getBoundingClientRect()` et applique `devicePixelRatio`, borné à 3). Un `ResizeObserver` plus `resize` suivent les changements, y compris le zoom.
- `onEnd` est appelé une seule fois, `END_DELAY_MS` (650 ms) de rendu après le raté, le temps de voir le bloc tomber. Il ne l'est pas si `destroy()` survient avant. Il peut appeler `destroy()`.
- Échecs de montage, synchrones et sans effet de bord (aucun écouteur ni RAF laissé) : `RangeError` si la seed ou `rulesVersion` est invalide, `Error('Canvas 2D indisponible')` si `getContext('2d')` renvoie null. Le shell affiche un message et propose de réessayer (revue C0, B3).
- `onEvent?(event)` (proposition, revue C0, B1) reçoit `{ type: 'placement', tick, floor, perfect, perfectStreak }` à chaque pose et `{ type: 'miss', tick, floor }` au raté. Le shell en dérive `first_placement` sans recopier les règles. Une exception levée par ce callback est journalisée et ne casse pas la boucle.
- Aucune lecture ni écriture de stockage, réseau ou menus. Le score et la série sont dessinés dans le canvas ; les boutons restent en DOM côté A1.

## Entrées

- `pointerdown` sur le canvas uniquement (tactile, souris bouton gauche, stylet), avec `preventDefault`. Aucun écouteur mouse/touch/click : un toucher ne peut pas donner deux poses. `touch-action: none` est posé pendant le jeu, puis restauré.
- Espace : `keydown` en capture sur `window`, répétition ignorée, `preventDefault` sur keydown et keyup. Un bouton DOM focalisé n'est pas activé pendant la partie. Les champs éditables sont ignorés. Après le raté, l'espace est rendu au DOM pour l'écran de résultat.
- Chaque appui est horodaté (`Event.timeStamp`) et attribué au premier tick ≥ son instant (`FixedStepDriver`). Le résultat ne dépend donc pas de la cadence d'affichage : 30 à 240 Hz testés, avec gigue.

## Boucle

`requestAnimationFrame` avec simulation à pas fixe (120 ticks/s), au plus 30 ticks rattrapés par image. Au-delà, le temps est abandonné plutôt que de faire sauter la partie. L'affichage interpole la position du bloc mobile entre deux ticks, sans toucher aux règles. Après la fin et les effets, la boucle s'arrête : aucun RAF inutile.

## Pause et visibilité

- `pause()` : temps logique gelé, appuis ignorés, appuis en attente oubliés, RAF arrêté, voile « Pause ».
- `resume()` : reprise ancrée à l'instant présent, sans rattrapage. Sans effet si l'onglet est caché.
- Onglet caché : pause automatique. Au retour, voile « Touchez pour reprendre » ; ce toucher reprend sans poser de bloc. Si la partie était déjà finie, l'animation de fin reprend seule pour que `onEnd` arrive.

## Son

Synthétisé en WebAudio, sans fichier à télécharger. L'`AudioContext` n'est créé que dans un geste (premier appui) ; `destroy()` le ferme.
- Pose : son plus aigu quand la base rétrécit.
- Parfait : gamme pentatonique qui monte avec la série.
- Raté : son grave descendant.

## Effets (game feel)

| Événement | Effets | reduced-motion |
|---|---|---|
| pose | petit rebond du bloc, débris qui tombe en tournant | débris qui s'efface sur place, sans rebond |
| parfait | halo, 8 à 24 étincelles, libellé « PARFAIT ×n » dès 2 | halo sans agrandissement, aucune étincelle |
| raté | bloc qui tombe, tremblement à trauma décroissante | bloc qui s'efface, aucun tremblement |

Bornes : 16 débris et 48 étincelles au plus, les plus anciens étant remplacés. L'aléa visuel est séparé du PRNG de simulation.

## Propositions additives (à valider par Codex et Alexis, optionnelles)

- `MountOptions.onEvent?` (ci-dessus).
- `MountOptions.sound?: boolean` (défaut `true`) : le shell y branche sa préférence « son coupé ». Avec `reducedMotion`, cela couvre B2 à la création ; une modification à chaud (`setPrefs`, proposée par Alexis) reste à arbitrer.
- `MountOptions.reducedMotion?: boolean` : force le mode ; par défaut, préférence système suivie en direct.
- Export `END_DELAY_MS`, plus `replayRun` et `verifyRunResult` depuis `src/game/index.ts`.

## Démo

`src/game/demo/index.html` + `demo.ts` : page minimale (canvas plein écran, bouton Rejouer, `?seed=`). C'est une démonstration, pas les menus A1. Elle demande un bundler (Vite d'A0). En attendant : `esbuild src/game/demo/demo.ts --bundle`.
