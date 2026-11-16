# Claude Code Alexis

## Tâches

| Tâche | État | Branche | SHA / PR | Tests |
|---|---|---|---|---|
| Revue C0 v1 (Codex, PR #7) | **PASS** sur `3fdccac`, mineurs | a1-integration | coordination/reviews/C0v1-claude-code-alexis.md | confrontation au code F0/F1 |
| A0 squelette | PASS FLK sur `e84647e` ; **fusion par FLK attendue** (ordre PLAN : A0 → F0 → F1 → A1) | agent/claude-code-alexis/a0-shell | [PR #2](https://github.com/alexis97432/jeuiaflouze/pull/2) | CI verte |
| A1 intégration | **Vrai moteur branché** ; REVIEW_PENDING (FLK) | agent/claude-code-alexis/a1-integration | [PR #6](https://github.com/alexis97432/jeuiaflouze/pull/6), SHA dans la PR | voir ci-dessous |
| Revue C1 (Codex, PR #4) | PASS sur `f18e5d4`, intégrée | — | coordination/reviews/C1-claude-code-alexis.md | — |
| Revue protocole autonomie (Codex, PR #5) | PASS sur `df88ba5`, intégrée ; mineurs traités dans #7 | — | coordination/reviews/AUTONOMIE-claude-code-alexis.md | — |

## A1 — état

- **Moteur réel :** ma branche contient F1 `b44d2a6` (PASS Codex, F0 `3725541` inclus), fusionné par un commit de merge qui conserve les SHA revus. Tant que A0, F0 et F1 ne sont pas dans l'intégration, le diff de la PR #6 les montre aussi. Une fois fusionnés, il ne restera que le diff A1.
- `src/app/game-contract.ts` importe désormais les types de `src/game/index.ts` (aucune copie locale). `src/app/game-loader.ts` est un adaptateur pur (`createStartGame`) :
  - `sound = !muted` ;
  - `reducedMotion` omis, pour suivre la préférence système ;
  - `first_placement` = première pose réussie (`onEvent`), jamais un raté.
- **Mock supprimé** (`mock-game.ts` et son test) avec le bandeau. Un e2e vérifie l'absence de bandeau et que le canvas est dimensionné au DPR et réellement dessiné.
- i1 (voile de pause en double) : le voile DOM du shell est opaque, un seul message est visible. Contrôle visuel sur une capture Pixel 7, sans changement d'API.
- Son : réglable à l'accueil, donc entre les parties seulement (CONTRACTS v1, B2).
- Tests navigateur F1 de FLK : appelés par `npm run test:e2e` (script `test:game-browser`), donc présents dans la CI.
- Contenu préparé avant la bascule, inchangé : URL de défi stricte, stockage `poc:v1:` tolérant aux pannes, partage avec repli, délai de garde de 500 ms sur le résultat.
- Tests réels (SHA et sorties dans la PR) :
  - typecheck OK ;
  - `npm test` : 11 fichiers, 184/184 (A1 + F0/F1) ;
  - e2e A1 : 25 réussis, 125/125 sur 5 répétitions ;
  - navigateur F1 : 13/13 ;
  - 2 mutations de la bascule détectées.
- Limites :
  - aucun téléphone physique, Safari/WebKit ou Firefox ;
  - son non écouté ;
  - aucun playtest humain.

## Prochain pas

1. Revue FLK du nouveau SHA A1 ; corriger ses remarques.
2. Après la fusion d'A0 par FLK : intégrer F0 #1 puis F1 #3 (PASS Codex sur leurs têtes `3725541` et `b44d2a6`), en vérifiant les têtes de PR et la CI après chaque fusion.
3. Ensuite, M1 sur téléphones physiques iOS/Android, puis A1.5 (export local des mesures pour le premier playtest).

## Blocages

- Fusion d'A0 (#2) par FLK : préalable à F0/F1 dans l'ordre du PLAN.
- Validation sur appareil réel : nécessite un humain et des téléphones.

## Avis V2 (C3, 10–15 lignes)

1. **Ce qui vieillit le jeu :** des rectangles plats sur fond sombre uniforme, une police système, un accueil réduit à un titre et un bouton, et un résultat qui ne montre qu'un nombre. Rien n'évolue d'une partie à l'autre : aucune trace, aucun but au-delà du record.
2. **Je garde :** l'univers jouet en relief, la Tour du jour (rendez-vous sans backend), le catalogue fini de 9 objectifs, aucune boutique et `rulesVersion` 1.
3. **Je change :** une seule action principale à l'accueil (« Jouer »), la Tour du jour en carte secondaire avec sa date, les objectifs en bandeau de 3 lignes. La collection est un écran à part, jamais imposé.
4. **Alternative concrète, moins chère :** commencer le partage par un **texte à motif** (une ligne de pastilles par série de poses, façon grille de mots du jour) plutôt qu'une image Canvas. Il passe partout (SMS, messageries), sans permission de fichier, et iOS est inégal pour partager des fichiers. La carte image vient ensuite si les testeurs la demandent.
5. **Coût et risque principaux :**
   - côté FLK : les 3 univers × 6 apparences, à garder lisibles ;
   - côté shell : multiplier les écrans et retomber dans un « tableau de bord ».

   Garde-fou : chaque écran garde une seule action principale. La collection apparaît après le premier objectif rempli, pas avant.
6. **Mesure :** deux testeurs donnent du qualitatif, pas des taux. J'ajoute `mode = daily` aux mesures en proposition (revue C3, m1), pour pouvoir compter les parties du jour sans rien envoyer à distance.

## Avis indépendant sur le concept (inchangé, ≤ 15 lignes)

Le genre est saturé et la seed ne fait varier que la vitesse : le « même défi » est peu perceptible. FLK fait le même constat. Je recommande de garder ce moteur et de tester un **habillage quotidien** (une seed par jour UTC, carte de résultat sans spoiler) face au défi ami, dans le test des 10 personnes, avec des ordres contrebalancés. Signal qualitatif uniquement.

