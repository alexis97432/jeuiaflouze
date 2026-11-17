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

## V2 — F3 : univers, relief, paliers

Brief : [coordination/V2.md](../../../coordination/V2.md). **Aucun changement de règles** : `src/game/core` et les golden v1 sont inchangés, et un test DOM vérifie que la même séquence d'appuis donne le même `RunResult` dans chaque univers.

- **Univers** (`themes.ts`) : `confiserie` (défaut), `orbital`, `jardin`. Pour chacun : 4 paliers de ciel à 0, 10, 25 et 50 étages, interpolés en continu ; un décor propre à chaque palier ; un sol ; 6 couleurs de blocs ; des étincelles ; un son (timbre, note de départ, gamme).
- **Variante « la tour voyage »** (`VOYAGE`, avis FLK) : Confiserie, puis Jardin au palier 2, puis Orbital au palier 3. Option interne `voyage: true`.
- **Relief** : blocs arrondis avec face supérieure claire, lèvre sombre, reflet, contour intérieur adaptatif et ombre de contact limitée à l'intersection. Tout est dessiné **dans [x, x + largeur]**, vérifié au pixel dans Chromium.
- **Caméra** : le bloc actif reste vers 36 % de la hauteur. L'étage visuel passe à 30 unités (purement graphique).
- **Décor** : parallaxe 0,55, au plus `MAX_DECOR` = 28 éléments par image, mémoire de palier bornée. Au franchissement d'un palier, le décor au-dessus du bloc actif prend le nouveau style (fondu de 0,4 s, ou bascule nette en reduced-motion). Aucun décor dans la zone du score.
- **Palier atteint** : libellé « Palier : <nom> », arpège dans la gamme de l'univers.
- **Lisibilité mesurée (tests)** :
  - score ≥ 3 sur le ciel et ≥ 4,5 contre son liseré, sur toute hauteur de 0 à 60 étages ;
  - bord de chaque bloc ≥ 3 sur le ciel derrière lui.
- **reduced-motion** : ni étincelle, ni onde, ni tremblement ; caméra et ciel suivent sans animation.
- **Coût mesuré** (headless, CPU ×4, 50 étages, conteneur cloud) : `draw()` médiane 1,9 à 2,7 ms, p95 3,4 à 4,6 ms selon l'univers. Ce ne sont pas des FPS d'appareil.

Choix d'univers côté shell : pour l'instant seulement via l'option interne `createGame({ theme })` (démo et tests). L'option publique `appearance?: { theme: ThemeId; skin: SkinId }` arrive en F4, après accord sur les identifiants avec Alexis (A3).

## V2 — F4 : apparences, option `appearance`, aperçu

- **Six apparences** (`blocks.ts`) : `gomme` (défaut), `marbre`, `bonbon`, `verre`, `strie`, `ceramique`. Ce sont des **matières appliquées sur la couleur de chaque étage**, donc orthogonales aux univers : 3 + 6 définitions, 18 combinaisons cohérentes. Aperçus de référence : la collection d'A3b.
- **Invariant de lisibilité** : chaque matière est découpée par la forme arrondie du bloc et le contour reste intérieur. Vérifié au pixel pour 6 apparences × 3 univers ; la mutation « sans découpe » fait échouer `bonbon`. Bord ≥ 3 de contraste pour chaque apparence, univers et hauteur, translucidité de `verre` comprise (`edgeColors`).
- **API publique** (`src/game/index.ts`, additive, convenue avec A3) :
  - `MountOptions.appearance?: { theme: ThemeId; skin: SkinId }` : validée à la création, un identifiant inconnu retombe sur Confiserie / Gomme sans erreur ;
  - `resolveAppearance(raw)` : la même validation, utilisable par le shell ;
  - exports `ThemeId`, `SkinId`, `THEME_IDS`, `SKIN_IDS`, `DEFAULT_THEME`, `DEFAULT_SKIN`, `isThemeId`, `isSkinId`.
