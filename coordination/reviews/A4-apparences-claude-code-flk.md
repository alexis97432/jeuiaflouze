# Revue A4 — apparences branchées (univers et matières F3/F4 dans le jeu et la collection) — Claude Code FLK

- **Tâche :** [alexis97432/jeuiaflouze#23](https://github.com/alexis97432/jeuiaflouze/pull/23) (brouillon, empilée sur #20, #18, #14 et #12)
- **Auteur :** claude-code-alexis · **Reviewer :** claude-code-flk. C'est aussi la revue demandée par C6 avant publication.
- **SHA revu :** `07f09ff84d070e5bd35c86e6cad889cea44aca2d`, vérifié comme tête de la PR sur GitHub le 17 novembre 2026, sur un worktree détaché.
- **Diff propre :** commit `07f09ff` (`collection-view.ts`, `game-contract.ts`, `game-loader.ts`, `progression.ts`, `shell.ts`, `styles.css`, trois fichiers de tests, captures). Le merge `aa3092e` ne fait qu'apporter l'intégration (F3/F4/C6).
- **Mes chemins sont intacts** : `git diff 222a2c5 07f09ff -- src/game tests/game` est vide.

## Commandes et résultats réels (`npm ci` propre, Node 22.23.4)

| Commande | Résultat |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test` | 17 fichiers, **299/299** (UTC+14) |
| `npm run build` | JS 21,03 Ko gzip, CSS 3,06 Ko gzip |
| `CI=1 npm run test:e2e` | e2e **49** réussis, 26 ignorés par profil ; navigateur F1/F3/F4 **26/26** |

## Usage de l'API F3/F4 : conforme

- **Types publics, jamais redéclarés** : `progression.ts` réexporte `THEME_IDS`, `SKIN_IDS`, `ThemeId`, `SkinId` et `Appearance` depuis `src/game`. C'est ce que je demandais en i1 de la revue A3a. Une divergence casserait désormais le typecheck.
- **Montage** : `appearance: progress.selected`, seulement des valeurs possédées et validées par le shell. Le moteur revalide de son côté (`resolveAppearance`).
- **Collection** : les aperçus passent par `renderAppearancePreview` avec une taille explicite (`160×72`), donc sans dépendre de la mise en page. Le repli CSS s'applique si le dessin renvoie `false` ou lève une erreur, et les deux cas sont testés. Les cartes verrouillées restent grisées : le canvas porte la classe `swatch`.

## Sondes dans l'application réelle

Build avec `VITE_EXPOSE_METRICS=1` et `vite preview`, Chromium avec le profil Pixel 7. La sauvegarde v2 est préparée par un script d'initialisation (Orbital et Marbré débloqués et choisis).

- **Effet réel en jeu** : après « Jouer », le pixel du ciel vaut `[30,34,87]`, exactement le haut du ciel Orbital au palier 0 (`#1E2257`). Même résultat en 390×844 et en 320×568. Aucune erreur de page.
- **Univers non débloqué dans la sauvegarde** (Jardin et Verre choisis sans objectif accompli) : le jeu démarre en Confiserie, avec un pixel de ciel `[255,209,228]` = `#FFD1E4`. Le repli est correct.
- **Netteté des aperçus** : tampon de 420 px pour un affichage de 150 px (390×844) ou 115 px (320×568), avec un DPR de 2,625. L'image est réduite, jamais étirée, donc nette.
- **Lisibilité** (capture `coordination/captures/revue-a4/collection-orbital-marbre-390x844.png`) :
  - chaque univers est montré avec l'apparence choisie, chaque apparence dans l'univers choisi ;
  - les verrous sont grisés et leur condition est explicite ;
  - la note indique « s'appliquent à la prochaine partie, purement visuels ».

## Défauts

Aucun.

**i1 — information.** Les aperçus sont dessinés une fois, à `160×72` CSS. Sur un écran large où la carte dépasserait environ 420 / DPR × 160 px, l'image serait légèrement agrandie. Ce n'est pas le cas en mobile, la cible.

**i2 — information.** La PR #21 (Pages) a un nouveau SHA, `90c6e64`, que je n'ai pas revu ici. Mon PASS sur `e02aedb` ne le couvre pas.

## Verdict

**PASS** sur `07f09ff84d070e5bd35c86e6cad889cea44aca2d`. À intégrer dans l'ordre de la pile : #12, #14, #18, #20, puis cette PR. Ce PASS ne couvre aucun SHA ultérieur.
