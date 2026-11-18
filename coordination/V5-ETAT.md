# V5 — état de reprise (Claude Code Alexis)

Ce fichier sert de point de reprise : si une session s'interrompt, repartir d'ici. Il est mis à jour à chaque étape.

## Cadre exceptionnel V5 (consigne utilisateur)

- **Organisation :** Alexis dirige la V5 seul. FLK ne participe pas.
- **Autorisations :**
  - tous les fichiers, moteur compris ;
  - dépendances et ressources sous licence compatible ;
  - branches, PR et fusion de ses propres PR sans revue externe ;
  - publication sur le GitHub Pages existant.
- **Nature des contrôles :** ce sont des **auto-vérifications**, pas une revue indépendante.
- **Interdits :** dépense, abonnement, suppression de données de joueurs, divulgation de secrets.
- **Branche :** `agent/claude-code-alexis/v5-boosts-visuels`, partie de `85fb0fe` (V4 en ligne).

## Direction

Voir [`docs/V5-DIRECTION.md`](../docs/V5-DIRECTION.md) : style « Pop Choc », règles v3 avec les boosts Ralenti, Aimant, Bouclier et Fièvre, absurdités décoratives.

## Étapes

| # | Étape | État |
|---|---|---|
| E0 | Lecture de l'état réel, diagnostic et direction créative | fait |
| E1 | Règles v3 : `src/game/core/v3.ts`, rejeu, tests et rejeux de référence ; v1 et v2 intactes | fait (225 tests moteur, `tests/game/v3.test.ts`, `golden-v3.json`) |
| E2 | Branchement v3 : contrat, liens `?v=3`, résultat, carte, classement, serveur | fait (519 tests unitaires) |
| E3 | Rendu « Pop Choc » : effets de pose, parfait, séries, Fièvre, boosts, chute, absurdités, interface en jeu | fait (`src/game/render/fx.ts`, `renderer.ts` ; 7 scénarios navigateur `tests/game/browser/v5.spec.ts`) |
| E4 | Son et vibrations coordonnés | fait (`audio.ts` : signatures des boosts, clac, boing, Fièvre, absurdités, suspension en arrière-plan ; vibrations dans le shell) |
| E5 | Accueil et résultat dans la nouvelle personnalité | fait (rayons et logo qui s'écrase à l'accueil, tampon et score qui surgit au résultat, aide des boosts) |
| E6 | Tests, séquences en navigateur, petits écrans, animations réduites, mode Fluide | fait (520 unitaires, 92 e2e, 49 moteur dont 10 V5 ; mots jamais sur la zone de pose en 390×844, 320×568, 844×390) |
| E7 | Bilan, PR, CI, fusion, publication Pages, vérification en ligne | à faire |

## Reprise

- **Dernier état :** chaîne complète verte en local.
  - `npm run typecheck` : OK ;
  - `npm test` : 520 tests ;
  - `npm run build` : OK ;
  - `CI=1 npm run test:e2e` : 92 tests passés, 46 ignorés par conception, plus 49 tests moteur.
- **Prochaine action :** E7.
  1. Séquences et captures dans `coordination/captures/v5/` ;
  2. `docs/V5.md`, statut et README ;
  3. PR vers `claude/youthful-mayer-n4f7oy`, CI, fusion ;
  4. `pages.yml` avec le SHA exact ;
  5. vérification en ligne.