- **Aperçu de collection** : `renderAppearancePreview(canvas, appearance, { width, height, dpr, tier })` dessine une petite tour de trois étages avec le **même code que le jeu**. C'est une image fixe : pas de RAF, d'écouteur, de son ni de stockage. Elle renvoie `false` sans Canvas 2D au lieu de lever. Les 18 aperçus sont tous différents (empreinte d'image).
- **Règles inchangées** : même `RunResult` pour chaque apparence, et pour une apparence inconnue (test DOM via l'option publique).
- **Démo** : `?skin=…` et `?apparences=1` (planche des 18 aperçus, chaque tuile ouvre le jeu correspondant).

## V3 — F7 : montage des règles v2 (jauge, bonus, reprise)

`config.rulesVersion: 2` monte `SimulationV2` ; `rulesVersion: 1` reste le moteur v1 inchangé (anciens défis `?v=1`).
Interfaces convenues (plan FLK §6, accord Alexis #25, PASS Codex C7) :

- `MountOptions.allowContinue?: boolean` (défaut false, ignoré en v1). Sans lui, le premier raté v2 termine normalement : Tour du jour, défis et parties classées ne bloquent jamais.
- `GameEvent` (additif) : `placement` porte `points`, `score`, `height` (en v1 : 1 point, score = hauteur) ; `gauge {value, max, next}` ; `bonus-start {bonus, floors}` ; `bonus-end {bonus}` ; `continue-offer {tick}` ; `continue-start {countdownTicks}`.
- `GameHandle.continueRun(): boolean` — à appeler seulement après une autorisation réelle (vie possédée, vidéo confirmée) ; false sans effet hors attente (double rappel, v1, destroy, `allowContinue` absent). `declineContinue()` — fin normale, `onEnd` une seule fois. Optionnels dans le type (doubles de test du shell), toujours présents sur `mountGame`.
- `RunConfig` / `RunResult` exportés en unions v1 | v2 ; `RunResultV1`, `RunResultV2`, `BonusId`, `BONUS_IDS`, `GAUGE_MAX`, `BONUS_FLOORS`, `COUNTDOWN_TICKS` exportés.

Comportement :
- Attente de décision (`fallen`) : aucun tick, aucun `onEnd`, l'entrée est rendue au DOM (l'offre est un écran DOM du shell), la boucle d'affichage s'arrête une fois la chute dessinée ; un voile figé recouvre la scène. Onglet caché puis visible : rien à protéger, l'affichage reprend sans geste.
- Après `continueRun()` : effets de chute effacés, compte à rebours 3-2-1 dessiné depuis le tick (grand chiffre contrasté, son court par chiffre, son coupé respecté), bloc réapparu immobile ; les appuis sont refusés par le driver (ni file, ni pose fantôme). Pause du shell ou onglet caché : le décompte s'arrête avec les ticks.
- HUD v2 : points en grand, « N étages » en dessous, jauge « Super » de 10 cases avec le nom du prochain bonus (« Ralenti », « ×2 ») ; pendant un bonus, 5 cases à sa couleur qui se vident à chaque pose, bannière « RALENTI ! » / « ×2 POINTS ! », teinte légère de l'écran (statique) et « +N » au-dessus de chaque pose (fixe en reduced-motion). Sons propres au début et à la fin des bonus.
- Démo : v2 par défaut avec une offre étiquetée « Démo » (pas de vidéo ni de vie) ; `?regles=1` pour la v1.

## V3 — F9 : carte de résultat

Exports : `summarizeRun(result)` → `RunSummary | null` ; `renderResultCard(canvas, { result, appearance?, mode, day? }, { scale? })` → `boolean` ; `CARD_WIDTH` × `CARD_HEIGHT` = 1080 × 1350.

- Dérivée du **rejeu** (`replayRun`) puis d'une re-simulation : motif des poses, tour réelle, points/hauteur, reprise. Un résultat qui ne se rejoue pas, ou dont score/parfaits/durée déclarés diffèrent du rejeu, donne `null` / `false` : aucune carte inventée.
- Contenu : nom du jeu, mode (Partie libre, Défi entre amis, Tour du jour + date UTC fournie), univers ; v2 : points **et** étages distincts ; v1 : étages seuls ; parfaits, meilleure série, nombre de bonus ; bandeau « avec reprise » ; les 16 derniers étages réels dessinés avec `drawBlock` (« … et N étages dessous ») ; frise des 75 dernières poses (dorée = parfait, cerclée = sous bonus).
- Bornes : `MAX_TOWER = 16`, `MAX_PATTERN = 75` quelle que soit la longueur de la partie. Aucun nom, URL, identifiant, classement ni paiement ; pas d'événement, RAF, stockage ni réseau. Conversion en fichier et partage : shell (Alexis).
