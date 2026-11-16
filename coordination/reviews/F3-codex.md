# Revue F3 — Codex

Date : 17 novembre 2026 (Europe/Paris). Auteur : Claude Code FLK ; reviewer : Codex.
PR #15 : https://github.com/alexis97432/jeuiaflouze/pull/15
SHA exact revu : `9e14f899f07609787dd1f0e287436562ecdf5bbb`.

**Verdict : PASS sur ce SHA.** Aucun défaut bloquant identifié. Ce verdict ne vaut pas validation humaine du plaisir ni compatibilité sur téléphone physique.

## Lecture et périmètre

Checkout détaché exact, lecture du diff propre à F3 `41e8ccc..9e14f89` : thèmes, renderer, audio, montage, démo et tests. Inspection visuelle des captures fournies Confiserie et du tableau des six matières livré ensuite en F4. Avis indépendants V2 des deux Claude pris en compte : trois univers et variantes orthogonales acceptés, maintien du cœur v1, la variante Voyage reste une démo expérimentale et non un nouveau mode imposé.

Les collisions, vitesses, PRNG et golden v1 sont inchangés : `git diff --exit-code 0add695 9e14f89 -- src/game/core tests/game/golden-v1.json` retourne 0. La hauteur graphique, la caméra et les paliers sont des paramètres de présentation. Lecture des assertions de bornes/mémoire/contraste ; les checks de pixels complètent les fonctions testées avec contexte factice.

## Vérification exécutée

Node 24.22.1 / npm 11.9.0, dépendances du lockfile sur ce checkout :

- npm ci : code 0 (88 paquets).
- npm run typecheck : code 0.
- npm test : **209/209**.
- npm run build : code 0, JS **14,09 Ko gzip** dans cet environnement.
- PLAYWRIGHT_BROWSERS_PATH=/workspace/work/playwright-browsers npm run test:e2e : **25 e2e A1 réussis, 14 ignorés par profil**, puis **18/18 navigateur F1/F3**, code 0. La configuration annonce explicitement les profils ignorés ; ce ne sont pas des tests passés.
- Mesure headless, CPU ×4, à 50 étages : p95 draw 7,40 ms Confiserie, 6,70 Orbital, 3,00 Jardin. Ce ne sont ni des FPS ni un budget garanti sur appareil. Les seuils de la suite passent.

Le serveur applicatif de cette exécution a également été réutilisé involontairement par un premier lancement F4 concurrent ; cette tentative F4 a été invalidée et refaite séparément. F3 reste testé avec son propre serveur, puis son harnais navigateur propre ; les résultats F4 définitifs sont dans le rapport F4.

## Décisions et limites

Le relief et les couleurs rendent l'évolution visuelle perceptible sur les captures examinées. Le texte de palier s'estompe et peut être peu contrasté à la fin de sa transition : ce n'est pas une instruction de jeu, le score reste indépendant. Demander aux testeurs si le décor gêne l'alignement et s'ils remarquent le changement avant dix étages.

Aucun vrai téléphone/Safari, aucune écoute du son et aucun avis humain sur ce nouveau rendu pendant cette revue. Le cadre/menus anciens visibles dans la démo de vraie application sont le lot A3/A4 Alexis. La publication Pages actuelle n'est pas automatiquement cette nouvelle version.

Alexis peut intégrer F3 après contrôle que la tête de #15 est toujours ce SHA, en merge conservant le commit revu, puis F4 validé séparément. Pas d'édition des fichiers de l'auteur ni de fusion distante par Codex dans cette livraison. Les rapports et l'alignement documentaire Codex doivent être relus par Alexis.
