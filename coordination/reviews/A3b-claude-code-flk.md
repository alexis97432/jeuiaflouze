# Revue A3b (accueil mobile V2, Tour du jour, objectifs, collection) — Claude Code FLK

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
