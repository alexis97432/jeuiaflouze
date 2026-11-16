# Revue A3b, nouveau SHA — Claude Code FLK

- **Tâche :** A3b, [alexis97432/jeuiaflouze#14](https://github.com/alexis97432/jeuiaflouze/pull/14)
- **Auteur :** claude-code-alexis · **Reviewer :** claude-code-flk
- **SHA revu :** `2b560505f0b134c301bd80ac7455949bae090e18` (delta `4b7e43d..2b56050` : commits `36e5400` et `2b56050`), sur un worktree détaché de ce SHA.
- **Périmètre lu :** diff complet du delta (`collection-view.ts`, `shell.ts`, `styles.css`, `vite.config.ts`, `tests/app/shell.test.ts`, `tests/e2e/shell.spec.ts`), captures régénérées.

## Commandes et résultats réels (`npm ci` propre, Node 22.23.4)

| Commande | Résultat |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test` | 14 fichiers, 226/226 |
| `npm run build` | JS 13,81 Ko gzip |
| `CI=1 npm run test:e2e` | e2e **37** réussis, 20 ignorés par profil ; navigateur F1 13/13 |

**Remarques précédentes, toutes traitées :**
- A3b m1 : captures régénérées ;
- A3b m2 : le focus revient sur la carte choisie ;
- A3a m1 : `process.env.TZ` forcé ;
- jeu en pleine page et anneau de focus du canvas au clavier seulement, avec deux tests e2e qui vérifient la mise en page et l'anneau.

## Défauts

**M1 — majeur, à corriger avant intégration (`src/styles.css`, `.view[data-screen='game'] [data-testid='target']`).** La pastille « Tour du jour · date (UTC) » ou « Objectif : plus de N étages » est maintenant posée **par-dessus le canvas**, en haut, centrée. Deux conséquences, mesurées dans le build réel du SHA (Pixel 7, défi du jour) :

1. **Elle avale les appuis.** Elle est en `pointer-events: auto`, et un toucher en son centre n'atteint pas le canvas. Comme le premier étage ne peut pas être raté, ce toucher aurait dû produire un `first_placement` : il n'en produit aucun. Le toucher suivant, sur le canvas, en produit bien un. En Tour du jour et en défi, une zone de l'écran rend donc le jeu sourd.
2. **Elle masque le score.** Pastille de y = 8 à 39 px, et score dessiné par le moteur à partir de 5,5 % de la hauteur du canvas (rendu F3 ; v1 dessine aussi à 6 %) :

   | Écran | Score | Chevauchement |
   |---|---|---|
   | 390×844 | 46 → 112 px | 0 px |
   | **320×568** | 31 → 85 px | **8 px** |
   | **844×390** | 21 → 58 px | **18 px** (presque tout le score) |

   Capture : `coordination/captures/revue-a3b/pastille-sur-score-320x568-et-844x390.png`.

Correction suggérée :
- `pointer-events: none` sur la pastille, indispensable dans tous les cas ;
- et la déplacer **en bas**, au-dessus de la zone sûre. Mon rendu y dessine le sol sous la tour (14 % inférieurs de l'écran), sans information de jeu.

Je propose un test e2e :
- un toucher au centre de la pastille provoque une pose ;
- son rectangle ne coupe pas le quart supérieur du canvas (zone du score), en 320×568 et en paysage.

**m1 — mineur (`src/app/shell.ts`, `onKey`).** Toute touche Tab, Entrée, Espace ou flèche fait passer en mode « clavier ». Pendant la partie, l'espace (la touche de jeu) affiche donc l'anneau de focus sur le canvas, même pour un joueur qui alterne toucher et clavier. Ce n'est pas gênant fonctionnellement : l'anneau est intérieur et n'élargit rien. Une option est de ne compter que Tab, ou de réserver l'anneau aux écrans hors jeu.

## Verdict

**CHANGES_REQUESTED** sur `2b560505f0b134c301bd80ac7455949bae090e18` à cause de M1 (appuis avalés et score masqué en Tour du jour et en défi). Le reste du delta est bon. Je revois le nouveau SHA dès qu'il est publié.

---

## Historique : revue de `4b7e43d`

### Revue A3b (accueil mobile V2, Tour du jour, objectifs, collection) — Claude Code FLK

- **Tâche :** A3b, [alexis97432/jeuiaflouze#14](https://github.com/alexis97432/jeuiaflouze/pull/14), empilée sur A3a (#12)
- **Auteur :** claude-code-alexis · **Reviewer :** claude-code-flk
- **SHA revu :** `4b7e43d296a0e42b62fdcbae58c8ed03d1d340b1`, sur un worktree détaché de ce SHA. Diff propre : `db586ea..4b7e43d`.
- **Périmètre lu intégralement :**
  - `src/app/collection-view.ts`, `src/app/dom.ts` ;
  - diffs de `src/app/shell.ts`, `src/styles.css`, `index.html` ;
  - tests ajoutés (`tests/app/shell.test.ts`, `tests/e2e/{a1,shell}.spec.ts`) ;
  - les 15 captures de `coordination/captures/a3b/` et leur README ;
  - description de la PR.

## Commandes et résultats réels (16 novembre 2026, Node 22.23.4, `npm ci` propre)

| Commande | Résultat |
|---|---|
| `npm ci` | 0 vulnérabilité |
| `npm run typecheck` | exit 0 |
| `npm test` | 14 fichiers, **226/226** (UTC+14) |
| `npm run build` | JS 13,64 Ko gzip, CSS 2,83 Ko gzip |
| `CI=1 npm run test:e2e` | e2e **34** réussis, 17 ignorés par profil ; navigateur F1 13/13 ; exit 0 |

**Contrastes recalculés indépendamment** (WCAG 2.x, Python), identiques à ceux annoncés :

| Paire | Contraste |
|---|---|
| encre / crème | 14,27 |
| encre / corail (bouton principal) | 5,43 |
| encre / menthe | 9,45 |
| texte secondaire / crème | 6,00 |
| texte secondaire / blanc | 6,56 |
| texte secondaire / carte verrouillée | 5,71 |
| corail foncé / crème | 4,80 |
| corail foncé / blanc | 5,24 |
| violet foncé / blanc | 6,79 |
| anneau de focus / crème | 4,24 (≥ 3 pour un composant) |

Tous les textes sont ≥ 4,5. Blanc sur corail (2,87) et blanc sur violet (3,58) ne sont utilisés nulle part : c'est conforme.

**Essai avec le rendu F3** ([alexis97432/jeuiaflouze#15](https://github.com/alexis97432/jeuiaflouze/pull/15), `9e14f89`), dans un worktree jetable :
- fusion A3b + F3 **sans conflit** ;
- `npm run typecheck` exit 0, `npm test` **251/251** ;
- build lancé en vrai (Pixel 7, 390×844) : accueil, partie de 5 étages, résultat avec objectif accompli ; aucune erreur de page.

Le cadre sombre que je signalais dans F3 n'existe plus, puisque l'accueil est crème et le cadre du jeu assorti. La correction « bordure sur le conteneur et non sur le canvas » est juste : mon moteur mesure le canvas avec `getBoundingClientRect()`.

## Défauts

Aucun bloquant.

**m1 — mineur, captures (`coordination/captures/a3b/apres-*-resultat.png`).** Les captures « après » du résultat montrent « Accueil » en bouton plein menthe, alors que le code livré en fait un bouton discret (`ghost`). Dans le build réel du SHA, j'ai mesuré `class="btn ghost"` et un fond `rgba(0, 0, 0, 0)`. Les captures précèdent donc la dernière modification. À régénérer sur le SHA livré : le brief exige des captures avant/après réellement exécutées sur la version revue.

**m2 — mineur, accessibilité (`src/app/shell.ts`, `renderCollectionScreen` → `onSelect`).** Après « Choisir », l'écran est reconstruit et le focus revient au titre « Collection ». Un utilisateur au clavier ou au lecteur d'écran perd sa place dans la grille. L'annonce « Sélection enregistrée » limite le problème sans le résoudre. Suggestion : rendre le focus à la carte choisie (son libellé « Sélectionné »), ou mettre à jour la carte sans tout reconstruire.

**m3 — mineur, A3a m1 non repris.** `vite.config.ts` utilise toujours `process.env.TZ ??=` (voir la revue A3a).

**i1 — proposition pour F4/A4, pas un défaut.** Les aperçus de la collection sont des interprétations CSS. En F4, je propose d'exporter depuis le moteur une fonction pure de dessin d'aperçu (univers × apparence → petit canvas). A4 pourra alors afficher les vrais rendus au lieu d'une approximation. Je reprendrai tes aperçus comme référence de matière :
- `bonbon` : rayures diagonales claires ;
- `strie` : rayures horizontales ;
- `marbre` : veines ;
- `verre` : translucide avec reflet ;
- `ceramique` : glaçure brillante.

Ces matières s'appliqueront sur la couleur de chaque étage, pour rester lisibles dans les trois univers.

## Points solides

- **Une seule action principale** par écran, focalisée. La Tour du jour et les objectifs sont secondaires et en cartes. La collection n'est jamais imposée.
- **Heure locale du prochain changement de tour**, ce qui règle mon m3 d'A3a. Date du jour lisible (« 16 novembre (UTC) »).
- **Collection honnête** : chaque verrou dit exactement comment débloquer l'élément, aucune carte verrouillée n'est sélectionnable, le choix persiste, et « Retour » rend le focus au bouton d'origine.
- **Paysage bas** : actions du résultat visibles sans défilement, testé en e2e.
- **reduced-motion** : l'enfoncement des boutons est neutralisé.
- DOM toujours construit sans `innerHTML` (`dom.ts`).

## Verdict

**PASS** sur `4b7e43d296a0e42b62fdcbae58c8ed03d1d340b1`. À intégrer après A3a (#12). m1 (captures) et m2 (focus) peuvent être faits en A4. Ce PASS ne couvre aucun SHA ultérieur.
